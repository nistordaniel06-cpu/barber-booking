import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";
const read=path=>fs.readFileSync(path,"utf8");
const scripts=["passport-rewards.js","passport-checkin.js","reward-redeem.js","admin-zones.js","zones-public.js"];
for(const name of scripts){
 new vm.Script(read(name),{filename:name});
 console.log("PASS JavaScript syntax: "+name);
}
const documents=["passport.html","reward-redeem.html","admin.html","territory-war.html","professionals.html"];
for(const path of documents){
 const body=read(path);
 assert.match(body,/<!doctype html>/i,"HTML doctype: "+path);
 for(const hit of body.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)){
  if(hit[1].trim())new vm.Script(hit[1],{filename:path+":inline"});
 }
 console.log("PASS HTML/inline script: "+path);
}
const passport=read("passport.html"),pro=read("professionals.html"),admin=read("admin.html");
assert.match(passport,/passport-rewards\.js/);
assert.match(passport,/passport-checkin\.js/);
assert.match(passport,/id="rewardQrPanel"/);
assert.match(passport,/id="passportCheckinCode"/);
assert.match(pro,/reward-redeem\.html/);
assert.match(admin,/data-tab="zones"/);
assert.match(admin,/admin-zones\.js/);
assert.match(read("territory-war.html"),/zones-public\.js/);
const redeem=read("reward-redeem.js");
for(const fn of ["bc_my_professional_access","bc_reward_partner_catalog","bc_reward_partner_set","bc_reward_claim_redeem","bc_passport_qr_checkin"])assert.ok(redeem.includes(fn),fn);
const claim=read("passport-rewards.js");
for(const fn of ["bc_reward_wallet","bc_reward_claim_create","bc_reward_claim_cancel","bc_reward_claim_qr"])assert.ok(claim.includes(fn),fn);
const migrations=[
 "supabase/migrations/20261009_barbercraft_rewards_redemption.sql",
 "supabase/migrations/20261009_barbercraft_multi_city_zones.sql",
 "supabase/migrations/20261009_barbercraft_passport_checkin.sql",
 "supabase/migrations/20261009_barbercraft_rewards_audit.sql"
];
for(const file of migrations){
 const sql=read(file);
 assert.match(sql,/enable row level security/i);
 assert.match(sql,/revoke all on function .* from public,anon/i);
 console.log("PASS migration checks: "+file);
}
assert.match(read(migrations[0]),/pg_advisory_xact_lock/);
assert.match(read(migrations[0]),/extensions\.digest/);
assert.match(read(migrations[0]),/FOR UPDATE/i);
assert.match(read(migrations[2]),/does not|not proof|not confirm|nu/i);
console.log("PASS BARBERCRAFT rewards + QR + zones smoke tests");
