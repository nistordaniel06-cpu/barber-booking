import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const read=name=>fs.readFileSync(name,"utf8");
const admin=read("admin.html"),editor=read("admin-explore.js"),mobile=read("admin-mobile.css"),luxury=read("admin-explore-luxury.css");
new vm.Script(editor,{filename:"admin-explore.js"});
for(const inline of admin.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)){
 if(inline[1].trim())new vm.Script(inline[1],{filename:"admin-inline"});
}
assert.ok(admin.includes('<link rel="stylesheet" href="./admin-mobile.css">'),"Legacy responsive admin rules must be loaded");
assert.ok(admin.includes('<link rel="stylesheet" href="./admin-explore-luxury.css">'),"New Explore styling must be loaded");
assert.ok(admin.indexOf("premium.css")<admin.indexOf("admin-mobile.css"),"Overrides load after premium");
assert.ok(admin.indexOf("admin-mobile.css")<admin.indexOf("admin-explore-luxury.css"),"Luxury rules load last");
assert.ok(admin.includes("<strong>Invită & promoții</strong>"),"Referral tile simplified");
assert.ok(luxury.includes('[data-tab="referrals"] strong'),"Referral heading scoped style present");
assert.ok(luxury.includes('white-space:normal!important'),"Referral labels never forced nowrap");
assert.ok(luxury.includes('overflow-wrap:anywhere!important'),"Long tile text wraps");
assert.ok(luxury.includes("@media(max-width:380px)"),"Tiny-phone styles present");
for(const selector of [".bcExploreHero",".bcExploreStats",".bcExploreCard",".bcExploreCardMedia",
 ".bcExploreCardActions",".bcExploreSection",".bcExploreServiceCard",".bcExploreServiceFields",
 ".bcExploreUploadGrid",".bcExploreEditorActions",".bcExploreField input[type=file]"]){
 assert.ok(luxury.includes(selector),"Missing premium mobile selector "+selector);
}
assert.ok(luxury.includes("grid-template-columns:1fr"),"Narrow screen fields stack");
assert.ok(mobile.includes(".bc-admin-hub-tile"),"Mobile tile fallback loaded");
for(const text of ["bc_admin_explore_list","bc_admin_explore_save","bc_admin_explore_delete",
 "bc-explore-images","Publică","Ascunde","Șterge","Salvează modificările",
 "Servicii & prețuri","Fotografii & copertă","Vizibilitate","photo_permission"]){
 assert.ok(editor.includes(text),"Preserve functional Explore feature "+text);
}
assert.ok(editor.includes("browser.hidden=true;editor.hidden=false"),"Form replaces listing on edit");
assert.ok(editor.includes("editor.hidden=true;editor.replaceChildren();browser.hidden=false"),"Back returns to listing");
assert.ok(editor.includes('prompt("Pentru ștergerea definitivă'),"Typed confirmation retained");
assert.ok(editor.includes("p_photos_authorized:rightsBox.checked"),"Media rights still required");
assert.ok(editor.includes("p_visible:visibleBox.checked"),"Admin publishes via server visibility flag");
assert.ok(editor.includes("photo_permission")&&editor.includes("mediaUrl"),"Only authorized photos shown in cards");
assert.ok(!editor.includes("innerHTML="),"User-supplied salon fields are rendered text-only");
assert.ok(!editor.includes("mero.ro"),"No MERO public CTA reintroduced");
console.log("PASS: Admin mobile stylesheet linked, luxury salon cards, focused editor, responsive referral tile and CRUD safety.");
