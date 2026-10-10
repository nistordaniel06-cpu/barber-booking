-- Hotfix for already-applied favorite functions: JSON portal guard.
create or replace function public.bc_favorite_toggle(p_kind text,p_target uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=(select auth.uid()); added boolean:=false;
begin
 if u is null or not coalesce((public.bc_portal_access('client')->>'allowed')::boolean,false) then raise exception 'CLIENT_LOGIN_REQUIRED' using errcode='42501';end if;
 if p_target is null or not public.bc_favorite_allowed(p_kind,p_target) then raise exception 'PROFILE_NOT_AVAILABLE' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text||':'||p_kind||':'||p_target::text,0));
 if exists(select 1 from public.bc_client_favorites where user_id=u and kind=p_kind and target_id=p_target) then
  delete from public.bc_client_favorites where user_id=u and kind=p_kind and target_id=p_target;
 else
  insert into public.bc_client_favorites(user_id,kind,target_id) values(u,p_kind,p_target);
  added:=true;
 end if;
 return jsonb_build_object('saved',added,'count',(select count(*) from public.bc_client_favorites where kind=p_kind and target_id=p_target));
end $$;

create or replace function public.bc_favorites_mine()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid:=(select auth.uid());
begin
 if u is null or not coalesce((public.bc_portal_access('client')->>'allowed')::boolean,false) then raise exception 'CLIENT_LOGIN_REQUIRED' using errcode='42501';end if;
 return coalesce((
  select jsonb_agg(jsonb_build_object('kind',q.kind,'id',q.target_id,'title',
    case when q.kind='salon' then (select s.name from public.bc_public_salon_catalog s where s.id=q.target_id)
      else (select p.display_name from public.bc_social_profiles p where p.user_id=q.target_id) end,
    'subtitle',case when q.kind='salon' then (select s.city from public.bc_public_salon_catalog s where s.id=q.target_id)
      else (select '@'||p.handle from public.bc_social_profiles p where p.user_id=q.target_id) end,
    'count',(select count(*) from public.bc_client_favorites x where x.kind=q.kind and x.target_id=q.target_id))
   order by q.created_at desc)
  from (select * from public.bc_client_favorites where user_id=u order by created_at desc limit 150) q
  where public.bc_favorite_allowed(q.kind,q.target_id)
 ),'[]'::jsonb);
end $$;
