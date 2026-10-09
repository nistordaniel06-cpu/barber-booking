import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const read=path=>fs.readFileSync(path,"utf8");
for(const path of ["admin-rewards.js","passport.js","enhancements.js","maps-config.js"]){
 new vm.Script(read(path),{filename:path});
 console.log("OK JavaScript:",path);
}
for(const path of ["index.html","admin.html","territory-war.html","passport.html"]){
 const html=read(path);
 assert.match(html,/<!doctype html>/i);
 const scriptRegex=/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi;
 for(const match of html.matchAll(scriptRegex)){
  if(match[1].trim())new vm.Script(match[1],{filename:path+":inline"});
 }
 console.log("OK HTML/inline JavaScript:",path);
}
assert.match(read("index.html"),/enhancements\.js/);
assert.match(read("index.html"),/BCRefreshSearch/);
assert.match(read("index.html"),/Bătălia Zonelor/);
assert.match(read("admin.html"),/data-tab="rewards"/);
assert.match(read("admin.html"),/BCRewardAdmin/);
assert.match(read("passport.html"),/passport\.js/);
assert.match(read("territory-war.html"),/id="warCity"/);
const sql=read("supabase/migrations/20261009_barbercraft_passport_rewards.sql");
for(const name of ["bc_admin_reward_list","bc_admin_reward_save","bc_passport_verified_visits","bc_passport_notes","bc_passport_photos"])assert.ok(sql.includes(name));
assert.match(sql,/enable row level security/i);
assert.match(sql,/is_active boolean not null default false/i);
console.log("OK navigation, SQL policies, reward/admin/passport feature guards");
