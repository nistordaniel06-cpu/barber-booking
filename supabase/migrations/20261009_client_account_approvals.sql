-- Customer account verification, distinct from salon/pro approval.
-- Existing accounts are grandfathered to avoid unexpectedly blocking current customers.
-- New auth signups are pending until a platform administrator approves.
create table if not exists public.bc_client_approvals(
 user_id uuid primary key references auth.users(id) on delete cascade,
 status text not null default 'pending' check(status in ('pending','approved','rejected','suspended')),
 requested_at timestamptz not null default now(),
 reviewed_at timestamptz,
 reviewed_by uuid references auth.users(id) on delete set null,
 reason text not null default ''
);
alter table public.bc_client_approvals enable row level security;
revoke all on public.bc_client_approvals from public,anon,authenticated;

insert into public.bc_client_approvals(user_id,status)
select id,'approved' from auth.users
on conflict(user_id) do nothing;

create or replace function public.bc_register_pending_client()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 insert into public.bc_client_approvals(user_id,status) values(new.id,'pending')
 on conflict(user_id) do nothing;
 return new;
end;$$;
revoke all on function public.bc_register_pending_client() from public,anon,authenticated;
drop trigger if exists bc_signup_needs_client_approval on auth.users;
create trigger bc_signup_needs_client_approval after insert on auth.users
for each row execute function public.bc_register_pending_client();

create or replace function public.bc_client_my_approval()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare s text;
begin
 if (select auth.uid()) is null then return jsonb_build_object('status','login_required');end if;
 select status into s from public.bc_client_approvals where user_id=(select auth.uid());
 return jsonb_build_object('status',coalesce(s,'pending'));
end;$$;
revoke all on function public.bc_client_my_approval() from public,anon;
grant execute on function public.bc_client_my_approval() to authenticated;

create or replace function public.bc_admin_clients_list()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
begin
 if not public.bc_is_platform_admin() then raise exception 'ADMIN_ONLY';end if;
 return coalesce((select jsonb_agg(to_jsonb(t) order by t.requested_at desc)
 from (
  select a.user_id,u.email,a.status,a.requested_at,a.reviewed_at,
   a.reason,coalesce(p.display_name,'') as display_name
  from public.bc_client_approvals a
  join auth.users u on u.id=a.user_id and u.deleted_at is null
  left join public.bc_profiles p on p.user_id=a.user_id
  order by a.requested_at desc
  limit 500
 )t),'[]'::jsonb);
end;$$;
revoke all on function public.bc_admin_clients_list() from public,anon;
grant execute on function public.bc_admin_clients_list() to authenticated;

create or replace function public.bc_admin_client_review(
 p_user uuid,p_status text,p_reason text default '')
returns jsonb language plpgsql security definer set search_path=''
as $$
declare old_status text;
begin
 if not public.bc_is_platform_admin() then raise exception 'ADMIN_ONLY';end if;
 if p_status not in ('approved','rejected','suspended','pending') then
  raise exception 'INVALID_APPROVAL_STATUS';end if;
 if p_status in ('rejected','suspended') and length(trim(coalesce(p_reason,'')))<5
 then raise exception 'EXPLANATION_REQUIRED';end if;
 if p_user=(select auth.uid()) or exists(
  select 1 from public.bc_platform_admins where user_id=p_user)
 then raise exception 'ADMIN_ACCOUNT_PROTECTED';end if;
 select status into old_status from public.bc_client_approvals where user_id=p_user for update;
 if old_status is null then raise exception 'CLIENT_NOT_FOUND';end if;
 update public.bc_client_approvals
 set status=p_status,reviewed_at=now(),reviewed_by=(select auth.uid()),
  reason=left(trim(coalesce(p_reason,'')),500) where user_id=p_user;
 insert into public.bc_admin_audit(actor_id,action,target_type,target_id,details)
 values((select auth.uid()),'client_'||p_status,'client',p_user::text,
 jsonb_build_object('previous_status',old_status,'reason',left(coalesce(p_reason,''),500)));
 return jsonb_build_object('ok',true,'status',p_status);
end;$$;
revoke all on function public.bc_admin_client_review(uuid,text,text) from public,anon;
grant execute on function public.bc_admin_client_review(uuid,text,text) to authenticated;

-- Only approved authenticated customers can complete public catalog reservations.
-- Private owner-invite pilot bookings remain separate, useful for salon-side testing.
create or replace function public.bc_catalog_booking_create(
 p_catalog uuid,p_request uuid,p_service text,p_date date,p_time time,
 p_name text,p_phone text,p_consent boolean)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare c public.bc_public_salon_catalog%rowtype;token text;approval text;
begin
 if (select auth.uid()) is null then raise exception 'CLIENT_LOGIN_REQUIRED';end if;
 select status into approval from public.bc_client_approvals where user_id=(select auth.uid());
 if approval is distinct from 'approved' then raise exception 'CLIENT_NOT_APPROVED';end if;
 select * into c from public.bc_public_salon_catalog where id=p_catalog for update;
 if not found or c.salon_id is null or c.visibility<>'listed'
  or c.public_booking_enabled is distinct from true
 then raise exception 'ONLINE_BOOKING_NOT_ENABLED';end if;
 if not exists(select 1 from public.bc_salons where id=c.salon_id and archived_at is null)
 then raise exception 'SALON_INACTIVE';end if;
 select invite_code into token from public.bc_pilot_config
 where salon_id=c.salon_id and enabled=true;
 if token is null then raise exception 'OWNER_HAS_CLOSED_BOOKINGS';end if;
 return public.bc_pilot_book(c.salon_id,token,p_request,p_service,p_date,p_time,
  p_name,p_phone,p_consent);
end;$$;
revoke all on function public.bc_catalog_booking_create(uuid,uuid,text,date,time,text,text,boolean) from public,anon;
grant execute on function public.bc_catalog_booking_create(uuid,uuid,text,date,time,text,text,boolean) to authenticated;
