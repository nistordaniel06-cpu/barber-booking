-- BARBERCRAFT: real multi-device bookings. Apply to a dedicated Supabase project.
create extension if not exists btree_gist;
create table if not exists public.bc_barbers (
 id integer primary key, name text not null, title text not null default '', avatar_url text not null default '',
 rating numeric(3,2) not null default 5, experience_years integer not null default 0,
 is_active boolean not null default true
);
create table if not exists public.bc_services (
 id integer primary key, category text not null, name text not null,
 duration_min integer not null check (duration_min between 10 and 240),
 price integer not null check (price >= 0), badge text not null default '',
 is_active boolean not null default true
);
create table if not exists public.bc_appointments (
 id bigint generated always as identity primary key,
 booking_code text not null unique default ('BC-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,10))),
 client_name text not null check (char_length(client_name) between 2 and 120),
 client_phone text not null check (client_phone ~ '^\\+[1-9][0-9]{7,14}$'),
 client_email text,
 barber_id integer not null references public.bc_barbers(id),
 service_id integer not null references public.bc_services(id),
 appointment_date date not null,
 start_time time not null,
 end_time time not null,
 price integer not null,
 status text not null default 'confirmed' check (status in ('confirmed','cancelled','completed','no_show')),
 notes text not null default '',
 created_at timestamptz not null default now(),
 booking_window tsrange generated always as (
  tsrange(appointment_date + start_time,appointment_date + end_time,'[)')
 ) stored,
 constraint bc_booking_positive_duration check (end_time > start_time),
 constraint bc_no_overlapping_active_bookings exclude using gist
 (barber_id with =, booking_window with &&) where (status = 'confirmed')
);
create index if not exists bc_day_idx on public.bc_appointments(appointment_date, barber_id);
alter table public.bc_barbers enable row level security;
alter table public.bc_services enable row level security;
alter table public.bc_appointments enable row level security;
revoke all on public.bc_appointments from anon, authenticated;
revoke all on public.bc_barbers from anon, authenticated;
revoke all on public.bc_services from anon, authenticated;
insert into public.bc_barbers(id,name,title,avatar_url,rating,experience_years) values
 (1,'Alexandru ''Blade'' Popa','Master Barber & Educator','https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=160&q=75',4.98,8),
 (2,'Vlad Ionescu','Senior Fade & Beard Specialist','https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=160&q=75',4.92,5),
 (3,'Marius Dan','Creative Stylist','https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=160&q=75',4.88,4)
on conflict (id) do nothing;
insert into public.bc_services(id,category,name,duration_min,price,badge) values
(1,'Tuns & Styling','Skin Fade / Taper Fade Signature',45,90,'POPULAR'),
(2,'Tuns & Styling','Tuns Clasic din Foarfecă',45,80,''),
(3,'Barbă & Tratamente','Aranjat Barbă + Brici & Prosop Cald',30,60,'RECOMANDAT'),
(4,'Pachete VIP Combo','VIP Full Experience (Tuns + Barbă + Tratament Facial)',75,150,'VIP'),
(5,'Pachete VIP Combo','Combo Tuns + Barbă Standard',60,130,''),
(6,'Barbă & Tratamente','Tratament Păr & Mască Neagră',30,50,''),
(7,'Tuns & Styling','Tuns Copil (sub 12 ani)',35,65,'')
on conflict (id) do nothing;
create or replace function public.bc_create_booking(
 p_name text,p_phone text,p_email text,p_barber integer,p_service integer,
 p_date date,p_start time,p_notes text default ''
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
 s record; b record; v_end time; v_barber integer; v_booking public.bc_appointments%rowtype;
begin
 if p_name is null or length(trim(p_name)) not between 2 and 120
    or p_phone !~ '^\\+[1-9][0-9]{7,14}$'
    or length(coalesce(p_notes,'')) > 500
    or (p_email is not null and (length(p_email)>180 or p_email !~ '^[^@[:space:]]+@[^@[:space:]]+\\.[^@[:space:]]+$')) then
   raise exception 'INVALID_INPUT' using errcode = '22023';
 end if;
 select * into s from public.bc_services where id=p_service and is_active=true;
 if not found then raise exception 'UNKNOWN_SERVICE' using errcode='22023'; end if;
 v_end := p_start + make_interval(mins=>s.duration_min);
 if p_date < (now() at time zone 'Europe/Bucharest')::date
 or p_date > (now() at time zone 'Europe/Bucharest')::date + 90
 or (p_date + p_start) <= (now() at time zone 'Europe/Bucharest')
 or p_start < time '09:00' or v_end > time '20:30'
 or v_end <= p_start then raise exception 'INVALID_SLOT' using errcode='22023'; end if;
 if p_barber is not null and p_barber <> 0 then
   select * into b from public.bc_barbers where id=p_barber and is_active=true;
   if not found then raise exception 'UNKNOWN_BARBER' using errcode='22023'; end if;
   v_barber:=p_barber;
 else
   select id into v_barber from public.bc_barbers where is_active=true
   and not exists (
      select 1 from public.bc_appointments a where a.barber_id=bc_barbers.id
       and a.status='confirmed'
       and a.booking_window && tsrange(p_date+p_start,p_date+v_end,'[)')
   ) order by id limit 1;
   if v_barber is null then raise exception 'SLOT_TAKEN' using errcode='23P01'; end if;
 end if;
 insert into public.bc_appointments(client_name,client_phone,client_email,barber_id,service_id,appointment_date,start_time,end_time,price,notes)
 values (trim(p_name),p_phone,nullif(trim(coalesce(p_email,'')),''),v_barber,p_service,p_date,p_start,v_end,s.price,coalesce(p_notes,''))
 returning * into v_booking;
 return jsonb_build_object('id',v_booking.id,'booking_code',v_booking.booking_code,
 'barber_id',v_booking.barber_id,'service_id',v_booking.service_id,
 'appointment_date',v_booking.appointment_date,'start_time',to_char(v_booking.start_time,'HH24:MI'),
 'end_time',to_char(v_booking.end_time,'HH24:MI'),'status',v_booking.status,'price',s.price,
 'client_name',v_booking.client_name,'client_phone',v_booking.client_phone,
 'service_name',s.name,'barber_name',(select name from public.bc_barbers where id=v_booking.barber_id));
exception when exclusion_violation then
 raise exception 'SLOT_TAKEN' using errcode='23P01';
end;
$$;
revoke all on function public.bc_create_booking(text,text,text,integer,integer,date,time,text) from public, anon, authenticated;
grant execute on function public.bc_create_booking(text,text,text,integer,integer,date,time,text) to service_role;
