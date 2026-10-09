
-- BARBERCRAFT: configurable reward catalogue + private client Barber Passport.
-- Rewards are suggestions until activated by a platform admin; no automatic fulfilment.
create table if not exists public.bc_reward_templates (
 id uuid primary key default gen_random_uuid(),
 title text not null unique check (char_length(title) between 3 and 90),
 description text not null default '' check (char_length(description) <= 600),
 points_cost integer not null default 0 check (points_cost between 0 and 100000),
 category text not null default 'beneficiu' check (category in ('beneficiu','reducere','serviciu','produs','vip')),
 stock integer check (stock is null or stock between 0 and 100000),
 is_active boolean not null default false,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.bc_reward_templates enable row level security;
revoke all on public.bc_reward_templates from public, anon, authenticated;
grant select on public.bc_reward_templates to anon, authenticated;
drop policy if exists bc_rewards_visible on public.bc_reward_templates;
create policy bc_rewards_visible on public.bc_reward_templates for select to anon,authenticated
 using (is_active=true);
insert into public.bc_reward_templates(title,description,points_cost,category,stock,is_active) values
 ('Upgrade spălat & styling','Propunere: serviciu suplimentar, numai la saloanele participante și după confirmare.',250,'serviciu',null,false),
 ('Reducere 10% la următoarea vizită','Propunere: valabilă doar cu buget aprobat, reguli publicate și salon înscris.',400,'reducere',null,false),
 ('Tuns gratuit','Propunere: voucher limitat, acordat doar după validarea vizitelor și a disponibilității.',1200,'serviciu',null,false),
 ('Kit de îngrijire BARBERCRAFT','Propunere: produs fizic oferit de partener, în limita stocului confirmat.',1800,'produs',null,false),
 ('Membru VIP — 30 de zile','Propunere: rang și avantaje definite de salon, fără acces automat până la lansare.',900,'vip',null,false)
on conflict (title) do nothing;
create or replace function public.bc_admin_reward_list()
returns setof public.bc_reward_templates language plpgsql security definer set search_path = ''
as $$
begin
 if (select auth.uid()) is null or not public.bc_is_platform_admin() then raise exception 'Acces refuzat'; end if;
 return query select * from public.bc_reward_templates order by created_at, title;
end; $$;
revoke all on function public.bc_admin_reward_list() from public,anon;
grant execute on function public.bc_admin_reward_list() to authenticated;
create or replace function public.bc_admin_reward_save(
 p_id uuid, p_title text, p_description text, p_points_cost integer, p_category text,
 p_stock integer, p_is_active boolean
) returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_id uuid;
begin
 if (select auth.uid()) is null or not public.bc_is_platform_admin() then raise exception 'Acces refuzat'; end if;
 if length(trim(coalesce(p_title,''))) not between 3 and 90
    or length(coalesce(p_description,'')) > 600
    or coalesce(p_points_cost,-1) not between 0 and 100000
    or p_category not in ('beneficiu','reducere','serviciu','produs','vip')
    or (p_stock is not null and p_stock not between 0 and 100000)
 then raise exception 'Date de recompensă invalide'; end if;
 if p_id is null then
   insert into public.bc_reward_templates(title,description,points_cost,category,stock,is_active)
   values(trim(p_title),trim(coalesce(p_description,'')),p_points_cost,p_category,p_stock,coalesce(p_is_active,false))
   returning id into v_id;
 else
   update public.bc_reward_templates set title=trim(p_title),description=trim(coalesce(p_description,'')),
   points_cost=p_points_cost,category=p_category,stock=p_stock,is_active=coalesce(p_is_active,false),updated_at=now()
   where id=p_id returning id into v_id;
   if v_id is null then raise exception 'Recompensa nu există'; end if;
 end if;
 return v_id;
end; $$;
revoke all on function public.bc_admin_reward_save(uuid,text,text,integer,text,integer,boolean) from public,anon;
grant execute on function public.bc_admin_reward_save(uuid,text,text,integer,text,integer,boolean) to authenticated;
create table if not exists public.bc_passport_notes (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
 salon_name text not null check (char_length(salon_name) between 2 and 120),
 rating integer not null check (rating between 1 and 5),
 note text not null default '' check (char_length(note) <= 1000),
 created_at timestamptz not null default now()
);
create index if not exists bc_passport_notes_owner on public.bc_passport_notes(user_id,created_at desc);
alter table public.bc_passport_notes enable row level security;
revoke all on public.bc_passport_notes from public,anon,authenticated;
grant select,insert,delete on public.bc_passport_notes to authenticated;
drop policy if exists bc_passport_notes_owner_select on public.bc_passport_notes;
create policy bc_passport_notes_owner_select on public.bc_passport_notes for select to authenticated using (user_id=(select auth.uid()));
drop policy if exists bc_passport_notes_owner_insert on public.bc_passport_notes;
create policy bc_passport_notes_owner_insert on public.bc_passport_notes for insert to authenticated with check (user_id=(select auth.uid()));
drop policy if exists bc_passport_notes_owner_delete on public.bc_passport_notes;
create policy bc_passport_notes_owner_delete on public.bc_passport_notes for delete to authenticated using (user_id=(select auth.uid()));
create table if not exists public.bc_passport_photos (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
 object_path text not null unique,
 caption text not null default '' check (char_length(caption) <= 160),
 created_at timestamptz not null default now(),
 constraint bc_passport_photo_owner_path check (split_part(object_path,'/',1)=user_id::text)
);
create index if not exists bc_passport_photos_owner on public.bc_passport_photos(user_id,created_at desc);
alter table public.bc_passport_photos enable row level security;
revoke all on public.bc_passport_photos from public,anon,authenticated;
grant select,insert,delete on public.bc_passport_photos to authenticated;
drop policy if exists bc_passport_photos_owner_select on public.bc_passport_photos;
create policy bc_passport_photos_owner_select on public.bc_passport_photos for select to authenticated using(user_id=(select auth.uid()));
drop policy if exists bc_passport_photos_owner_insert on public.bc_passport_photos;
create policy bc_passport_photos_owner_insert on public.bc_passport_photos for insert to authenticated with check(user_id=(select auth.uid()));
drop policy if exists bc_passport_photos_owner_delete on public.bc_passport_photos;
create policy bc_passport_photos_owner_delete on public.bc_passport_photos for delete to authenticated using(user_id=(select auth.uid()));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('bc-passport','bc-passport',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
drop policy if exists bc_passport_storage_read on storage.objects;
create policy bc_passport_storage_read on storage.objects for select to authenticated
using(bucket_id='bc-passport' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists bc_passport_storage_upload on storage.objects;
create policy bc_passport_storage_upload on storage.objects for insert to authenticated
with check(bucket_id='bc-passport' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists bc_passport_storage_delete on storage.objects;
create policy bc_passport_storage_delete on storage.objects for delete to authenticated
using(bucket_id='bc-passport' and (storage.foldername(name))[1]=(select auth.uid())::text);
create or replace function public.bc_passport_verified_visits()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare v_user uuid;
begin
 v_user:=(select auth.uid());
 if v_user is null then raise exception 'Autentificare necesară'; end if;
 return jsonb_build_object(
 'total_visits',(select count(*) from public.bc_tw_activity where user_id=v_user),
 'recent',coalesce((select jsonb_agg(jsonb_build_object('date',t.occurred_at,'salon_id',t.salon_id,'xp',t.awarded_xp,'points',t.loyalty_points) order by t.occurred_at desc)
 from (select occurred_at,salon_id,awarded_xp,loyalty_points from public.bc_tw_activity where user_id=v_user order by occurred_at desc limit 30) t),'[]'::jsonb));
end; $$;
revoke all on function public.bc_passport_verified_visits() from public,anon;
grant execute on function public.bc_passport_verified_visits() to authenticated;
