import assert from "node:assert/strict";
import fs from "node:fs";import vm from "node:vm";
const read=p=>fs.readFileSync(p,"utf8");
for(const path of ["admin-explore.js","admin-clients.js","pilot-control.js","catalog-booking.js"]){
 new vm.Script(read(path),{filename:path});
 console.log("PASS JavaScript",path);
}
for(const path of ["admin.html","index.html","catalog-booking.html","pilot-control.html"]){
 const s=read(path);assert.match(s,/<!doctype html>/i);
 for(const match of s.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi))
  if(match[1].trim())new vm.Script(match[1],{filename:path});
 console.log("PASS HTML",path);
}
const sql=read("supabase/migrations/20261009_explore_to_catalog_public_bookings.sql");
const consent=read("supabase/migrations/20261009_explore_catalog_gallery_and_consent.sql");
const approvals=read("supabase/migrations/20261009_client_account_approvals.sql");
const explore=read("admin-explore.js"),app=read("index.html"),booking=read("catalog-booking.js"),owner=read("pilot-control.js"),admin=read("admin.html");
assert.ok(explore.includes("bc_admin_explore_promote"),"Admin import from Explore is wired");
assert.ok(explore.includes("Importă în Catalog"),"Import button visible");
assert.ok(explore.includes("PROFILE_ALREADY_LINKED_TO_PRO")||sql.includes("PROFILE_ALREADY_LINKED_TO_PRO"),"Previously linked salon not overridden");
assert.ok(sql.includes("explore_sample_id uuid unique"),"No duplicated catalog imports");
assert.ok(sql.includes("visibility='listed'"),"Public visibility is separate from booking activation");
assert.ok(sql.includes("public_booking_enabled boolean not null default false"),"Booking off by default");
assert.ok(sql.includes("bc_catalog_booking_toggle"),"Owner approves public bookings explicitly");
assert.ok(sql.includes("bc_catalog_booking_slots"),"Public slot lookup via existing conflict engine");
assert.ok(sql.includes("bc_catalog_booking_create"),"Public booking RPC exists");
assert.ok(sql.includes("public.bc_pilot_book("),"Public reservations write to real PRO calendar via existing engine");
assert.ok(consent.includes("public_booking_enabled=false"),"Reassociating a PRO resets public booking consent");
assert.ok(consent.includes("explore_gallery_paths"),"Gallery photos travel into Catalog");
assert.ok(app.includes("bc_catalog_booking_public"),"Booking UI checks owner approval");
assert.ok(app.includes("catalog-booking.html"),"Public salon Profile links to reservation form");
assert.ok(booking.includes("bc_catalog_booking_create"),"Booking form uses server API");
assert.ok(booking.includes("bc_client_my_approval"),"Public booking UI checks admin client approval");
assert.ok(booking.includes("signInWithPassword"),"Clients can log in");
assert.ok(booking.includes("auth.signUp"),"Clients can register");
assert.ok(booking.includes("CLIENT")||booking.includes("contului"),"Awaiting approval is explained");
assert.ok(owner.includes("bc_catalog_booking_toggle"),"Owner controls public reservations");
assert.ok(approvals.includes("AFTER INSERT ON auth.users"),"New clients enter pending review");
assert.ok(approvals.includes("on conflict(user_id) do nothing"),"Existing accounts preserved");
assert.ok(approvals.includes("CLIENT_NOT_APPROVED"),"Pending clients cannot confirm public reservations");
assert.ok(approvals.includes("revoke all on function public.bc_catalog_booking_create"),"Anonymous cannot call public booking");
assert.ok(approvals.includes("bc_admin_client_review"),"Admin reviews client accounts");
assert.ok(approvals.includes("bc_admin_clients_list"),"Admin client list");
assert.ok(admin.includes('data-tab="clients"'),"Admin client tab registered");
assert.ok(admin.includes('active==="clients"'),"Admin client tab renders");
assert.ok(admin.includes("admin-clients.js"),"Admin clients JS loaded");
assert.ok(admin.includes("admin-clients.css"),"Admin clients CSS loaded");
assert.ok(!booking.includes("p_code:invite"),"Public booking does not use invite secret");
console.log("PASS: Explore→Catalog, owner consent, verified-client booking and mobile Admin client approvals");
