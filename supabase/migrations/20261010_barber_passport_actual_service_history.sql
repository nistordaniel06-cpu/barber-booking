-- Client personal visit history: only staff-confirmed service completions,
-- no legacy territory scores, no reserved calendar slots.
create or replace function public.bc_passport_my_visit_history()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare u uuid:=(select auth.uid());
begin
 if u is null or not coalesce((public.bc_portal_access('client')->>'allowed')::boolean,false)
 then raise exception 'CLIENT_PORTAL_REQUIRED' using errcode='42501';end if;
 return jsonb_build_object(
  'total_visits',(select count(*) from public.bc_service_visits where user_id=u),
  'recent',coalesce((select jsonb_agg(jsonb_build_object(
    'id',v.id,'date',v.verified_at,'salon',s.name,'salon_id',v.salon_id,
    'xp',coalesce((select x.xp from public.bc_passport_xp_ledger x
      where x.user_id=u and x.source_id=v.id and x.event_key='visit_base'),0)
  ) order by v.verified_at desc)
  from (select id,salon_id,verified_at from public.bc_service_visits
    where user_id=u order by verified_at desc limit 40)v
  join public.bc_salons s on s.id=v.salon_id),'[]'::jsonb)
 );
end $$;
revoke all on function public.bc_passport_my_visit_history() from public,anon;
grant execute on function public.bc_passport_my_visit_history() to authenticated;
