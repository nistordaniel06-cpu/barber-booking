-- pgcrypto functions live in extensions schema, functions use empty search_path
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
 if p_regenerate_code or new_code is null then new_code:=encode(extensions.gen_random_bytes(12),'hex');end if;
 insert into public.bc_pilot_config(salon_id,enabled,invite_code,services,opens,closes,updated_at,updated_by)
 values(p_salon,coalesce(p_enabled,false),new_code,p_services,p_opens,p_closes,now(),(select auth.uid()))
 on conflict(salon_id) do update set enabled=excluded.enabled,invite_code=excluded.invite_code,
 services=excluded.services,opens=excluded.opens,closes=excluded.closes,updated_at=now(),updated_by=(select auth.uid());
 return jsonb_build_object('saved',true,'enabled',p_enabled,'invite_code',new_code);
end;$$;
revoke all on function public.bc_pilot_configure(uuid,boolean,jsonb,time,time,boolean) from public,anon;
grant execute on function public.bc_pilot_configure(uuid,boolean,jsonb,time,time,boolean) to authenticated;


create or replace function public.bc_pilot_book(p_salon uuid,p_code text,p_request uuid,
 p_service text,p_date date,p_time time,p_name text,p_phone text,p_consent boolean)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare conf public.bc_pilot_config%rowtype;salon public.bc_salons%rowtype;
 service jsonb;start_utc timestamptz;end_utc timestamptz;duration integer;
 event_id uuid;booking_code text;existing public.bc_pilot_bookings%rowtype;
begin
 if p_request is null or p_consent is distinct from true
 or length(trim(coalesce(p_name,''))) not between 2 and 120
 or p_phone is null or left(p_phone,1)<>'+' or substring(p_phone from 2) !~ '^[1-9][0-9]{7,14}$'
 then raise exception 'INVALID_REQUEST';end if;
 perform pg_advisory_xact_lock(hashtext(p_salon::text));
 select * into existing from public.bc_pilot_bookings where id=p_request and salon_id=p_salon;
 if found then
  if existing.client_phone<>p_phone then raise exception 'REQUEST_REUSED';end if;
  return jsonb_build_object('confirmed',true,'code',existing.booking_code,
   'start',existing.starts_at,'service',existing.service_label);
 end if;
 select * into conf from public.bc_pilot_config where salon_id=p_salon for update;
 select * into salon from public.bc_salons where id=p_salon;
 if conf.enabled is distinct from true or conf.invite_code is distinct from p_code
 or salon.archived_at is not null then raise exception 'PILOT_CLOSED';end if;
 if p_date<(now() at time zone 'Europe/Bucharest')::date
 or p_date>(now() at time zone 'Europe/Bucharest')::date+14
 or mod(extract(minute from p_time)::integer,30)<>0 or
 extract(second from p_time)<>0 then raise exception 'INVALID_SLOT';end if;
 select value into service from jsonb_array_elements(conf.services) where value->>'name'=p_service;
 if service is null then raise exception 'UNKNOWN_SERVICE';end if;
 duration:=(service->>'duration')::integer;
 if p_time<conf.opens or p_time+make_interval(mins=>duration)>conf.closes then
 raise exception 'OUTSIDE_OPENING_HOURS';end if;
 start_utc:=(p_date+p_time)at time zone 'Europe/Bucharest';
 end_utc:=start_utc+make_interval(mins=>duration);
 if start_utc<now()+interval '45 minutes' then raise exception 'TOO_SOON';end if;
 if (select count(*) from public.bc_pilot_bookings b
 join public.bc_pro_calendar_events e on e.id=b.calendar_event_id
 where b.salon_id=p_salon and b.client_phone=p_phone and e.status<>'cancelled'
 and b.created_at>now()-interval '7 days')>=3 then raise exception 'WEEKLY_BOOKING_LIMIT';end if;
 if exists(select 1 from public.bc_pro_calendar_events e where e.salon_id=p_salon
 and e.status<>'cancelled' and tstzrange(e.starts_at,e.ends_at,'[)')
 && tstzrange(start_utc,end_utc,'[)'))then raise exception 'SLOT_TAKEN';end if;
 insert into public.bc_pro_calendar_events(salon_id,starts_at,ends_at,client_display_name,
 service_label,status,source_provider)
 values(p_salon,start_utc,end_utc,trim(p_name),'[BARBERCRAFT] '||p_service,'confirmed','barbercraft_pilot')
 returning id into event_id;
 booking_code:='BC-'||upper(encode(extensions.gen_random_bytes(5),'hex'));
 insert into public.bc_pilot_bookings(id,salon_id,calendar_event_id,client_name,client_phone,
 service_label,price_ron,starts_at,ends_at,booking_code)
 values(p_request,p_salon,event_id,trim(p_name),p_phone,p_service,(service->>'price')::integer,
 start_utc,end_utc,booking_code);
 return jsonb_build_object('confirmed',true,'code',booking_code,'start',start_utc,
 'service',p_service,'price_ron',(service->>'price')::integer,'salon',salon.name);
end;$$;
revoke all on function public.bc_pilot_book(uuid,text,uuid,text,date,time,text,text,boolean) from public;
grant execute on function public.bc_pilot_book(uuid,text,uuid,text,date,time,text,text,boolean) to anon,authenticated;
