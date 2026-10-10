import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const read=p=>fs.readFileSync(p,"utf8");
const html=read("pro/calendar/index.html");
const app=read("pro-calendar-app.js");
const css=read("pro-calendar-app.css");
const root=read("professionals.html");
const portal=read("pro/index.html");
const legacy=read("pro-calendar-focus.js");
const client=read("demo-salons.js");
const clientCSS=read("demo-salons.css");
const passport=read("passport-preview.html");
const passportJS=read("passport-preview.js");
for(const [name,src] of [["calendar",app],["client demo",client],["passport",passportJS],["legacy",legacy]])
 new vm.Script(src,{filename:name+".js"});
assert.equal(portal,root.replace("<head>",'<head><base href="../"><meta name="barbercraft-portal" content="pro">').replace(/href="#/g,'href="./pro/#'),"PRO portal is in sync");
// Auth blocking popup cannot be dismissed into protected calendar: X goes to authenticated PRO login.
const gate=html.slice(html.indexOf('<div id="gate"'),html.indexOf('<div id="sheetBackdrop"'));
assert.match(gate,/class="popupChrome"/,"Gate offers popup toolbar");
assert.doesNotMatch(gate,/target="_blank"/,"Gate has only close/back action");

assert.match(gate,/href="\.\/pro\/" aria-label="Închide și revino la PRO"/,"Gate X goes to PRO without bypassing login");
for(const id of ["quickSheet","editSheet","syncSheet"]){
 const start=html.indexOf('id="'+id+'"'),end=html.indexOf('</section>',start);
 assert.ok(start>0&&end>start,"Popup "+id+" exists");
 const block=html.slice(start,end);
 assert.match(block,/class="popupChromeActions"/,"Popup "+id+" has controls");
 assert.doesNotMatch(block,/NewTab/,"Popup "+id+" has no new-tab action");

 assert.match(block,/aria-label="Închide"/,"Popup "+id+" has a close button");
}
assert.match(app,/function popupURL\(kind\)/,"Separate-tab URLs built for all three dialogs");
assert.match(app,/\["popupNewTabQuick","quick"\],\["popupNewTabEdit","edit"\],\["popupNewTabSync","sync"\]/);
assert.match(app,/async function restorePopupFromURL/,"New tab restores matching popup");
assert.match(app,/await restorePopupFromURL\(\)/,"Popup restoration runs only after checking PRO access");
assert.match(app,/bc_pro_portal_access/,"Backend PRO access not bypassed");
assert.match(app,/state\.events\.find\(e=>e\.id===eventId&&e\.source_provider==="manual"\)/,"Appointment deep link can only edit loaded, owned event");
assert.doesNotMatch(app,/searchParams\.set\(["'](?:clientName|client_display_name|serviceName|access_token|token)["']/,"No sensitive data placed into URLs");
assert.match(app,/discardPopupQuery\(\)/,"Closed modals remove deep-link parameters");
assert.match(css,/\.popupChromeActions/);
assert.match(css,/width:44px;height:44px/,"Touch targets sized for Android");
assert.doesNotMatch(root,/id="calendarManualNewTab"/,"Legacy editor only has X");
assert.match(root,/id="calendarCloseEditor"/,"Legacy pro modal close remains");
assert.doesNotMatch(legacy,/id="bcQuickNewTab"/,"Quick sheet only has X");
assert.match(client,/id="bcSampleClose"/,"Client salon popup has close button");
assert.match(client,/id="bcSampleNewTab"/,"Client salon popup has new-tab anchor");
assert.match(client,/url\.searchParams\.set\("previewSalon",s\.id\)/,"Client popups open same salon in new tab");
assert.match(client,/if\(match\)detail\(match\)/,"New client tab restores same sample");
assert.match(clientCSS,/\.bcSamplePopupHeader/,"Client popup actions remain visible");
assert.match(passport,/id="lightboxClose"/);
assert.match(passport,/id="lightboxNewTab"/);
assert.match(passportJS,/\$\("lightboxNewTab"\)\.href=signed\.signedUrl/,"New-tab photo uses signed link");
console.log("PASS: requested popups use X-only controls; other photo popups retain safe new-tab controls; deep links restore content after PRO auth");

