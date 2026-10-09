-- Admin can remove an import draft and its unlinked published copy.
-- Never delete or modify a real PRO salon or its bookings.
create or replace function public.bc_admin_import_delete(p_import uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare entry public.bc_mero_import_drafts%rowtype; removed integer:=0; detached integer:=0;
begin
 if (select auth.uid()) is null or not public.bc_is_platform_admin()
 then raise exception 'ADMIN_ONLY';end if;
 select * into entry from public.bc_mero_import_drafts where id=p_import for update;
 if not found then raise exception 'IMPORT_NOT_FOUND';end if;
 delete from public.bc_public_salon_catalog
 where import_id=p_import and salon_id is null;
 get diagnostics removed=row_count;
 update public.bc_public_salon_catalog
 set import_id=null,source_url=null
 where import_id=p_import and salon_id is not null;
 get diagnostics detached=row_count;
 delete from public.bc_mero_import_drafts where id=p_import;
 insert into public.bc_admin_audit(actor_id,action,target_type,target_id,details)
 values((select auth.uid()),'delete','import',p_import::text,
 jsonb_build_object('salon',entry.salon_name,'unlinked_catalog_copies_removed',removed,
 'linked_real_salon_preserved',detached));
 return jsonb_build_object('deleted',true,'removed_copies',removed,'retained_pro_catalogs',detached);
end;$$;
revoke all on function public.bc_admin_import_delete(uuid) from public,anon;
grant execute on function public.bc_admin_import_delete(uuid) to authenticated;

create or replace function public.bc_admin_import_list()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
begin
 if (select auth.uid()) is null or not public.bc_is_platform_admin()
 then raise exception 'ADMIN_ONLY';end if;
 return coalesce((select jsonb_agg(jsonb_build_object(
 'id',d.id,'name',d.salon_name,'status',d.status,
 'imported_at',d.created_at,'published',c.id is not null,
 'linked_pro',c.salon_id is not null)
 order by d.created_at desc)
 from public.bc_mero_import_drafts d
 left join public.bc_public_salon_catalog c on c.import_id=d.id),'[]'::jsonb);
end;$$;
revoke all on function public.bc_admin_import_list() from public,anon;
grant execute on function public.bc_admin_import_list() to authenticated;
