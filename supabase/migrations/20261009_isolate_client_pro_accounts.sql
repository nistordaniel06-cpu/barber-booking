-- Keep new PRO identities out of Client approval queue.
-- Maintain existing accounts, approval rows and dual-role legacy owners intact.
create or replace function public.bc_register_pending_client()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 if lower(coalesce(new.raw_user_meta_data->>'barbercraft_account_type','client'))
   not in ('professional','pro','admin')
 then
  insert into public.bc_client_approvals(user_id,status)
  values(new.id,'pending') on conflict(user_id) do nothing;
 end if;
 return new;
end;$$;

-- This portal access check is advisory to UI. All salon RPCs retain membership
-- checks; changing mutable user_metadata alone never grants PRO salon permissions.
create or replace function public.bc_pro_portal_access()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare uid uuid:=(select auth.uid());legacy_owner boolean;member boolean;application boolean;requested_pro boolean;
begin
 if uid is null then return jsonb_build_object('allowed',false,'reason','LOGIN_REQUIRED');end if;
 select exists(select 1 from public.bc_salon_members m where m.user_id=uid) into member;
 select exists(select 1 from public.bc_partner_applications a where a.user_id=uid) into application;
 select coalesce((select lower(u.raw_user_meta_data->>'barbercraft_account_type') in ('professional','pro')
  from auth.users u where u.id=uid),false) into requested_pro;
 legacy_owner:=member or application;
 return jsonb_build_object('allowed',member or application or requested_pro,
 'has_salon',member,'has_application',application,
 'reason',case when member or application or requested_pro then 'OK' else 'CLIENT_ACCOUNT_NOT_PRO' end);
end;$$;
revoke all on function public.bc_pro_portal_access() from public,anon;
grant execute on function public.bc_pro_portal_access() to authenticated;

create or replace function public.bc_client_my_approval()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare uid uuid:=(select auth.uid());s text;kind text;
begin
 if uid is null then return jsonb_build_object('status','login_required');end if;
 select lower(u.raw_user_meta_data->>'barbercraft_account_type') into kind
 from auth.users u where u.id=uid;
 if kind in ('professional','pro','admin') then
  return jsonb_build_object('status','wrong_portal','portal','pro');
 end if;
 select status into s from public.bc_client_approvals where user_id=uid;
 return jsonb_build_object('status',coalesce(s,'pending'));
end;$$;
revoke all on function public.bc_client_my_approval() from public,anon;
grant execute on function public.bc_client_my_approval() to authenticated;

-- List only actual Client identities; never mix admin / PRO signups into reviews.
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
  where lower(coalesce(u.raw_user_meta_data->>'barbercraft_account_type','client'))
    not in ('professional','pro','admin')
    and not exists(select 1 from public.bc_platform_admins aa where aa.user_id=a.user_id)
  order by a.requested_at desc limit 500
 )t),'[]'::jsonb);
end;$$;
revoke all on function public.bc_admin_clients_list() from public,anon;
grant execute on function public.bc_admin_clients_list() to authenticated;

-- Public bookings must check client status as well as Auth, not a stale approval row.
create or replace function public.bc_catalog_booking_create(
 p_catalog uuid,p_request uuid,p_service text,p_date date,p_time time,
 p_name text,p_phone text,p_consent boolean)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare c public.bc_public_salon_catalog%rowtype;token text;approval text;
begin
 if (select auth.uid()) is null then raise exception 'CLIENT_LOGIN_REQUIRED';end if;
 approval:=public.bc_client_my_approval()->>'status';
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
