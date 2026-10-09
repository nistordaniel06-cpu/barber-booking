import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const read=p=>fs.readFileSync(p,"utf8");
const scripts=["social.js","social-feed.js","passport-session.js","passport-checkin.js",
 "passport-qr-render.js","ro-discovery.js","passport.js","passport-preview.js"];
for(const file of scripts){new vm.Script(read(file),{filename:file});console.log("PASS syntax:",file)}
for(const file of ["social.html","professionals.html","passport.html","passport-preview.html"]){
 const html=read(file);assert.match(html,/<!doctype html>/i);
 for(const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi))
  if(match[1].trim())new vm.Script(match[1],{filename:file+":inline"});
 console.log("PASS HTML inline:",file);
}
const social=read("social.html"),socialJs=read("social.js");
assert.ok(social.includes('id="socialFeed"'),"Chronological Discover feed mount exists");
assert.ok(social.includes('id="socialPostForm"'),"Community publishing is available");
assert.ok(social.includes('id="socialFeedMore"'),"Feed pagination exists");
assert.ok(!social.includes('id="socialPollForm"'),"No PRO haircut poll publishing");
assert.ok(!socialJs.includes("bc_barber_poll_create"),"PRO cannot create retired polls");
assert.ok(socialJs.includes('ideasTab.hidden=!!pro'),"Ideas UI not shown to barber");
assert.ok(social.includes("passport-session.js")&&social.includes("social-feed.js"),"Unified session and feed scripts load");
const feed=read("social-feed.js");
for(const rpc of ["bc_social_feed","bc_social_post_create","bc_social_follow_set","bc_social_post_delete","bc_social_post_report"]){
 assert.ok(feed.includes(rpc),"Feed hooked to "+rpc);
}
assert.ok(feed.includes('if(user&&p.author_id!==user.id)'),"Follow all discoverable accounts");
assert.ok(feed.includes("p_before:cursor"),"Latest-first pagination");
assert.ok(feed.includes("socialPostImage"),"Image post rendering");
const pro=read("professionals.html");
assert.ok(!pro.includes("./social.html#ideas"),"PRO homepage no salon ideas shortcut");
assert.ok(pro.includes("./passport.html?from=pro#passportCheckin"),"PRO personal QR passport is accessible");
assert.ok(pro.includes("./social.html?from=pro#profile"),"PRO profile opens correct authentication session");
const passport=read("passport.html"),preview=read("passport-preview.html");
assert.ok(passport.includes("passport-session.js"),"Passport has unified PRO session");
assert.ok(preview.includes("passport-session.js"),"Preview uses unified PRO session");
assert.ok(passport.includes("qrcode-generator/1.4.4/qrcode.min.js"),"Sync QR matrix generator installed");
assert.ok(passport.includes("passport-qr-render.js"),"Dedicated QR renderer loaded");
assert.ok(read("passport-checkin.js").includes("BCRenderPassportQr"),"Check-in uses QR SVG renderer");
const css=read("premium.css");
assert.ok(css.includes("rewardQrSquare svg"),"SVG remains visible");
assert.ok(css.includes(".rewardQrSquare:has(img) canvas"),"Legacy browser canvas fallback styled");
const socialCss=read("social.css");
assert.match(socialCss,/box-sizing:border-box/,"Form elements constrained to viewport");
assert.match(socialCss,/socialPostImage/,"Feed photos are responsive");
const location=read("ro-discovery.js");
assert.ok(location.includes("usePosition(true)"),"Home automatically requests location");
assert.ok(location.includes("manualSelection=true;setAll()"),"Explicit all-Romania overrides GPS");
assert.ok(location.includes('getItem("bc-location-city")'),"Chosen city persists");
assert.ok(location.includes("if(manualSelection)return"),"Late GPS cannot override manual city");
const migration=read("supabase/migrations/20261009_social_public_feed.sql");
assert.ok(migration.includes("bc_social_profiles p")&&migration.includes("p.is_public"),"Non-public accounts excluded from global feed");
assert.ok(migration.includes("bc_social_blocks"),"Blocked authors excluded");
assert.ok(migration.includes("POST_RATE_LIMIT"),"Posting rate limited");
assert.ok(migration.includes("revoke execute on function public.bc_barber_poll_create"),"Retired polls disabled server-side");
function shape(tag){return {tag,attrs:{},children:[],setAttribute(k,v){this.attrs[k]=v},append(x){this.children.push(x)}}}
const sandbox={window:{qrcode:()=>({addData(){},make(){},getModuleCount:()=>21,
 isDark:(r,c)=>r%3===0||c%5===0})},document:{createElementNS:(_,tag)=>shape(tag)}};
vm.runInNewContext(read("passport-qr-render.js"),sandbox);
const root={children:[],replaceChildren(...children){this.children=children}};
assert.equal(sandbox.window.BCRenderPassportQr(root,"BCP1|mock-identity"),true);
assert.equal(root.children[0].tag,"svg","Vector QR is rendered, not an empty image");
assert.equal(root.children[0].attrs.viewBox,"0 0 29 29");
assert.ok(root.children[0].children[1].attrs.d.length>200,"Many dark modules actually drawn");
console.log("PASS opt-in chronological feed, PRO layout removals, GPS override and actual SVG QR module rendering");
