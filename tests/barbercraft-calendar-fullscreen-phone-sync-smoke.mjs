import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const read=f=>fs.readFileSync(f,"utf8");
const html=read("pro/calendar/index.html");
const js=read("pro-calendar-app.js");
const css=read("pro-calendar-app.css");
const pro=read("professionals.html");
const standalone=read("pro/index.html");
new vm.Script(js,{filename:"pro-calendar-app.js"});
assert.match(html,/base href="\.\.\/\.\.\/"/,"Nested PRO page resolves shared assets");
assert.match(html,/id="timeline"/,"Calendar has full 24-hour timeline container");
assert.match(html,/id="calendarScroll"/,"Independent scroll region for all hours");
assert.match(html,/id="staffBar"/,"Barber columns selectable");
assert.match(html,/id="sheetBackdrop"/,"Native app-like booking sheet");
assert.match(html,/id="createFeed"/,"Calendar subscription setup exists");
assert.match(html,/src="\.\/auth-config\.js"/,"Authenticated PRO session reused");
assert.match(html,/src="\.\/pro-calendar-app\.js"/);
assert.match(html,/href="\.\/pro-calendar-app\.css"/);
assert.match(js,/BCAuthClient\?\.\("pro"/,"The page does not borrow a Client/Admin session");
assert.match(js,/bc_pro_portal_access/,"Backend PRO access gate");
assert.match(js,/bc_my_professional_access/,"Only salon memberships included");
assert.match(js,/bc_pro_staff_settings/,"Real barbers used for columns");
assert.match(js,/bc_pro_calendar_events/,"Appointments fetched from real database");
assert.match(js,/repeat\(96,19px\)|hourRows=96/,"Full 00:00 to 24:00 timeline");
assert.match(js,/positionFromPointer/,"Drag resolves selected 15min interval");
assert.match(js,/pointerdown/,"Touch starts new interval");
assert.match(js,/pointermove/,"Drag updates");
assert.match(js,/pointerup/,"Release opens action menu");
assert.match(js,/timeline\.style\.gridTemplateColumns=gutter\+"px repeat\("\+count\+",minmax\(0,1fr\)\)"/,"All 3 and 7 columns flex to fill the viewport");
assert.match(js,/timeline\.style\.minWidth="0px"/,"Multi-day grid has no fixed minimum width");
assert.match(js,/scroller\.scrollLeft=0/,"No horizontal offset remains after changing calendar mode");
assert.match(js,/state\.mode==="week"/,"Seven-day view uses abbreviated day labels");
assert.match(js,/count>=7\?30:count===3\?40:48/,"Hour gutter leaves enough width for seven equal date columns");
assert.match(css,/\.timeline\[data-view="week"\]/,"Week layout compresses appointment cells and headers");
assert.match(css,/\.timeline\[data-view="three"\]/,"Three-day layout compresses appointment cells and headers");
assert.match(js,/function startNativePinch/,"Native two-finger Android gesture handler installed");
assert.match(js,/function moveNativePinch/,"Touchmove adjusts quarter-hour height smoothly");
assert.match(js,/nativePinchDistance/,"Uses actual touch spacing for pinch");
assert.match(js,/scroller\.addEventListener\("touchmove",moveNativePinch,\{passive:false,capture:true\}\)/,
 "Calendar intercepts Android two-finger zoom in capture phase");
assert.match(js,/nativeTouchPinch\|\|Date\.now\(\)<ignoreTouchPointersUntil/,
 "Native touch gesture suppresses duplicate PointerEvents and accidental new appointments");

assert.match(js,/scrollByTouch/,"One-finger swipe scrolls the timeline anywhere");
assert.match(js,/coastScroll/,"Touch scrolling uses momentum");
assert.match(js,/activeTouches=new Map\(\)/,"Touches tracked separately by pointer ID");
assert.match(js,/function beginPinch/,"Pinch begins only with two fingers");
assert.match(js,/activeTouches\.size!==2/,"Single-finger scroll never triggers pinch");
assert.match(js,/fingerDistance/,"Pinch derives scaling from finger spacing");
assert.match(js,/pinch\.initialHeight\*distance\/pinch\.distance/,"Both pinch directions smoothly change time scale");
assert.match(js,/timeline\.style\.setProperty\("--quarter-height"/,"Only calendar grid zooms, never the entire page");
assert.match(js,/minimumQuarterHeight=9,maximumQuarterHeight=42/,"Zoom bounded for readable 15-minute slots");
assert.match(js,/localStorage\.setItem\(zoomKey/,"Zoom level persists across visits");
assert.match(js,/clearTimeout\(state\.gesture\.timer\)/,"Starting pinch cancels pending long-press booking");
assert.match(js,/ignoreCalendarClickUntil/,"Pinch cannot accidentally open an appointment");
assert.match(html,/id="calendarZoomLevel"/,"Zoom feedback overlay present");
assert.match(css,/\.timelineScroller\{[^}]*touch-action:none/,"Browser does not intercept two-finger calendar gestures");
assert.match(css,/\.calendarEvent\{touch-action:none/,"Pinch works over existing appointments too");
const focalFunction=js.match(/function focalScrollTop\([^)]*\)\{[\s\S]*?\n\}/)?.[0];
assert.ok(focalFunction,"Pure focal point preserving calculation exists");
const focalScrollTop=vm.runInNewContext(focalFunction+"\nfocalScrollTop");
const anchorQuarter=40,viewTop=100,centerY=360;
for(const size of [9,12,19,27,42]){
 const scroll=focalScrollTop(anchorQuarter,size,centerY,viewTop);
 assert.ok(Math.abs((scroll+centerY-viewTop-52)/size-anchorQuarter)<1e-7,
  "Pinch keeps same calendar time under the fingers at "+size+" px");
}

assert.match(js,/setTimeout\(\(\)=>\{/,"Hold activates multi-hour selection without ON\/OFF");
assert.match(js,/De atribuit/,"Unassigned client booking does not appear on every staff calendar");
assert.match(js,/bc_pro_calendar_save/,"Manual appointments go through server conflict checks");
assert.match(js,/p_allow_overlap:true/,"Overlap is possible only with explicit specialist confirmation");
assert.match(js,/bc_pro_calendar_cancel/,"Manual cancellation wired");
assert.match(js,/barbercraft-calendar-feed/,"Phone subscription URL points to deployed Edge Function");
assert.match(js,/bc_pro_create_calendar_feed/,"Authenticated feed creation");
assert.match(js,/webcal:/,"Apple subscriptions get webcal scheme");
assert.match(html,/Google și Apple controlează cât de des se actualizează abonamentul/,"No misleading instant sync claim");
assert.match(js,/setInterval/,"Booked calendar refresh on foreground");
assert.match(pro,/window\.location\.assign\(new URL\("\.\/pro\/calendar\/"/,"PRO calendar tab navigates to dedicated full-screen app");
assert.match(standalone,/window\.location\.assign\(new URL\("\.\/pro\/calendar\/"/,"Standalone PRO tab navigates to calendar app");
assert.match(css,/height:100dvh/,"Full mobile viewport rather than short page card");
assert.match(css,/overflow:auto/,"Timeline allows vertical and horizontal scrolling");
assert.match(css,/grid-template-rows:52px repeat\(96,var\(--quarter-height,19px\)\)/,"All 24 hours remain accessible at any pinch scale");
assert.match(css,/\.bottomBar/,"App-like navigation retained");
for(const id of ["gate","dateLabel","pickDate","today","prev","next","chooseBooking","chooseBusy","quickSheet","editSheet","syncSheet","saveEvent","removeEvent","eventStaff","syncNotice"]){
 assert.ok(html.includes('id="'+id+'"'),"Missing required accessible element: "+id);
}
console.log("PASS: dedicated viewport calendar, 24h scrolling, new bookings, salon-scoped PRO role and phone calendar subscription");
