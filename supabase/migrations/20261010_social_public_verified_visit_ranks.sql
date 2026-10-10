-- The public rank reveals only aggregated verified haircut totals for explicitly
-- public Client social profiles; private or unknown profiles reveal nothing.
create or replace function public.bc_social_client_rank(p_user uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid:=(select auth.uid()); completed int;name text:='Începător';next_name text;goal int;
begin
 if p_user is null or not exists(select 1 from public.bc_social_profiles p
   where p.user_id=p_user and (p.is_public or p.user_id=u)) then return null;end if;
 if public.bc_social_is_barber(p_user) then return null;end if;
 completed:=public.bc_social_client_verified_haircut_count(p_user);
 name:=case when completed>=100 then 'Diamant' when completed>=65 then 'Platină'
 when completed>=45 then 'Aur II' when completed>=30 then 'Aur I'
 when completed>=20 then 'Argint II' when completed>=12 then 'Argint I'
 when completed>=6 then 'Bronz II' when completed>=3 then 'Bronz I' else 'Începător' end;
 select t.rank_name,t.threshold into next_name,goal from
 (values ('Bronz I',3),('Bronz II',6),('Argint I',12),('Argint II',20),
 ('Aur I',30),('Aur II',45),('Platină',65),('Diamant',100)) t(rank_name,threshold)
 where t.threshold>completed order by t.threshold limit 1;
 return jsonb_build_object('rank',name,'visits',completed,'next_rank',next_name,
 'next_goal',goal,'at_max',goal is null);
end $$;
revoke all on function public.bc_social_client_rank(uuid) from public,anon;
grant execute on function public.bc_social_client_rank(uuid) to authenticated,anon;
