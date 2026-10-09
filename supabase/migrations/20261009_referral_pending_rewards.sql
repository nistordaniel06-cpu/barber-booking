-- Queue potential referral promo benefits only after independently qualified events.
-- Pending is NEVER a wallet credit or active subscription. Separate fulfilment required.
create or replace function public.bc_referral_visit_qualify()
returns trigger language plpgsql security definer set search_path=''
as $$
declare c record;cfg record;
begin
 select * into cfg from public.bc_referral_config where id=1;
 for c in
 update public.bc_referral_claims claim set status='qualified',qualified_at=now()
 from public.bc_referral_links link
 where claim.link_id=link.id and link.audience='client'
 and claim.invited=new.user_id and claim.status='registered'
 returning claim.id,claim.inviter,claim.invited
 loop
 if coalesce(cfg.enabled,false) then
 insert into public.bc_referral_rewards(claim_id,beneficiary,kind,amount,status)
 values(c.id,c.inviter,'promo_points',cfg.client_referrer_points,'pending'),
 (c.id,c.invited,'promo_points',cfg.client_newcomer_points,'pending')
 on conflict do nothing;
 end if;
 end loop;
 return new;
end;$$;
revoke all on function public.bc_referral_visit_qualify() from public,anon,authenticated;
create or replace function public.bc_admin_referral_pro_verify(p_claim uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare c public.bc_referral_claims%rowtype;origin public.bc_referral_links%rowtype;cfg record;
begin
 if not public.bc_is_platform_admin() then raise exception 'ADMIN_ONLY';end if;
 select * into c from public.bc_referral_claims where id=p_claim for update;
 if not found or c.status<>'registered' then raise exception 'NOT_PENDING';end if;
 select * into origin from public.bc_referral_links where id=c.link_id;
 if origin.audience<>'pro' then raise exception 'PRO_ONLY';end if;
 if not exists(select 1 from public.bc_salon_members m join public.bc_salons s on s.id=m.salon_id
 where m.user_id=c.invited and m.role='owner' and s.archived_at is null and m.salon_id<>origin.salon_id)
 then raise exception 'INVITED_SALON_NOT_APPROVED';end if;
 update public.bc_referral_claims set status='qualified',qualified_at=now() where id=p_claim;
 select * into cfg from public.bc_referral_config where id=1;
 if coalesce(cfg.enabled,false) then
 insert into public.bc_referral_rewards(claim_id,beneficiary,kind,amount,status)
 values(c.id,c.inviter,'pro_trial_request',cfg.pro_free_days,'pending'),
 (c.id,c.invited,'pro_trial_request',cfg.pro_free_days,'pending')
 on conflict do nothing;
 end if;
 return jsonb_build_object('qualified',true,'bonus','pending_only','activated',false);
end;$$;
revoke all on function public.bc_admin_referral_pro_verify(uuid) from public,anon;
grant execute on function public.bc_admin_referral_pro_verify(uuid) to authenticated;
