-- BARBERCRAFT: privacy-minimized reward reconciliation for salon and platform.
create or replace function public.bc_reward_partner_history(p_salon uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
begin
 if (select auth.uid()) is null or not exists(
 select 1 from public.bc_salon_members where salon_id=p_salon and user_id=(select auth.uid()))
 then raise exception 'NOT_SALON_STAFF';end if;
 return coalesce((select jsonb_agg(jsonb_build_object(
  'title',r.reward_title,'status',case when r.status='requested' and r.expires_at<=now() then 'expired' else r.status end,
  'cost',r.points_cost,'created_at',r.created_at,'redeemed_at',r.redeemed_at)
  order by r.created_at desc)
  from (select reward_title,status,points_cost,created_at,redeemed_at,expires_at
        from public.bc_reward_claims where salon_id=p_salon
        order by created_at desc limit 40)r),'[]'::jsonb);
end;$$;
revoke all on function public.bc_reward_partner_history(uuid) from public,anon;
grant execute on function public.bc_reward_partner_history(uuid) to authenticated;
create or replace function public.bc_admin_reward_history()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
begin
 if (select auth.uid()) is null or not public.bc_is_platform_admin() then raise exception 'ADMIN_ONLY';end if;
 return coalesce((select jsonb_agg(jsonb_build_object(
  'title',r.reward_title,'salon',s.name,'status',case when r.status='requested' and r.expires_at<=now() then 'expired' else r.status end,
  'cost',r.points_cost,'created_at',r.created_at,'redeemed_at',r.redeemed_at)
  order by r.created_at desc)
  from (select reward_title,status,points_cost,created_at,redeemed_at,expires_at,salon_id
        from public.bc_reward_claims order by created_at desc limit 100)r
  join public.bc_salons s on s.id=r.salon_id),'[]'::jsonb);
end;$$;
revoke all on function public.bc_admin_reward_history() from public,anon;
grant execute on function public.bc_admin_reward_history() to authenticated;
