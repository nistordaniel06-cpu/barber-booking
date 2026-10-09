-- Inbox lists mutual contacts only, never leaks third-party messages.
create or replace function public.bc_social_mutuals()
returns jsonb language plpgsql stable security definer set search_path=''
as $$declare u uuid;begin
 u:=(select auth.uid());if u is null then raise exception 'LOGIN_REQUIRED';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('user_id',p.user_id,
 'handle',p.handle,'display_name',p.display_name,'kind',p.kind,
 'last_at',(select max(sent_at) from public.bc_social_messages m
 where (m.sender=u and m.recipient=p.user_id) or(m.recipient=u and m.sender=p.user_id)))
 order by p.display_name)
 from public.bc_social_profiles p
 where p.user_id<>u and public.bc_social_can_message(u,p.user_id)),'[]'::jsonb);
end;$$;
revoke all on function public.bc_social_mutuals() from public,anon;
grant execute on function public.bc_social_mutuals() to authenticated;
create table if not exists public.bc_social_reports(
 id uuid primary key default gen_random_uuid(),
 reporter uuid not null references auth.users(id) on delete cascade,
 reported uuid not null references auth.users(id) on delete cascade,
 reason text not null check(length(trim(reason)) between 10 and 350),
 created_at timestamptz not null default now(),check(reporter<>reported)
);
alter table public.bc_social_reports enable row level security;
revoke all on public.bc_social_reports from public,anon,authenticated;
create or replace function public.bc_social_report(p_user uuid,p_reason text)
returns boolean language plpgsql security definer set search_path=''
as $$declare u uuid;begin
 u:=(select auth.uid());if u is null or u=p_user then raise exception 'INVALID_REPORT';end if;
 if length(trim(coalesce(p_reason,''))) not between 10 and 350 then raise exception 'INVALID_REASON';end if;
 if (select count(*) from public.bc_social_reports where reporter=u and created_at>now()-interval '24 hours')>=5
 then raise exception 'REPORT_LIMIT';end if;
 insert into public.bc_social_reports(reporter,reported,reason) values(u,p_user,trim(p_reason));
 return true;
end;$$;
revoke all on function public.bc_social_report(uuid,text) from public,anon;
grant execute on function public.bc_social_report(uuid,text) to authenticated;
