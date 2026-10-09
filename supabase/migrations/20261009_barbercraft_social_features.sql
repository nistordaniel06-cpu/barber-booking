-- Verified-service reviews, professional portfolios and community proposals.
create or replace function public.bc_pro_recent_checkins(p_salon uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$declare u uuid;begin
 u:=(select auth.uid());
 if u is null or not exists(select 1 from public.bc_salon_members where salon_id=p_salon and user_id=u)
 then raise exception 'NOT_SALON_STAFF';end if;
 return coalesce((select jsonb_agg(jsonb_build_object(
 'id',x.id,'name',coalesce(nullif(trim(p.display_name),''),'Client'),
 'date',x.checked_at,'completed',x.completed) order by x.checked_at desc)
 from (select q.id,q.user_id,q.checked_at,
 exists(select 1 from public.bc_service_visits v where v.checkin_id=q.id) as completed
 from public.bc_passport_checkins q where q.salon_id=p_salon and q.checked_at>now()-interval '48 hours'
 order by q.checked_at desc limit 35)x
 left join public.bc_profiles p on p.user_id=x.user_id),'[]'::jsonb);
end;$$;
revoke all on function public.bc_pro_recent_checkins(uuid) from public,anon;
grant execute on function public.bc_pro_recent_checkins(uuid) to authenticated;
create or replace function public.bc_service_visit_complete(p_checkin uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$declare u uuid;c record;newid uuid;
begin
 u:=(select auth.uid());if u is null then raise exception 'LOGIN_REQUIRED';end if;
 select * into c from public.bc_passport_checkins where id=p_checkin for update;
 if not found or not exists(select 1 from public.bc_salon_members where user_id=u and salon_id=c.salon_id)
 then raise exception 'NOT_SALON_STAFF';end if;
 if c.checked_at<now()-interval '48 hours' or c.checked_at>now()+interval '5 minutes'
 then raise exception 'CHECKIN_EXPIRED';end if;
 if exists(select 1 from public.bc_service_visits where checkin_id=c.id)
 then raise exception 'ALREADY_COMPLETED';end if;
 perform pg_advisory_xact_lock(hashtextextended('bc-service:'||c.user_id::text||':'||c.salon_id::text,0));
 if exists(select 1 from public.bc_service_visits where user_id=c.user_id and salon_id=c.salon_id
 and (verified_at at time zone 'Europe/Bucharest')::date=(now() at time zone 'Europe/Bucharest')::date)
 then raise exception 'ALREADY_VERIFIED_TODAY';end if;
 insert into public.bc_service_visits(user_id,salon_id,checkin_id,verified_by)
 values(c.user_id,c.salon_id,c.id,u) returning id into newid;
 -- No XP and no bonus points minted here.
 return jsonb_build_object('visit_id',newid,'recorded',true,
 'note','Vizită confirmată de personal după check-in; fără XP automat');
end;$$;
revoke all on function public.bc_service_visit_complete(uuid) from public,anon;
grant execute on function public.bc_service_visit_complete(uuid) to authenticated;
create or replace function public.bc_my_reviewable_visits()
returns jsonb language plpgsql stable security definer set search_path=''
as $$declare u uuid;begin
 u:=(select auth.uid());if u is null then raise exception 'LOGIN_REQUIRED';end if;
 return coalesce((select jsonb_agg(jsonb_build_object(
 'id',v.id,'salon_id',v.salon_id,'salon',s.name,'at',v.verified_at,
 'reviewed',exists(select 1 from public.bc_verified_reviews r where r.visit_id=v.id))
 order by v.verified_at desc)
 from (select * from public.bc_service_visits where user_id=u order by verified_at desc limit 40)v
 join public.bc_salons s on s.id=v.salon_id),'[]'::jsonb);
end;$$;
revoke all on function public.bc_my_reviewable_visits() from public,anon;
grant execute on function public.bc_my_reviewable_visits() to authenticated;
create or replace function public.bc_verified_review_submit(p_visit uuid,p_stars integer,p_body text)
returns uuid language plpgsql security definer set search_path=''
as $$declare u uuid;v record;review_id uuid;
begin
 u:=(select auth.uid());if u is null then raise exception 'LOGIN_REQUIRED';end if;
 select * into v from public.bc_service_visits where id=p_visit and user_id=u;
 if not found then raise exception 'VERIFIED_VISIT_REQUIRED';end if;
 if exists(select 1 from public.bc_verified_reviews where visit_id=p_visit)
 then raise exception 'REVIEW_ALREADY_SUBMITTED';end if;
 if p_stars not between 1 and 5 or length(trim(coalesce(p_body,''))) not between 10 and 1000
 then raise exception 'INVALID_REVIEW';end if;
 insert into public.bc_verified_reviews(visit_id,user_id,salon_id,stars,body)
 values(v.id,u,v.salon_id,p_stars,trim(p_body)) returning id into review_id;
 return review_id;
end;$$;
revoke all on function public.bc_verified_review_submit(uuid,integer,text) from public,anon;
grant execute on function public.bc_verified_review_submit(uuid,integer,text) to authenticated;
create or replace function public.bc_verified_reviews_list(p_salon uuid)
returns jsonb language sql stable security definer set search_path=''
as $$
select coalesce((select jsonb_agg(jsonb_build_object(
 'stars',r.stars,'body',r.body,'date',r.created_at,'verified',true,
 'author',coalesce((select p.display_name from public.bc_social_profiles p
 where p.user_id=r.user_id and p.is_public),'Client verificat'))
 order by r.created_at desc)
 from (select * from public.bc_verified_reviews where salon_id=p_salon
 order by created_at desc limit 30)r),'[]'::jsonb);
$$;
revoke all on function public.bc_verified_reviews_list(uuid) from public;
grant execute on function public.bc_verified_reviews_list(uuid) to anon,authenticated;
create or replace function public.bc_social_my_verified_reviews()
returns jsonb language plpgsql stable security definer set search_path=''
as $$declare u uuid;begin
 u:=(select auth.uid());if u is null then raise exception 'LOGIN_REQUIRED';end if;
 return coalesce((select jsonb_agg(jsonb_build_object(
 'salon',s.name,'stars',r.stars,'body',r.body,'at',r.created_at) order by r.created_at desc)
 from (select * from public.bc_verified_reviews where user_id=u order by created_at desc limit 30)r
 join public.bc_salons s on s.id=r.salon_id),'[]'::jsonb);
end;$$;
revoke all on function public.bc_social_my_verified_reviews() from public,anon;
grant execute on function public.bc_social_my_verified_reviews() to authenticated;
create or replace function public.bc_social_barber_job_add(
 p_name text,p_title text,p_start integer,p_end integer default null)
returns uuid language plpgsql security definer set search_path=''
as $$declare u uuid;result uuid;
begin
 u:=(select auth.uid());
 if u is null or not public.bc_social_is_barber(u) then raise exception 'BARBER_ONLY';end if;
 if length(trim(coalesce(p_name,''))) not between 2 and 110
 or length(trim(coalesce(p_title,''))) not between 2 and 80
 or p_start not between 1950 and 2100 or (p_end is not null and p_end not between p_start and 2100)
 then raise exception 'INVALID_JOB';end if;
 if (select count(*) from public.bc_barber_jobs where user_id=u)>=25 then raise exception 'JOB_LIMIT';end if;
 insert into public.bc_barber_jobs(user_id,salon_name,role_title,start_year,end_year)
 values(u,trim(p_name),trim(p_title),p_start,p_end) returning id into result;
 return result;
end;$$;
revoke all on function public.bc_social_barber_job_add(text,text,integer,integer) from public,anon;
grant execute on function public.bc_social_barber_job_add(text,text,integer,integer) to authenticated;
create or replace function public.bc_social_barber_job_delete(p_id uuid)
returns boolean language plpgsql security definer set search_path=''
as $$begin
 delete from public.bc_barber_jobs where id=p_id and user_id=(select auth.uid());
 return found;
end;$$;
revoke all on function public.bc_social_barber_job_delete(uuid) from public,anon;
grant execute on function public.bc_social_barber_job_delete(uuid) to authenticated;
create or replace function public.bc_social_barber_portfolio_add(p_path text,p_caption text)
returns uuid language plpgsql security definer set search_path=''
as $$declare u uuid;result uuid;
begin
 u:=(select auth.uid());
 if u is null or not public.bc_social_is_barber(u) then raise exception 'BARBER_ONLY';end if;
 if split_part(coalesce(p_path,''),'/',1)<>u::text or length(coalesce(p_caption,''))>160
 or not exists(select 1 from storage.objects where bucket_id='bc-barber-portfolio' and name=p_path)
 then raise exception 'INVALID_IMAGE';end if;
 if (select count(*) from public.bc_barber_portfolio where user_id=u)>=70 then raise exception 'PHOTO_LIMIT';end if;
 insert into public.bc_barber_portfolio(user_id,object_path,caption)
 values(u,p_path,coalesce(p_caption,'')) returning id into result;
 return result;
end;$$;
revoke all on function public.bc_social_barber_portfolio_add(text,text) from public,anon;
grant execute on function public.bc_social_barber_portfolio_add(text,text) to authenticated;
create or replace function public.bc_social_barber_portfolio_delete(p_id uuid)
returns text language plpgsql security definer set search_path=''
as $$declare u uuid;path text;begin
 u:=(select auth.uid());
 delete from public.bc_barber_portfolio where id=p_id and user_id=u returning object_path into path;
 return path;
end;$$;
revoke all on function public.bc_social_barber_portfolio_delete(uuid) from public,anon;
grant execute on function public.bc_social_barber_portfolio_delete(uuid) to authenticated;
create or replace function public.bc_social_barber_details(p_user uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$declare u uuid;p record;
begin
 u:=(select auth.uid());select * into p from public.bc_social_profiles where user_id=p_user;
 if not found or not public.bc_social_is_barber(p_user)
 or not (p.is_public or u=p_user)
 or exists(select 1 from public.bc_social_blocks where (blocker=u and blocked=p_user) or(blocker=p_user and blocked=u))
 then return null;end if;
 return jsonb_build_object(
 'jobs',coalesce((select jsonb_agg(jsonb_build_object('id',j.id,'salon',j.salon_name,
 'title',j.role_title,'start',j.start_year,'end',j.end_year,'verification','Declarat de profesionist')
 order by j.start_year desc) from public.bc_barber_jobs j where user_id=p_user),'[]'::jsonb),
 'portfolio',coalesce((select jsonb_agg(jsonb_build_object('id',f.id,'path',f.object_path,
 'caption',f.caption) order by f.created_at desc)
 from public.bc_barber_portfolio f where user_id=p_user),'[]'::jsonb));
end;$$;
revoke all on function public.bc_social_barber_details(uuid) from public;
grant execute on function public.bc_social_barber_details(uuid) to anon,authenticated;
create or replace function public.bc_barber_poll_create(p_title text,p_options jsonb,p_days integer default 7)
returns uuid language plpgsql security definer set search_path=''
as $$declare u uuid;outid uuid;opt jsonb;
begin
 u:=(select auth.uid());
 if u is null or not public.bc_social_is_barber(u)
 or not exists(select 1 from public.bc_social_profiles where user_id=u and is_public)
 then raise exception 'PUBLIC_BARBER_PROFILE_REQUIRED';end if;
 if length(trim(coalesce(p_title,''))) not between 10 and 180
 or p_days not between 1 and 30 or jsonb_typeof(p_options)<>'array'
 or jsonb_array_length(p_options) not between 2 and 4 then raise exception 'INVALID_POLL';end if;
 for opt in select value from jsonb_array_elements(p_options) loop
 if jsonb_typeof(opt)<>'string' or length(trim(opt #>> '{}')) not between 2 and 80
 then raise exception 'INVALID_OPTION';end if;end loop;
 if (select count(*) from public.bc_barber_polls where user_id=u and closes_at>now())>=3
 then raise exception 'TOO_MANY_ACTIVE_POLLS';end if;
 insert into public.bc_barber_polls(user_id,title,options,closes_at)
 values(u,trim(p_title),p_options,now()+make_interval(days=>p_days)) returning id into outid;
 return outid;
end;$$;
revoke all on function public.bc_barber_poll_create(text,jsonb,integer) from public,anon;
grant execute on function public.bc_barber_poll_create(text,jsonb,integer) to authenticated;
create or replace function public.bc_barber_poll_vote(p_poll uuid,p_option integer)
returns boolean language plpgsql security definer set search_path=''
as $$declare u uuid;p record;
begin
 u:=(select auth.uid());if u is null then raise exception 'LOGIN_REQUIRED';end if;
 select * into p from public.bc_barber_polls where id=p_poll;
 if not found or p.closes_at<=now() or p_option<0 or p_option>=jsonb_array_length(p.options)
 or not exists(select 1 from public.bc_social_profiles where user_id=p.user_id and is_public)
 or not public.bc_social_is_barber(p.user_id) then raise exception 'POLL_CLOSED';end if;
 insert into public.bc_barber_votes(poll_id,user_id,option_index) values(p_poll,u,p_option)
 on conflict(poll_id,user_id) do nothing;
 if not found then raise exception 'ALREADY_VOTED';end if;
 return true;
end;$$;
revoke all on function public.bc_barber_poll_vote(uuid,integer) from public,anon;
grant execute on function public.bc_barber_poll_vote(uuid,integer) to authenticated;
create or replace function public.bc_barber_polls_list(p_user uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$declare u uuid;
begin u:=(select auth.uid());
 if not exists(select 1 from public.bc_social_profiles where user_id=p_user and (is_public or user_id=u))
 or not public.bc_social_is_barber(p_user) then return '[]'::jsonb;end if;
 return coalesce((select jsonb_agg(jsonb_build_object(
 'id',p.id,'title',p.title,'options',p.options,'closes_at',p.closes_at,
 'votes',coalesce((select jsonb_agg(cnt order by ord) from
 (select idx.ord, (select count(*) from public.bc_barber_votes v where v.poll_id=p.id and v.option_index=idx.ord) as cnt
 from generate_series(0,jsonb_array_length(p.options)-1) idx(ord))x),'[]'::jsonb),
 'my_vote',(select v.option_index from public.bc_barber_votes v where v.poll_id=p.id and v.user_id=u))
 order by p.created_at desc) from
 (select * from public.bc_barber_polls where user_id=p_user order by created_at desc limit 15)p),'[]'::jsonb);
end;$$;
revoke all on function public.bc_barber_polls_list(uuid) from public;
grant execute on function public.bc_barber_polls_list(uuid) to anon,authenticated;
create or replace function public.bc_salon_idea_submit(p_salon uuid,p_title text,p_detail text)
returns uuid language plpgsql security definer set search_path=''
as $$declare u uuid;eligible integer;result uuid;
begin
 u:=(select auth.uid());if u is null then raise exception 'LOGIN_REQUIRED';end if;
 select count(*) into eligible from (
 select distinct (verified_at at time zone 'Europe/Bucharest')::date as day
 from public.bc_service_visits where user_id=u and salon_id=p_salon
 )verified_days;
 if eligible<5 then raise exception 'FIVE_VERIFIED_VISITS_REQUIRED';end if;
 if length(trim(coalesce(p_title,''))) not between 10 and 110
 or length(trim(coalesce(p_detail,''))) not between 15 and 600 then raise exception 'INVALID_IDEA';end if;
 if (select count(*) from public.bc_salon_ideas where user_id=u and salon_id=p_salon
 and created_at>now()-interval '30 days')>=3 then raise exception 'MONTHLY_IDEA_LIMIT';end if;
 insert into public.bc_salon_ideas(salon_id,user_id,title,detail)
 values(p_salon,u,trim(p_title),trim(p_detail)) returning id into result;
 return result;
end;$$;
revoke all on function public.bc_salon_idea_submit(uuid,text,text) from public,anon;
grant execute on function public.bc_salon_idea_submit(uuid,text,text) to authenticated;
create or replace function public.bc_salon_ideas_list(p_salon uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$declare u uuid;is_staff boolean;begin
 u:=(select auth.uid());is_staff=exists(select 1 from public.bc_salon_members where salon_id=p_salon and user_id=u);
 if u is null then return '[]'::jsonb;end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'title',i.title,'detail',i.detail,
 'status',i.status,'at',i.created_at,'mine',i.user_id=u) order by i.created_at desc)
 from (select * from public.bc_salon_ideas where salon_id=p_salon and (user_id=u or is_staff)
 order by created_at desc limit 50)i),'[]'::jsonb);
end;$$;
revoke all on function public.bc_salon_ideas_list(uuid) from public,anon;
grant execute on function public.bc_salon_ideas_list(uuid) to authenticated;
create or replace function public.bc_salon_idea_status(p_idea uuid,p_status text)
returns boolean language plpgsql security definer set search_path=''
as $$declare u uuid;s uuid;begin
 u:=(select auth.uid());select salon_id into s from public.bc_salon_ideas where id=p_idea;
 if u is null or s is null or not public.bc_is_salon_admin(s) then raise exception 'SALON_MANAGER_REQUIRED';end if;
 if p_status not in ('proposed','considering','planned','done','declined')
 then raise exception 'INVALID_STATUS';end if;
 update public.bc_salon_ideas set status=p_status where id=p_idea;return true;
end;$$;
revoke all on function public.bc_salon_idea_status(uuid,text) from public,anon;
grant execute on function public.bc_salon_idea_status(uuid,text) to authenticated;
create or replace function public.bc_my_idea_eligibility()
returns jsonb language plpgsql stable security definer set search_path=''
as $$declare u uuid;begin
 u:=(select auth.uid());if u is null then raise exception 'LOGIN_REQUIRED';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('salon_id',x.salon_id,'salon',s.name,
 'visits',x.days,'eligible',x.days>=5) order by x.days desc)
 from (select salon_id,count(distinct (verified_at at time zone 'Europe/Bucharest')::date) days
 from public.bc_service_visits where user_id=u group by salon_id)x
 join public.bc_salons s on s.id=x.salon_id),'[]'::jsonb);
end;$$;
revoke all on function public.bc_my_idea_eligibility() from public,anon;
grant execute on function public.bc_my_idea_eligibility() to authenticated;
