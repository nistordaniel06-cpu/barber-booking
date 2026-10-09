-- Post-booking usability feedback, tied to a real confirmed pilot booking code.
create table if not exists public.bc_pilot_feedback(
 booking_id uuid primary key references public.bc_pilot_bookings(id) on delete cascade,
 rating smallint not null check(rating between 1 and 5),
 comment text not null check(length(trim(comment)) between 5 and 500),
 created_at timestamptz not null default now()
);
alter table public.bc_pilot_feedback enable row level security;
revoke all on public.bc_pilot_feedback from public,anon,authenticated;

create or replace function public.bc_pilot_feedback_send(p_booking_code text,p_rating integer,p_comment text)
returns boolean language plpgsql security definer set search_path=''
as $$
declare booking uuid;
begin
 if p_rating not between 1 and 5 or length(trim(coalesce(p_comment,''))) not between 5 and 500
 then raise exception 'INVALID_FEEDBACK';end if;
 select b.id into booking from public.bc_pilot_bookings b
 join public.bc_pro_calendar_events e on e.id=b.calendar_event_id
 where b.booking_code=upper(trim(coalesce(p_booking_code,''))) and e.status='confirmed';
 if booking is null then raise exception 'BOOKING_NOT_FOUND';end if;
 insert into public.bc_pilot_feedback(booking_id,rating,comment)
 values(booking,p_rating,trim(p_comment));
 return true;
end;$$;
revoke all on function public.bc_pilot_feedback_send(text,integer,text) from public;
grant execute on function public.bc_pilot_feedback_send(text,integer,text) to anon,authenticated;

create or replace function public.bc_pilot_owner_state(p_salon uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare conf public.bc_pilot_config%rowtype;
begin
 if (select auth.uid()) is null or not exists(
 select 1 from public.bc_salon_members
 where salon_id=p_salon and user_id=(select auth.uid()) and role in ('owner','manager'))
 then raise exception 'OWNER_OR_MANAGER_REQUIRED';end if;
 select * into conf from public.bc_pilot_config where salon_id=p_salon;
 return jsonb_build_object('salon',p_salon,'enabled',coalesce(conf.enabled,false),
 'invite_code',conf.invite_code,'services',coalesce(conf.services,'[]'::jsonb),
 'opens',coalesce(to_char(conf.opens,'HH24:MI'),'10:00'),
 'closes',coalesce(to_char(conf.closes,'HH24:MI'),'19:00'),
 'bookings',(select coalesce(jsonb_agg(jsonb_build_object(
 'id',b.id,'name',b.client_name,'phone',b.client_phone,'service',b.service_label,
 'starts_at',b.starts_at,'code',b.booking_code,'status',e.status)
 order by b.starts_at desc),'[]'::jsonb)
 from (select * from public.bc_pilot_bookings where salon_id=p_salon
 order by starts_at desc limit 35)b
 join public.bc_pro_calendar_events e on e.id=b.calendar_event_id),
 'feedback',(select coalesce(jsonb_agg(jsonb_build_object('rating',f.rating,'comment',f.comment,
 'date',f.created_at,'code',b.booking_code) order by f.created_at desc),'[]'::jsonb)
 from public.bc_pilot_feedback f join public.bc_pilot_bookings b on b.id=f.booking_id
 where b.salon_id=p_salon));
end;$$;
revoke all on function public.bc_pilot_owner_state(uuid) from public,anon;
grant execute on function public.bc_pilot_owner_state(uuid) to authenticated;
