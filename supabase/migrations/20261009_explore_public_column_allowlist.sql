-- Make original external-source URLs and edit metadata admin-only.
-- Public directory gets an explicit column allowlist; admin reads full rows through gated RPC.
revoke select on public.bc_discovery_salon_samples from anon,authenticated;
grant select(id,name,address,city,county,sector,services,publicly_listed_team,
 is_partner,booking_enabled,photo_permission,is_visible,cover_path,gallery_paths,data_status)
 on public.bc_discovery_salon_samples to anon,authenticated;
