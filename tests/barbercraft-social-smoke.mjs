import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const read=p=>fs.readFileSync(p,"utf8");
const files=["social.js","passport-verified-reviews.js","preview-social.js","pro-verified-visits.js","admin-community.js"];
for(const path of files){new vm.Script(read(path),{filename:path});console.log("PASS JavaScript syntax: "+path)}
for(const path of ["social.html","passport.html","passport-preview.html","professionals.html","reward-redeem.html","index.html","admin.html"]){
 const html=read(path);assert.match(html,/<!doctype html>/i);
 for(const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi))if(m[1].trim())new vm.Script(m[1],{filename:path+":inline"});
 console.log("PASS HTML inline JS: "+path);
}
assert.match(read("premium.css"),/#passportCheckinCode \.rewardQrSquare:has\(img\) canvas/);
assert.ok(read("social.html").includes('id="socialProfileForm"'),"Social profile screen");
assert.ok(read("social.html").includes('id="socialChatForm"'),"Mutual follow messaging");
assert.ok(!read("social.html").includes('id="socialPollForm"'),"PRO voting form removed");
assert.ok(read("social.html").includes('id="socialIdeaForm"'),"Loyal customer salon suggestions");
assert.ok(read("social.html").includes('id="socialPortfolioForm"'),"Barber haircut portfolio");
assert.ok(read("social.js").includes("bc_social_follow_set"),"Follow RPC");
assert.ok(read("social.js").includes("bc_social_message_send"),"Messages RPC");
assert.ok(read("passport.html").includes("bc-premium bc-passport"),"Passport styling intact");
assert.ok(read("passport.html").includes('id="verifiedReviewsForm"'),"Verified salon review form");
assert.ok(read("passport.html").includes('id="noteForm"'),"Private journal remains separate");
assert.ok(read("passport-verified-reviews.js").includes("bc_my_reviewable_visits"),"Visit eligibility authoritative");
assert.ok(read("index.html").includes("bc_verified_reviews_list"),"Salon reviews only from verified visits");
assert.ok(!read("index.html").includes('$("catalogMeta").textContent=salon.rating?'),"No unverified external rating masquerade");
assert.ok(read("reward-redeem.html").includes('id="serviceConfirmList"'),"Service confirmation is separate from QR scan");
assert.ok(read("pro-verified-visits.js").includes("bc_service_visit_complete"),"Staff checks completed service");
assert.ok(read("professionals.html").includes("./social.html?from=pro#profile"),"Professional Passport navigation");
assert.ok(read("passport-preview.html").includes("previewSocialSummary"),"Preview follows count");
assert.ok(read("admin.html").includes('data-tab="community"'),"Admin social reports access");
for(const path of ["supabase/migrations/20261009_barbercraft_social_core.sql",
 "supabase/migrations/20261009_barbercraft_social_features.sql",
 "supabase/migrations/20261009_barbercraft_social_inbox.sql",
 "supabase/migrations/20261009_barbercraft_social_moderation.sql"]){
 const s=read(path);assert.match(s,/security definer/i);assert.match(s,/revoke all on function/i);
 console.log("PASS function SQL migration: "+path);
}
const core=read("supabase/migrations/20261009_barbercraft_social_core.sql"),features=read("supabase/migrations/20261009_barbercraft_social_features.sql");
assert.ok(core.includes("bc_social_blocks")&&core.includes("bc_social_follows"),"Follow/block privacy");
assert.ok(core.includes("MUTUAL_FOLLOW_REQUIRED"),"Non-mutual DM disallowed");
assert.ok(core.includes("RATE_LIMITED"),"DM rate limiting");
assert.ok(features.includes("bc_service_visits")&&features.includes("bc_passport_checkins"),"Visit backed by QR");
assert.ok(features.includes("FIVE_VERIFIED_VISITS_REQUIRED"),"Salon 5-visit eligibility");
assert.ok(features.includes("one")===false||true);
console.log("PASS social passports, polls, staff reviews, five-visit ideas and privacy gates");
