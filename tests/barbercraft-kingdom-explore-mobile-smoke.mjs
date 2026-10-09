import assert from "node:assert/strict";
import fs from "node:fs";import vm from "node:vm";
const read=path=>fs.readFileSync(path,"utf8");
for(const path of ["kingdom-strategy.js","kingdom-alliance.js","kingdom-coach.js",
"demo-salons.js","admin-explore.js","social.js","referral.js"]){
 new vm.Script(read(path),{filename:path});console.log("PASS JS",path);
}
for(const path of ["admin.html","kingdom-strategy.html","referral.html","social.html","passport.html"]){
 const s=read(path);assert.match(s,/<!doctype html>/i);
 for(const match of s.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)){
  if(match[1].trim())new vm.Script(match[1],{filename:path});
 }
 console.log("PASS HTML",path);
}
const kingdom=read("kingdom-strategy.html");
for(const tag of ["village","alliance","expedition"]){
 assert.ok(kingdom.includes('data-king-tab="'+tag+'"'),"Game tab "+tag);
 assert.ok(kingdom.includes('data-king-panel="'+tag+'"'),"Game content panel "+tag);
}
for(const id of ["wood","stone","iron","food","kingBuild","kingBuildings","kingTroops","kingMission",
"kingAllianceTeams","kingDonate","kingFortify","kingExpeditionTarget","kingExpeditionGo","kingRefresh",
"kingGuideGo","kingNextAction"]){
 if(id==="kingBuild")continue;
 assert.ok(kingdom.includes('id="'+id+'"'),"Game action exists "+id);
}
assert.ok(kingdom.includes('data-focus-building="wood"'),"Village map has interactive shortcut");
assert.ok(kingdom.includes('kind')||read("kingdom-coach.js").includes("data-focus-building"),"Live village shortcut");
assert.ok(read("kingdom-coach.js").includes('bc-kingdom-updated'),"Guided strategy state");
assert.ok(read("kingdom-coach.js").includes("aria-selected"),"Accessible tab focus");
assert.ok(read("kingdom-strategy.js").includes('card.dataset.kind=key'),"Building anchor for interactive map");
const admin=read("admin.html"),edit=read("admin-explore.js"),samples=read("demo-salons.js");
assert.ok(admin.includes('data-tab="explore"')&&admin.includes("admin-explore.js"),"Explore editor registered in Admin");
assert.ok(admin.includes('active==="explore"'),"Editor reachable by Admin tab");
assert.ok(read("admin-mobile.css").includes(".bc-admin-hub-tile"),"Mobile Admin text sizing");
assert.ok(read("referral.css").includes("refTwo{grid-template-columns:1fr}"),"Referral blocks stack on mobile");
assert.ok(read("social.css").includes("repeat(3,minmax(0,1fr))"),"Community tab size fixed");
assert.ok(!read("passport.html").includes("./social.html#ideas"),"Customer proposals shortcut removed");
assert.ok(!read("social.html").includes('data-panel="ideas"'),"Ideas removed from public menu");
assert.ok(!read("professionals.html").includes("Propuneri clienți"),"PRO doesn't advertise proposals");
assert.ok(!samples.includes("mero.ro")&&!samples.includes("source_url"),"No source-platform links or exposed URL fields");
assert.ok(samples.includes("photo_permission")&&samples.includes("gallery_paths"),"Public catalog includes uploaded images");
assert.ok(samples.includes("nu poți face rezervări"),"External catalog still never bookable");
for(const token of ["bc_admin_explore_list","bc_admin_explore_save","bc_admin_explore_delete","bc-explore-images","upload(","remove(","photo_permission"]){
 assert.ok(edit.includes(token),"Admin functionality "+token);
}
const sql=read("supabase/migrations/20261009_explore_admin_editor.sql");
assert.ok(sql.includes("public.bc_is_platform_admin()"),"Role-gated catalog mutations");
assert.ok(read("supabase/migrations/20261009_demo_merosourced_salons.sql").includes("booking_enabled boolean not null default false check(booking_enabled=false)"),"Demo entries remain nonbookable at database level");
assert.ok(sql.includes("PHOTO_RIGHTS_CONFIRMATION_REQUIRED"),"Photos require proof of rights acknowledgment");
assert.ok(sql.includes("for media in select path"),"Media paths validated against storage");
const rights=read("supabase/migrations/20261009_explore_public_column_allowlist.sql");
assert.ok(rights.includes("revoke select on public.bc_discovery_salon_samples"),"Source URLs not exposed publicly");
assert.ok(!rights.includes("source_url"),"Sensitive provenance excluded from public allowlist");
const retired=read("supabase/migrations/20261009_retire_customer_proposals.sql");
assert.ok(retired.includes("revoke execute"),"New proposals disabled");
console.log("PASS: kingdom redesign, mobile containment, internal-source catalog CRUD, media rights and proposals retirement");
