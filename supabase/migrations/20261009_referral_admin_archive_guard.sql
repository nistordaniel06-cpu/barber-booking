-- Referral campaign admin controls and archived salon booking guard.
create or replace function public.bc_admin_referral_overview()
returns jsonb language plpgsql stable security definer set search_path=''
as $$begin
 if not public.bc_is_platform_admin() then raise exception 'ADMIN_ONLY';end if;
 return jsonb_build_object(
 'campaign',(select row_to_json(c) from public.bc_referral_config c where id=1),
 'claims',coalesce((select jsonb_agg(jsonb_build_object(
 'id',c.id,'status',c.status,'audience',l.audience,
 'inviter',c.inviter,'invited',c.invited,'created_at',c.created_at,'qualified_at',c.qualified_at)
 order by c.created_at desc)
 from (select * from public.bc_referral_claims order by created_at desc limit 100)c
 join public.bc_referral_links l on l.id=c.link_id),'[]'::jsonb));
end;$$;
revoke all on function public.bc_admin_referral_overview() from public,anon;
grant execute on function public.bc_admin_referral_overview() to authenticated;
create or replace function public.bc_archive_booking_guard()
returns trigger language plpgsql security definer set search_path=''
as $$begin
 if new.starts_at>now() and exists(select 1 from public.bc_salons where id=new.salon_id and archived_at is not null)
 then raise exception 'SALON_ARCHIVED';end if;
 return new;
end;$$;
revoke all on function public.bc_archive_booking_guard() from public,anon,authenticated;
drop trigger if exists bc_guard_archived_new_booking on public.bc_pro_calendar_events;
create trigger bc_guard_archived_new_booking before insert or update of starts_at,salon_id
on public.bc_pro_calendar_events for each row execute function public.bc_archive_booking_guard();
