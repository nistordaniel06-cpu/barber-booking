import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const read=f=>fs.readFileSync(f,"utf8");
const pro=read("professionals.html"),standalone=read("pro/index.html"),
  calendar=read("pro-calendar-focus.js"),style=read("pro-calendar-focus.css"),
  feed=read("social-feed.js"),social=read("social.html"),
  cooldown=read("supabase/migrations/20261009215000_client_feed_post_cooldown.sql"),
  ledger=read("supabase/migrations/20261009215100_client_feed_immutable_post_ledger.sql");
for(const [name,text] of [["calendar",calendar],["feed",feed]])new vm.Script(text,{filename:name+".js"});
assert.ok(pro.includes('src="./pro-calendar-focus.js"'),"PRO calendar logic linked");
assert.ok(pro.includes('href="./pro-calendar-focus.css"'),"Full-screen calendar stylesheet linked");
assert.ok(standalone.includes('src="./pro-calendar-focus.js"'),"Standalone PRO portal loads identical calendar");
assert.ok(pro.includes('let calendarMode="day"'),"Day-by-specialist default");
assert.ok(pro.includes('let calendarDragEnabled=true'),"Drag is active automatically");
assert.ok(pro.includes('id="calendarDragToggle" aria-pressed="true" hidden'),"Toggle remains hidden for legacy handlers");
assert.ok(!pro.includes("Glisează pentru blocaj · OFF"),"Never shows ON/OFF button");
assert.ok(calendar.includes("bcCalendarFocus"),"Fullscreen calendar state");
assert.ok(calendar.includes('grid.style.gridTemplateColumns'),"Columns render per specialist");
assert.ok(calendar.includes('bc_pro_staff_settings'),"Real salon specialists are loaded");
assert.ok(calendar.includes('bc_pro_team_list'),"Real professional names shown for manager");
assert.ok(calendar.includes('pointerdown')&&calendar.includes('pointermove')&&calendar.includes('pointerup'),"Drag starts, moves and finishes");
assert.ok(calendar.includes('const rowHeight=rect.height'),"Touch uses actual cell geometry");
assert.ok(calendar.includes('scrollStart:scroller.scrollTop'),"Autoscroll length is measured");
assert.ok(calendar.includes('15'),"Quarter-hour selection");
assert.ok(calendar.includes('bcQuickBook')&&calendar.includes('bcQuickBlock'),"Only simple booking or blocking actions");
assert.ok(calendar.includes('originalOpen(start,null,end)'),"Selected time range enters existing functional booking flow");
assert.ok(calendar.includes('calendarEvents'),"Existing persisted bookings remain visible");
assert.ok(style.includes("100dvh")&&style.includes("touch-action:none"),"Mobile full-screen drag and drop styling");
assert.ok(style.includes('.bcCalendarQuick')&&style.includes('.bcTeamFilters'),"Sheet and barber filters styled");
assert.ok(feed.includes("bc_social_post_cooldown"),"UI queries server rate limit");
assert.ok(feed.includes("clientCooldown"),"UI guards rapid client posts");
assert.ok(feed.includes("setInterval"),"Composer unlocks without refreshing the page");
assert.ok(social.includes('id="socialFeedCooldown"'),"Countdown next to post form");
assert.ok(cooldown.includes("pg_advisory_xact_lock"),"Concurrent rapid posts serialized server-side");
assert.ok(ledger.includes("bc_social_client_post_log"),"Deletion does not reset cooldown");
assert.ok(ledger.includes("interval '15 minutes'"),"Client minimum wait");
assert.ok(ledger.includes("interval '24 hours'"),"Client rolling limit");
assert.ok(ledger.includes(">=6"),"Max six client posts in 24 hours");
assert.ok(ledger.includes("PUBLIC_PROFILE_REQUIRED"),"Only public profiles can post");
assert.ok(ledger.includes("if public.bc_social_is_barber(u) then"),"PRO retains independent posting quota");
assert.ok(ledger.includes("grant execute"),"Secure RPC available");
console.log("PASS: calendar day/specialist drag workflow, mobile fullscreen and server-enforced client anti-spam");
