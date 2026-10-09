import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const read=p=>fs.readFileSync(p,"utf8");
const jsFiles=["enhancements.js","premium-ui.js","passport-preview.js","passport-checkin.js","reward-redeem.js","passport.js","passport-rewards.js"];
for(const f of jsFiles){new vm.Script(read(f),{filename:f});console.log("OK: syntax",f)}
for(const f of ["index.html","passport.html","passport-preview.html","professionals.html","reward-redeem.html","admin.html","territory-war.html"]){
 const s=read(f);
 assert.match(s,/<!doctype html>/i);
 for(const m of s.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)){
  if(m[1].trim())new vm.Script(m[1],{filename:f+":inline"})
 }
 assert.ok(s.includes("premium.css"),f+" loads premium CSS");
 assert.ok(s.includes("bc-premium"),f+" uses premium page class");
 console.log("OK: premium page",f);
}
const home=read("index.html"),discover=read("enhancements.js"),pro=read("professionals.html");
const passport=read("passport.html"),view=read("passport-preview.html"),scan=read("reward-redeem.js"),admin=read("admin.html");
assert.ok(home.includes("bc-battle")&&home.includes("./territory-war.html"),"Game artwork + navigation");
assert.ok(read("premium.css").includes("assets/batalia-zonelor.svg"),"Local battle asset");
assert.match(read("assets/batalia-zonelor.svg"),/<svg[\s>]/);
assert.ok(!discover.includes("Caută adresă Google"),"No Google search UI");
assert.ok(!discover.includes("Vezi toate frizeriile pe Google Maps"),"No Google footer");
for(const [name,s] of [["index",home],["pro",pro],["admin",admin],["battle",read("territory-war.html")]]){
 assert.ok(!s.includes("Territory War"),name+" has no old name");
}
assert.ok(pro.includes("proScanBottom")&&pro.includes("./reward-redeem.html"),"PRO staff shortcut");
assert.ok(pro.includes("Activitate & fidelizare"),"PRO financial section renamed");
assert.ok(admin.includes("Activitate & fidelizare"),"Admin activity renamed");
assert.ok(admin.includes('data-tab="storefront"'),"Admin design settings accessible");
assert.ok(view.includes("profilePhotos")&&view.includes("profileNotes")&&view.includes("profileVisits"),"Own-profile preview gallery");
assert.ok(passport.includes("premium-ui.js")&&passport.includes("passport-checkin.js"),"Client Passport wired");
assert.ok(scan.includes("bc_my_professional_access"),"Staff access read from server");
assert.ok(scan.includes("bc_passport_qr_checkin")&&scan.includes("bc_reward_claim_redeem"),"No false client XP");
assert.ok(scan.includes("BarcodeDetector")&&scan.includes("Html5Qrcode"),"Camera scanner fallback");
assert.ok(scan.includes("confirm("),"Human confirmation required");
assert.ok(read("passport-checkin.js").includes("BCP1 ····"),"QR secret initially masked");
assert.ok(read("premium-ui.js").includes("bc_is_platform_admin"),"Platform role-check");
console.log("PASS premium UI and permissions-oriented wiring");
