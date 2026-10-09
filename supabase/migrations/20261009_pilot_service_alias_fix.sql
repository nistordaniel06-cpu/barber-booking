-- Fix PL/pgSQL variable/alias collision while validating unique service names
create or replace function public.bc_pilot_configure(p_salon uuid,p_enabled boolean,
 p_services jsonb,p_opens time,p_closes time,p_regenerate_code boolean default false)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare service jsonb;new_code text;
begin
 if (select auth.uid()) is null or not exists(
 select 1 from public.bc_salon_members m where m.salon_id=p_salon
 and m.user_id=(select auth.uid()) and m.role in ('owner','manager'))
 then raise exception 'OWNER_OR_MANAGER_REQUIRED';end if;
 if not exists(select 1 from public.bc_salons where id=p_salon and archived_at is null)
 then raise exception 'SALON_INACTIVE';end if;
 if p_opens is null or p_closes is null or p_opens<time '07:00'
 or p_closes>time '22:00' or p_closes<=p_opens or
 jsonb_typeof(p_services) is distinct from 'array' or jsonb_array_length(p_services)>12
 then raise exception 'INVALID_PILOT_CONFIGURATION';end if;
 if p_enabled and jsonb_array_length(p_services)=0 then raise exception 'ADD_SERVICES_FIRST';end if;
 for service in select value from jsonb_array_elements(p_services) loop
  if jsonb_typeof(service) is distinct from 'object'
  or length(trim(coalesce(service->>'name',''))) not between 3 and 90
  or coalesce(service->>'duration','') !~ '^[0-9]+$'
  or (service->>'duration')::integer not in (15,30,45,60,75,90,120)
  or coalesce(service->>'price','') !~ '^[0-9]+$'
  or (service->>'price')::integer not between 1 and 1000 then raise exception 'INVALID_SERVICE';end if;
 end loop;
 if (select count(distinct lower(trim(it.value->>'name'))) from jsonb_array_elements(p_services) as it(value))
 <>jsonb_array_length(p_services) then raise exception 'DUPLICATE_SERVICE';end if;
 select invite_code into new_code from public.bc_pilot_config where salon_id=p_salon for update;
 if p_regenerate_code or new_code is null then new_code:=encode(gen_random_bytes(12),'hex');end if;
 insert into public.bc_pilot_config(salon_id,enabled,invite_code,services,opens,closes,updated_at,updated_by)
 values(p_salon,coalesce(p_enabled,false),new_code,p_services,p_opens,p_closes,now(),(select auth.uid()))
 on conflict(salon_id) do update set enabled=excluded.enabled,invite_code=excluded.invite_code,
 services=excluded.services,opens=excluded.opens,closes=excluded.closes,updated_at=now(),updated_by=(select auth.uid());
 return jsonb_build_object('saved',true,'enabled',p_enabled,'invite_code',new_code);
end;$$;
revoke all on function public.bc_pilot_configure(uuid,boolean,jsonb,time,time,boolean) from public,anon;
grant execute on function public.bc_pilot_configure(uuid,boolean,jsonb,time,time,boolean) to authenticated;

