import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const read=p=>fs.readFileSync(p,"utf8");
const scripts=["ro-discovery.js","demo-salons.js","pro-lifecycle.js","referral.js",
"kingdom-strategy.js","kingdom-alliance.js","admin-referrals.js","enhancements.js"];
for(const path of scripts){new vm.Script(read(path),{filename:path});console.log("PASS JS syntax",path)}
for(const path of ["index.html","professionals.html","passport.html","territory-war.html",
"referral.html","kingdom-strategy.html","admin.html"]){
 const html=read(path);assert.match(html,/<!doctype html>/i);
 for(const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi))if(m[1].trim())new vm.Script(m[1],{filename:path+":inline"});
 console.log("PASS HTML script",path);
}
const home=read("index.html"),pro=read("professionals.html"),admin=read("admin.html");
assert.ok(home.includes("ro-discovery.js")&&home.includes("demo-salons.js"),"Homepage discover and source samples wired");
assert.ok(read("ro-discovery.js").includes("getCurrentPosition"),"Permission-aware geolocation");
assert.ok(read("ro-discovery.js").includes("bcAllRomania"),"User can disable location filtering");
assert.ok(read("ro-discovery.js").includes("OpenStreetMap"),"Romania map");
assert.ok(!read("enhancements.js").includes("bcInitialCity"),"No implicit forced Bucharest");
assert.ok(read("demo-salons.js").includes("source_url"),"Original source links included");
assert.ok(read("demo-salons.js").includes("nu este înscris ca partener"),"Clearly not bookable real partner");
assert.ok(read("assets/salon-placeholder.svg").includes("Ilustrație generică"),"No fake real photos");
assert.ok(pro.includes('data-pro-route="lifecycle"'),"PRO archive navigation");
assert.ok(pro.includes('lifecycle:"proLifecyclePanel"'),"Actual lifecycle panel routing");
assert.ok(pro.includes("bc-pro-reload-lifecycle"),"Lifecycle refreshes after signing in");
assert.ok(pro.includes("./referral.html?type=pro"),"Pro referral action");
assert.ok(read("pro-lifecycle.js").includes("bc_pro_archive_salon"),"Owner-only archive RPC in UI");
assert.ok(read("passport.html").includes("./referral.html?type=client"),"Client referral entry");
assert.ok(read("referral.js").includes("bc_referral_claim"),"Invites attributable");
assert.ok(read("referral.js").includes("bc_referral_link_create"),"Personal link creation");
assert.ok(admin.includes('data-tab="referrals"'),"Admin campaign controls");
assert.ok(admin.includes("admin-referrals.js"),"Admin campaign JS loaded");
assert.ok(read("territory-war.html").includes("./kingdom-strategy.html"),"Strategy game navigation");
assert.ok(read("kingdom-strategy.html").includes('id="kingMission"'),"Daily challenge");
assert.ok(read("kingdom-strategy.html").includes('id="kingAllianceTeams"'),"Six sector alliances");
assert.ok(read("kingdom-strategy.html").includes("./kingdom-alliance.js"),"Expedition module loaded");
assert.ok(read("kingdom-strategy.js").includes("bc_kingdom_build"),"Server-side upgrades");
assert.ok(read("kingdom-strategy.js").includes("bc_kingdom_train"),"Server-side troops");
assert.ok(read("kingdom-alliance.js").includes("bc_kingdom_expedition"),"Server-side PvE");
const sql=read("supabase/migrations/20261009_demo_merosourced_salons.sql");
assert.match(sql,/booking_enabled boolean not null default false check\(booking_enabled=false\)/);
assert.match(sql,/photo_permission boolean not null default false check\(photo_permission=false\)/);
assert.equal((sql.match(/https:\/\/mero\.ro\/p\//g)||[]).length,20,"20 source-backed demo salons");
assert.equal((sql.match(/'Sector 6'/g)||[]).length,5,"Five Sector 6 salons");
for(let n=1;n<=5;n++)assert.equal((sql.match(new RegExp("'Sector "+n+"'","g"))||[]).length,3,"Three in Sector "+n);
for(const file of ["supabase/migrations/20261009_salon_owner_archive.sql",
"supabase/migrations/20261009_referral_v1.sql","supabase/migrations/20261009_kingdom_strategy.sql",
"supabase/migrations/20261009_referral_strategy_hardening.sql",
"supabase/migrations/20261009_referral_admin_archive_guard.sql",
"supabase/migrations/20261009_kingdom_alliances_expeditions.sql"]){
 const x=read(file);assert.match(x,/security definer/i);assert.match(x,/revoke all on function/i);
 console.log("PASS migration guardrails",file);
}
assert.match(read("supabase/migrations/20261009_salon_owner_archive.sql"),/FUTURE_APPOINTMENTS_MUST_BE_RESOLVED/);
assert.match(read("supabase/migrations/20261009_referral_strategy_hardening.sql"),/SELF_REFERRAL/);
assert.match(read("supabase/migrations/20261009_kingdom_alliances_expeditions.sql"),/NO_VILLAGE|bc_kingdom_update_tick/);
console.log("PASS growth sprint: owner deletion, Romania map, 20 sources, referrals and kingdom strategy");
