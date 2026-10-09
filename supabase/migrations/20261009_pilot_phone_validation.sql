-- Safe E.164 validation without backslash-escaping ambiguity in PostgreSQL regexp
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
 or p_phone !~ '^\\+[1-9][0-9]{7,14}$'
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
 booking_code:='BC-'||upper(encode(gen_random_bytes(5),'hex'));
 insert into public.bc_pilot_bookings(id,salon_id,calendar_event_id,client_name,client_phone,
 service_label,price_ron,starts_at,ends_at,booking_code)
 values(p_request,p_salon,event_id,trim(p_name),p_phone,p_service,(service->>'price')::integer,
 start_utc,end_utc,booking_code);
 return jsonb_build_object('confirmed',true,'code',booking_code,'start',start_utc,
 'service',p_service,'price_ron',(service->>'price')::integer,'salon',salon.name);
end;$$;
revoke all on function public.bc_pilot_book(uuid,text,uuid,text,date,time,text,text,boolean) from public;
grant execute on function public.bc_pilot_book(uuid,text,uuid,text,date,time,text,text,boolean) to anon,authenticated;
