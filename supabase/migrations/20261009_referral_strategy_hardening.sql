-- Preserve sub-hour resource generation; require new-user consent for attribution.
create or replace function public.bc_kingdom_update_tick(p_user uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare v public.bc_kingdom_villages%rowtype; seconds integer; hours numeric; cap integer;
begin
 select * into v from public.bc_kingdom_villages where user_id=p_user for update;
 if not found then raise exception 'NO_VILLAGE';end if;
 seconds:=least(21600, greatest(0,(floor(extract(epoch from now()-v.last_tick)/180)::integer)*180));
 if seconds<180 then return;end if;
 hours:=seconds::numeric/3600;
 cap:=400+(coalesce((v.buildings->>'storage')::integer,1)-1)*150;
 update public.bc_kingdom_villages set
 wood=least(cap,v.wood+floor(hours*(25+15*(coalesce((v.buildings->>'wood')::integer,1)-1)))::integer),
 stone=least(cap,v.stone+floor(hours*(20+12*(coalesce((v.buildings->>'stone')::integer,1)-1)))::integer),
 iron=least(cap,v.iron+floor(hours*(20+12*(coalesce((v.buildings->>'iron')::integer,1)-1)))::integer),
 food=least(cap,v.food+floor(hours*(25+15*(coalesce((v.buildings->>'farm')::integer,1)-1)))::integer),
 last_tick=case when seconds>=21600 then now() else v.last_tick+(seconds||' seconds')::interval end
 where user_id=p_user;
end;$$;
revoke all on function public.bc_kingdom_update_tick(uuid) from public,anon,authenticated;
-- Invited member must have registered within 7 days and after (approximately) the link existed.
create or replace function public.bc_referral_claim(p_code text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare u uuid;l public.bc_referral_links%rowtype;joined timestamptz;
begin
 u:=(select auth.uid());if u is null then raise exception 'LOGIN_REQUIRED';end if;
 select * into l from public.bc_referral_links where code=upper(trim(coalesce(p_code,'')));
 if not found then raise exception 'INVALID_CODE';end if;
 if l.inviter=u then raise exception 'SELF_REFERRAL';end if;
 select created_at into joined from auth.users where id=u;
 if joined is null or joined < now()-interval '7 days' or joined < l.created_at - interval '15 minutes'
 then raise exception 'INVITATION_FOR_NEW_ACCOUNTS_ONLY';end if;
 if exists(select 1 from public.bc_referral_claims where invited=u) then raise exception 'INVITATION_ALREADY_USED';end if;
 if exists(select 1 from public.bc_service_visits where user_id=u)
 or exists(select 1 from public.bc_tw_activity where user_id=u)
 then raise exception 'ALREADY_ACTIVE_CLIENT';end if;
 if (select count(*) from public.bc_referral_claims where inviter=l.inviter and created_at>date_trunc('month',now()))
 >=(select monthly_referrer_cap from public.bc_referral_config where id=1)
 then raise exception 'REFERRAL_MONTHLY_CAP';end if;
 insert into public.bc_referral_claims(link_id,inviter,invited) values(l.id,l.inviter,u);
 return jsonb_build_object('registered',true,'status','awaiting_verified_action','audience',l.audience,
 'promotion_active',(select enabled from public.bc_referral_config where id=1));
end;$$;
revoke all on function public.bc_referral_claim(text) from public,anon;
grant execute on function public.bc_referral_claim(text) to authenticated;
create or replace function public.bc_admin_referral_pro_verify(p_claim uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare c public.bc_referral_claims%rowtype;origin public.bc_referral_links%rowtype;
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
 return jsonb_build_object('qualified',true,'reward','pending_admin_and_billing_activation');
end;$$;
revoke all on function public.bc_admin_referral_pro_verify(uuid) from public,anon;
grant execute on function public.bc_admin_referral_pro_verify(uuid) to authenticated;
