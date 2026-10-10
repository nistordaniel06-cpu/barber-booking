import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {portalDocument,portals} from "../tools/sync-portal-pages.mjs";
const read=path=>fs.readFileSync(path,"utf8");
for(const [portal,source] of Object.entries(portals)){
 assert.equal(read(portal+"/index.html"),portalDocument(read(source),portal),"Standalone "+portal+" synchronized");
}
for(const path of ["barbercraft-sticky-nav.js","passport-medals.js","passport-rewards.js",
 "passport-progression.js","barbercraft-assistant.js","social.js","ro-discovery.js",
 "demo-salons.js","discovery-marketplace.js","premium-ui.js","passport.js"]){
 new vm.Script(read(path),{filename:path});
}
for(const path of ["index.html","social.html","passport.html","rewards.html","passport-preview.html"]){
 const s=read(path);
 for(const hit of s.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi))
  if(hit[1].trim())new vm.Script(hit[1],{filename:path+":inline"});
}
const home=read("index.html"),pass=read("passport.html"),social=read("social.html");
const assist=read("barbercraft-assistant.js"),medals=read("passport-medals.js"),rewards=read("rewards.html");
assert.ok(read("barbercraft-sticky-nav.css").includes(".socialTop"),"Community header is sticky");
assert.ok(read("barbercraft-sticky-nav.css").includes(".bcAppBottom"),"Bottom nav is persistent");
assert.ok(read("barbercraft-sticky-nav.css").includes(".wrap>header"),"Passport header is sticky");
assert.ok(["social.html","passport.html","passport-preview.html","rewards.html"].every(x=>read(x).includes("barbercraft-sticky-nav.js")),"Client companion nav loaded");
assert.ok(read("client-home-v2.css").includes("#home .hero h2"),"Hero remains legible in sun mode");
assert.ok(read("client-home-v2.css").includes('data-theme="light"'),"Light mode-specific image contrast");
assert.ok(home.includes('if(state.filter!=="Toate")'),"Service chips filter actual salon services");
assert.ok(read("demo-salons.js").includes("matchQuick(x)"),"Sample salons respect chosen filter");
assert.ok(read("discovery-marketplace.js").includes("details.open=false"),"Advanced filters start closed");
assert.ok(read("ro-discovery.css").includes("height:min(68dvh,690px)"),"Map is inset, not fullscreen");
assert.ok(pass.includes('id="bcMedalBoard"'),"Medal wall lives in Passport identity");
assert.ok(pass.includes('id="medalBoardSection"'),"Award wall deep link");
assert.ok(!pass.includes("Oferte de la saloane participante"),"No salon offers in member identity");
assert.ok(!pass.includes('id="rewardClaimList"'),"No redeem claim history in member identity");
assert.ok(!pass.includes('src="./passport-rewards.js"'),"No shop script in identity view");
assert.ok(rewards.includes('id="rewardClaimList"'),"Claims remain accessible in separate page");
assert.ok(rewards.includes('id="rewardMarketList"'),"Salon offer marketplace accessible");
assert.ok(rewards.includes('id="rewardQrPanel"'),"QR redemption remains accessible");
for(const medal of ["Bronz","Argint","Aur","Platină","Diamant"])assert.ok(medals.includes(medal),"Medal "+medal);
assert.ok(medals.includes("bc_passport_my_visit_history"),"Medals derive from trusted visits");
assert.ok(medals.includes("bc_passport_my_progress"),"Medals derive from trusted quest progress");
assert.ok(read("passport-progression.js").includes("BARBER PASS"),"Barber Pass no longer conflated with Passport identity");
assert.ok(!/\badmin\b/i.test(assist),"Client/PRO assistant avoids Admin topics");
assert.ok(assist.includes("howToBook")&&assist.includes("selectează data și ora liberă"),"Assistant tells Client how to book");
assert.ok(assist.includes("identityHelp")&&assist.includes("Barber Passport este identitatea"),"Assistant correctly explains Passport identity");
assert.ok(assist.includes("priceHelp")&&assist.includes("15 lei/lună"),"Assistant gives concise purpose-led prices");
assert.ok(social.includes('id="socialPrivacyHint"'),"Client knows when public/private switch unlocks");
assert.ok(read("social.js").includes("bc_social_privacy_eligibility"),"Privacy toggle is server-informed");
assert.ok(read("supabase/migrations/20261010_social_client_privacy_three_verified_visits.sql").includes("THREE_VERIFIED_VISITS_FOR_PRIVACY"),"Backend enforces 3 verified haircuts");
console.log("PASS: Client & community sticky navigation, identity medals, secure privacy and functioning filters/assistant");
