-- Original sample dataset required photo_permission=false for every entry.
-- Enable properly authorized Admin photos while disallowing attached images without attestation.
alter table public.bc_discovery_salon_samples
 drop constraint if exists bc_discovery_salon_samples_photo_permission_check;
alter table public.bc_discovery_salon_samples
 add constraint bc_explore_images_need_rights
 check(photo_permission=true or (cover_path is null and gallery_paths='[]'::jsonb));
