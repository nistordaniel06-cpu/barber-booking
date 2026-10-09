-- BARBERCRAFT: server-owned portal identity. Browser storage keys are NOT roles.
-- Preserve the legacy 4MEN platform-admin + salon-owner identity (PRO + Admin
-- portal authentication stays separate); do not remove existing memberships.
create table if not exists public.bc_portal_accounts(
  user_id uuid primary key references auth.users(id) on delete cascade,
  portal text not null check(portal in ('client','pro','admin')),
  created_at timestamptz not null default now()
);
alter table public.bc_portal_accounts enable row level security;
revoke all on public.bc_portal_accounts from public,anon,authenticated;

-- Import existing accounts based on real server-side membership first.
-- Earlier metadata labeled even the real salon owner "client"; do not trust it
-- above an actual membership, and do not change any current salon ownership.
insert into public.bc_portal_accounts(user_id,portal)
select u.id,
 case
  when exists(select 1 from public.bc_salon_members m where m.user_id=u.id)
    or exists(select 1 from public.bc_partner_applications p where p.user_id=u.id)
    then 'pro'
  when exists(select 1 from public.bc_platform_admins a where a.user_id=u.id)
    then 'admin'
  when lower(coalesce(u.raw_user_meta_data->>'barbercraft_account_type','')) in ('pro','professional')
    then 'pro'
  else 'client'
 end
from auth.users u
on conflict (user_id) do nothing;

-- Capture the intended portal ONCE during initial sign-up; changing editable
-- user_metadata afterwards cannot move an account to another portal.
-- No user-supplied metadata may create an administrator account.
create or replace function public.bc_assign_portal_on_signup()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 insert into public.bc_portal_accounts(user_id,portal)
 values(new.id,
   case when lower(coalesce(new.raw_user_meta_data->>'barbercraft_account_type',''))
     in ('pro','professional') then 'pro' else 'client' end)
 on conflict (user_id) do nothing;
 return new;
end;$$;
revoke all on function public.bc_assign_portal_on_signup() from public,anon,authenticated;
drop trigger if exists bc_assign_portal_identity on auth.users;
create trigger bc_assign_portal_identity after insert on auth.users
for each row execute function public.bc_assign_portal_on_signup();

create or replace function public.bc_portal_access(p_portal text)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare u uuid; acct text; staff boolean; is_admin boolean; allowed boolean:=false;
begin
 u:=(select auth.uid());
 if u is null then
   return jsonb_build_object('allowed',false,'reason','LOGIN_REQUIRED');
 end if;
 select portal into acct from public.bc_portal_accounts where user_id=u;
 select exists(select 1 from public.bc_salon_members where user_id=u) into staff;
 select exists(select 1 from public.bc_platform_admins where user_id=u) into is_admin;
 if p_portal='client' then
   allowed:=acct='client' and not staff and not is_admin;
 elsif p_portal='pro' then
   allowed:=acct='pro';
 elsif p_portal='admin' then
   allowed:=is_admin;
 end if;
 return jsonb_build_object('allowed',coalesce(allowed,false),
   'portal',case when is_admin and acct<>'pro' then 'admin' else coalesce(acct,'unregistered') end,
   'has_salon',staff,'is_admin',is_admin,
   'reason',case when allowed then 'OK' else 'WRONG_PORTAL' end);
end;$$;
revoke all on function public.bc_portal_access(text) from public,anon;
grant execute on function public.bc_portal_access(text) to authenticated;

create or replace function public.bc_pro_portal_access()
returns jsonb language sql stable security definer set search_path=''
as $$select public.bc_portal_access('pro')$$;
revoke all on function public.bc_pro_portal_access() from public,anon;
grant execute on function public.bc_pro_portal_access() to authenticated;

create or replace function public.bc_client_my_approval()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare u uuid; status_value text;
begin
 u:=(select auth.uid());
 if u is null then return jsonb_build_object('status','login_required');end if;
 if coalesce((public.bc_portal_access('client')->>'allowed')::boolean,false)=false then
   return jsonb_build_object('status','wrong_portal','portal','client');
 end if;
 select status into status_value from public.bc_client_approvals where user_id=u;
 return jsonb_build_object('status',coalesce(status_value,'pending'));
end;$$;
revoke all on function public.bc_client_my_approval() from public,anon;
grant execute on function public.bc_client_my_approval() to authenticated;

-- Admin client review must exclude existing PRO staff even when their signup
-- metadata incorrectly says "client".
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
  join public.bc_portal_accounts pa on pa.user_id=a.user_id and pa.portal='client'
  left join public.bc_profiles p on p.user_id=a.user_id
  where not exists(select 1 from public.bc_salon_members sm where sm.user_id=a.user_id)
    and not exists(select 1 from public.bc_platform_admins aa where aa.user_id=a.user_id)
  order by a.requested_at desc limit 500
 ) t),'[]'::jsonb);
end;$$;
revoke all on function public.bc_admin_clients_list() from public,anon;
grant execute on function public.bc_admin_clients_list() to authenticated;

-- Do not let a Client account silently receive a salon ownership or staff row.
-- Existing PRO memberships remain intact; only future INSERT/UPDATE are checked.
create or replace function public.bc_require_pro_for_salon_member()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 if not exists(select 1 from public.bc_portal_accounts p
               where p.user_id=new.user_id and p.portal='pro')
 then raise exception 'PRO_ACCOUNT_REQUIRED_FOR_SALON';end if;
 return new;
end;$$;
revoke all on function public.bc_require_pro_for_salon_member() from public,anon,authenticated;
drop trigger if exists bc_member_portal_guard on public.bc_salon_members;
create trigger bc_member_portal_guard before insert or update of user_id
on public.bc_salon_members for each row execute function public.bc_require_pro_for_salon_member();

-- Client must not be able to file salon partner applications through the Data API.
drop policy if exists bc_partner_self_insert on public.bc_partner_applications;
create policy bc_partner_self_insert on public.bc_partner_applications
for insert to authenticated with check(
  user_id=(select auth.uid()) and status='pending'
  and coalesce((public.bc_portal_access('pro')->>'allowed')::boolean,false)
);
