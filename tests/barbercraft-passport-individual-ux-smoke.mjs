import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { portalDocument,portals } from "../tools/sync-portal-pages.mjs";
const read=path=>fs.readFileSync(path,"utf8");
const client=read("index.html"),pro=read("professionals.html"),admin=read("admin.html");
const pass=read("passport.html"),social=read("social.html"),menu=read("client-home-v2.js"),guide=read("barbercraft-assistant.js"),sql=read("supabase/migrations/20261010_barber_passport_individual_xp.sql");
for(const [portal,source] of Object.entries(portals)){
 assert.equal(read(portal+"/index.html"),portalDocument(read(source),portal),"Portal "+portal+" synchronized");
}
for(const file of ["passport.js","passport-progression.js","barbercraft-assistant.js",
 "barbercraft-experience.js","ro-discovery.js","discovery-marketplace.js",
 "client-home-v2.js","premium-ui.js","notifications-settings.js"]){
 new vm.Script(read(file),{filename:file});
}
for(const file of ["index.html","professionals.html","admin.html","passport.html",
 "barber-pass.html","notifications.html","privacy.html","social.html"]){
 const html=read(file);
 for(const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi))
  if(m[1].trim())new vm.Script(m[1],{filename:file+":inline"});
}
assert.ok(!client.includes('href="./territory-war.html"'),"Territorial competition hidden from Client");
assert.ok(!menu.includes("Bătălia Zonelor"),"Legacy territory removed from Client menu");
assert.ok(!read("premium-ui.js").includes('Bătălia Zonelor'),"Legacy role menu removed");
assert.ok(menu.includes('Portal client')&&menu.includes('Portal profesioniști'),"Four clean guest links");
assert.ok(!menu.includes("if(window.BCClientUser)"),"Guest never sees extra links");
assert.ok(client.includes('textContent="C."')||client.includes('document.createTextNode("C.")'),"Guest avatar initial");
assert.ok(client.includes(".bcFavoriteHeart"),"Red favorite icon");
assert.ok(client.includes('id="bcNearMe"')||read("ro-discovery.js").includes("📍 Locația ta"),"Location label clear");
assert.ok(read("ro-discovery.js").includes("mapViewed"),"Remember custom radius after first map opening");
assert.ok(read("ro-discovery.js").includes("Raza activă:"),"Map shows chosen radius");
assert.ok(read("discovery-marketplace.js").includes("setRadius:changeRadius"),"Slider controls radius instantly");
assert.ok(client.includes("catalogPane[hidden]"),"Salons are continuous-scroll, not four tab pages");
assert.ok(read("passport.js").includes('bc_passport_my_progress'),"Passport reads real individual XP");
assert.ok(read("passport.js").includes('bc_passport_my_visit_history'),"Passport reads only staff-confirmed visit history");
assert.ok(pass.includes("bcIndividualPassport"),"Client profile renders level and quests");
for(const q of ["first_verified_visit","salon_loyalty_3","avatar_completed","review_verified","visit_streak_3"])
 assert.ok(sql.includes(q),"Quest "+q+" exists in trusted server");
assert.ok(sql.includes("unique(user_id,event_key,source_id)"),"Idempotency ledger");
assert.ok(sql.includes("for update"),"Serializable user-level row locking");
assert.ok(sql.includes("bc_service_visits"),"Trusted completion trigger");
assert.ok(sql.includes("bc_verified_reviews"),"Verified review trigger");
assert.ok(sql.includes("revoke all on public.bc_passport_clients"),"XP tables are not client writable");
assert.ok(sql.includes("tip_passport='premium'"),"Premium rewards require paid tier");
assert.ok(read("supabase/migrations/20261010_barber_passport_quest_summary_hardening.sql").includes("storage.objects"),"Avatar XP needs actual uploaded image");
assert.ok(read("supabase/migrations/20261010_barber_passport_actual_service_history.sql").includes("bc_service_visits"),"Visit history excludes legacy territory XP");
assert.ok(guide.includes("pointermove")&&guide.includes("setPointerCapture"),"Drag with touch pointer");
assert.ok(guide.includes("familiar"),"Onboarding preference");
assert.ok(guide.includes("nu dintr-un model generativ"),"No false claims of generative AI");
assert.ok(read("barber-pass.html").includes("15 lei")&&read("barber-pass.html").includes("8 lei"),"Transparent fixed price offers");
assert.ok(read("barber-pass.html").includes("Checkout în pregătire"),"No fake active billing");
assert.ok(read("notifications.html").includes("Web Push"),"Notifications permission page exists");
assert.ok(read("bc-service-worker.js").includes('addEventListener("push"'),"Push service worker added");
assert.ok(read("robots.txt").includes("Disallow: /barber-booking/admin/"),"Never index Admin");
assert.ok(read("sitemap.xml").includes("client/"),"Discovery pages indexed");
assert.ok(read("barbercraft-experience.js").includes("navigator.languages"),"System language detected");
assert.ok(read("barbercraft-experience.js").includes("SameSite=Lax"),"Scoped essential cookies");
console.log("PASS: BARBERCRAFT individual Barber Passport, 5 trusted quests, clean menus, mobile map, consent, contextual guide and separated portals");
