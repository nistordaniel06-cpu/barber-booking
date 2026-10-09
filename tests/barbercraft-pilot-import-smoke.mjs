import assert from "node:assert/strict";
import fs from "node:fs";import vm from "node:vm";
const read=p=>fs.readFileSync(p,"utf8");
for(const path of ["pilot-control.js","pilot-client.js","admin-explore.js"]){
 new vm.Script(read(path),{filename:path});console.log("PASS JavaScript",path);
}
for(const path of ["admin.html","professionals.html","pilot-control.html","pilot.html"]){
 const html=read(path);assert.match(html,/<!doctype html>/i);
 for(const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi))
 if(match[1].trim())new vm.Script(match[1],{filename:path+":inline"});
 console.log("PASS HTML",path);
}
const admin=read("admin.html"),pro=read("professionals.html"),control=read("pilot-control.html"),client=read("pilot.html");
assert.ok(admin.includes("bc_admin_import_delete"),"Admin deletes imported draft through role-gated RPC");
assert.ok(admin.includes('label:"Șterge importul"'),"Delete button shown next to import");
assert.ok(admin.includes('label:"Publică în aplicație"'),"Publish import preserved");
assert.ok(admin.includes("bc_admin_import_list"),"All imports loaded, not only overview last 30");
assert.ok(admin.includes("pilot-control.html"),"Admin links to private pilot");
assert.ok(pro.includes("./pilot-control.html?from=pro"),"PRO links to pilot owner control");
assert.ok(control.includes('id="pilotEnabled"'),"Owner controls activation, disabled by default");
assert.ok(control.includes('id="pilotServices"'),"Owner configures real services and prices");
assert.ok(control.includes('id="pilotBookings"'),"Owner sees confirmed appointments");
assert.ok(client.includes('id="pilotConsent"'),"Client explicitly consents to a real reservation");
assert.ok(client.includes('id="pilotSlots"'),"Client chooses from server-computed slots");
assert.ok(client.includes('id="pilotBookingCode"'),"Client receives confirmation code");
for(const name of ["bc_pilot_owner_state","bc_pilot_configure","bc_pilot_book","bc_pilot_slots"]){
 assert.ok(read("pilot-control.js").includes(name)||read("pilot-client.js").includes(name),"RPC wired "+name)
}
assert.ok(read("pilot-client.js").includes("crypto.randomUUID"),"Idempotent booking requests");
assert.ok(read("pilot-client.js").includes('phone="+4"+phone'),"Romanian local mobile normalized to E.164");
const migrate=read("supabase/migrations/20261009_4men_pilot_booking.sql");
assert.ok(migrate.includes("enabled boolean not null default false"),"Pilot opt-in");
assert.ok(migrate.includes("bc_pilot_bookings"),"Confirmed bookings saved");
assert.ok(migrate.includes("pg_advisory_xact_lock"),"Competing reservations serialized");
assert.ok(migrate.includes("bc_pro_calendar_events"),"Bookings use existing PRO calendar");
assert.ok(migrate.includes("PILOT_CLOSED"),"Closed pilots reject bookings");
assert.ok(migrate.includes("WEEKLY_BOOKING_LIMIT"),"Phone rate limit");
assert.ok(migrate.includes("p_consent"),"Consent checked by server");
assert.ok(read("supabase/migrations/20261009_pilot_pgcrypto_schema_v2.sql").includes("extensions.gen_random_bytes"),"Secure random codes accessible in hardened functions");
const imports=read("supabase/migrations/20261009_admin_import_delete.sql");
assert.ok(imports.includes("public.bc_is_platform_admin()"),"Only admin deletes");
assert.ok(imports.includes("salon_id is null"),"Only unlinked imported public records removed");
assert.ok(imports.includes("salon_id is not null"),"Real salon link preserved");
assert.ok(imports.includes("bc_admin_audit"),"Import deletions audited");
console.log("PASS pilot owner setup, guest booking, import cleanup and privacy boundary smoke");
