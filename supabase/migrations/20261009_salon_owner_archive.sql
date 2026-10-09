-- Owner-initiated salon removal from BARBERCRAFT without destroying appointments or audit trails.
alter table public.bc_salons add column if not exists archived_at timestamptz;
alter table public.bc_salons add column if not exists archived_by uuid references auth.users(id);
create or replace function public.bc_pro_archive_salon(p_salon uuid,p_confirmation text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare u uuid;s public.bc_salons%rowtype;upcoming integer;
begin
 u:= (select auth.uid());
 select * into s from public.bc_salons where id=p_salon for update;
 if u is null or not exists(select 1 from public.bc_salon_members where salon_id=p_salon and user_id=u and role='owner')
 then raise exception 'OWNER_ONLY';end if;
 if not found then raise exception 'SALON_NOT_FOUND';end if;
 if s.archived_at is not null then raise exception 'ALREADY_ARCHIVED';end if;
 if trim(coalesce(p_confirmation,''))<>s.name then raise exception 'CONFIRM_SALON_NAME';end if;
 select count(*) into upcoming from public.bc_pro_calendar_events
 where salon_id=p_salon and starts_at>now() and status not in ('cancelled','completed');
 if upcoming>0 then raise exception 'FUTURE_APPOINTMENTS_MUST_BE_RESOLVED';end if;
 update public.bc_salons set archived_at=now(),archived_by=u,booking_enabled=false where id=p_salon;
 update public.bc_public_salon_catalog set visibility='hidden' where salon_id=p_salon;
 update public.bc_tw_salon_optins set enabled=false where salon_id=p_salon;
 return jsonb_build_object('archived',true,'salon',s.name,'note','Removed from discovery; historical records retained');
end;$$;
revoke all on function public.bc_pro_archive_salon(uuid,text) from public,anon;
grant execute on function public.bc_pro_archive_salon(uuid,text) to authenticated;
create or replace function public.bc_pro_restore_salon(p_salon uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$declare u uuid;begin
 u:=(select auth.uid());
 if u is null or not exists(select 1 from public.bc_salon_members where salon_id=p_salon and user_id=u and role='owner')
 then raise exception 'OWNER_ONLY';end if;
 update public.bc_salons set archived_at=null,archived_by=null where id=p_salon and archived_at is not null;
 if not found then raise exception 'NOT_ARCHIVED';end if;
 -- Restore never silently enables bookings or public listing; owner must explicitly reactivate.
 return jsonb_build_object('restored',true,'listing','hidden','bookings','disabled');
end;$$;
revoke all on function public.bc_pro_restore_salon(uuid) from public,anon;
grant execute on function public.bc_pro_restore_salon(uuid) to authenticated;
create or replace function public.bc_pro_salon_lifecycle(p_salon uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$declare u uuid;begin
 u:=(select auth.uid());
 if u is null or not exists(select 1 from public.bc_salon_members where salon_id=p_salon and user_id=u)
 then raise exception 'NOT_SALON_STAFF';end if;
 return (select jsonb_build_object('salon_name',s.name,'archived',s.archived_at is not null,
 'owner',exists(select 1 from public.bc_salon_members m where m.salon_id=s.id and m.user_id=u and m.role='owner'),
 'upcoming',(select count(*) from public.bc_pro_calendar_events e where e.salon_id=s.id
 and e.starts_at>now() and e.status not in ('cancelled','completed')))
 from public.bc_salons s where s.id=p_salon);
end;$$;
revoke all on function public.bc_pro_salon_lifecycle(uuid) from public,anon;
grant execute on function public.bc_pro_salon_lifecycle(uuid) to authenticated;
