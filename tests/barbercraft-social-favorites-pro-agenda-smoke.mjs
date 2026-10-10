import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {portalDocument,portals} from "../tools/sync-portal-pages.mjs";
const read=p=>fs.readFileSync(p,"utf8");
for(const [portal,source] of Object.entries(portals))
 assert.equal(read(portal+"/index.html"),portalDocument(read(source),portal),"Portal "+portal+" in sync");
for(const file of ["client-favorites.js","client-home-v2.js","barbercraft-assistant.js","social.js",
 "social-feed.js","salon-mentions.js","pro-client-agenda.js","catalog-booking.js","client-rank-identity.js"]){
 new vm.Script(read(file),{filename:file});
}
for(const file of ["index.html","professionals.html","pro/calendar/index.html","social.html","passport.html","catalog-booking.html"]){
 const s=read(file);
 for(const m of s.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi))
  if(m[1].trim())new vm.Script(m[1],{filename:file+":inline"});
}
const client=read("index.html"),social=read("social.html"),pro=read("professionals.html");
const assistant=read("barbercraft-assistant.js"),sql=read("supabase/migrations/20261010_favorites_and_verified_pro_agenda.sql");
assert.match(client,/id="favoritesView"/);
assert.match(client,/data-favorite-kind="salon"/);
assert.match(client,/data-favorite-kind="barber"/);
assert.match(client,/id="syncCalendarBtn"/);
assert.match(read("catalog-booking.js"),/pilotSyncCalendar/);
assert.match(read("catalog-booking.html"),/pilotSyncCalendar/);
assert.ok(client.includes("bcAccountFeatureLinks")&&client.includes("bcWalletPass"));
assert.ok(read("client-home-v2.css").includes("#home>#chips{display:none"));
assert.ok(read("client-home-v2.css").includes(".bcRareServices{display:none"));
assert.match(assistant,/mutedKey/);
assert.match(assistant,/if\(!dialog.hidden&&!root.contains\(event.target\)\)/);
assert.doesNotMatch(assistant,/pointermove|setPointerCapture/);
assert.ok(read("client-home-v2.js").includes("Devino partener"));
assert.ok(!read("client-home-v2.js").includes("Deschide în tab nou"));
assert.ok(sql.includes("bc_favorite_toggle")&&sql.includes("bc_favorite_summary"));
assert.ok(sql.includes("enable row level security")&&sql.includes("bc_pro_client_agenda"));
assert.ok(read("pro-client-agenda.js").includes("bc_pro_client_agenda"));
assert.ok(pro.includes("./pro-client-agenda.js"));
assert.ok(!pro.includes('id="calendarManualNewTab"'));
assert.ok(!read("pro/calendar/index.html").includes("popupNewTabQuick"));
assert.ok(social.includes("socialOnlineVisible")&&social.includes("socialFriends"));
assert.ok(read("social.js").includes("bc_social_friends_list"));
assert.ok(read("social.js").includes("bc_favorite_toggle"));
assert.ok(read("salon-mentions.js").includes("bcSalonMention"));
assert.ok(read("social-feed.js").includes("bc_social_online_for"));
assert.ok(read("social.js").includes("bc_social_client_rank"));
assert.ok(read("passport.html").includes("clientRankBadge"));
console.log("PASS BARBERCRAFT salon/barber favorites, presence, PRO agenda and Client native calendar import");
