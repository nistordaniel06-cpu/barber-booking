-- BARBERCRAFT: Client social visibility unlocks after 3 independently
-- verified finished haircuts. A Client profile is never created or published
-- without the Client choosing "Save profile". Existing private profiles
-- remain private; this migration does not publish anyone's data.
create or replace function public.bc_social_privacy_eligibility()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare u uuid:=(select auth.uid());visits int; pro boolean;previous_public boolean;
begin
 if u is null then raise exception 'LOGIN_REQUIRED' using errcode='42501';end if;
 pro:=public.bc_social_is_barber(u);
 visits:=case when pro then 0 else public.bc_social_client_verified_haircut_count(u) end;
 select is_public into previous_public from public.bc_social_profiles where user_id=u;
 return jsonb_build_object('verified_visits',visits,'required_visits',3,
  'can_make_private',pro or visits>=3 or previous_public is false,
  'kind',case when pro then 'barber' else 'client' end,
  'published',previous_public is true);
end $$;
revoke all on function public.bc_social_privacy_eligibility() from public,anon;
grant execute on function public.bc_social_privacy_eligibility() to authenticated;

create or replace function public.bc_social_profile_save(
 p_handle text,p_name text,p_bio text,p_public boolean,p_messages boolean)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare u uuid;k text;existing_public boolean;is_pro boolean;haircuts integer;
begin
 u:=(select auth.uid());
 if u is null then raise exception 'LOGIN_REQUIRED' using errcode='42501';end if;
 if coalesce(p_handle,'') !~ '^[a-z0-9_]{3,25}$'
 or length(trim(coalesce(p_name,''))) not between 2 and 70
 or length(coalesce(p_bio,''))>300
 then raise exception 'INVALID_PROFILE' using errcode='22023';end if;
 is_pro:=public.bc_social_is_barber(u);
 k:=case when is_pro then 'barber' else 'client' end;
 select is_public into existing_public from public.bc_social_profiles where user_id=u;
 if not is_pro and not coalesce(p_public,false) and
    coalesce(existing_public,true) and
    public.bc_social_client_verified_haircut_count(u)<3
 then
  raise exception 'THREE_VERIFIED_VISITS_FOR_PRIVACY' using errcode='23514';
 end if;
 insert into public.bc_social_profiles(user_id,handle,display_name,bio,kind,is_public,allow_messages)
 values(u,p_handle,trim(p_name),trim(coalesce(p_bio,'')),k,coalesce(p_public,false),coalesce(p_messages,false))
 on conflict(user_id) do update set handle=excluded.handle,display_name=excluded.display_name,
 bio=excluded.bio,kind=excluded.kind,is_public=excluded.is_public,
 allow_messages=excluded.allow_messages,updated_at=now();
 return jsonb_build_object('saved',true,'kind',k,'is_public',coalesce(p_public,false));
end $$;
revoke all on function public.bc_social_profile_save(text,text,text,boolean,boolean) from public,anon;
grant execute on function public.bc_social_profile_save(text,text,text,boolean,boolean) to authenticated;
