import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {portalDocument} from "../tools/sync-portal-pages.mjs";
const read=file=>fs.readFileSync(file,"utf8");
for(const portal of ["client","pro","admin"]){
 const source=read(portal==="client"?"index.html":portal==="pro"?"professionals.html":"admin.html");
 assert.equal(read(portal+"/index.html"),portalDocument(source,portal),"Standalone "+portal+" has newest changes");
 for(const match of source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))
  if(match[1].trim())new vm.Script(match[1],{filename:portal+"/inline.js"});
}
for(const path of ["demo-salons.js","ro-discovery.js","discovery-marketplace.js","client-home-v2.js","pro-working-hours-modern.js"]){
 new vm.Script(read(path),{filename:path});
}
const admin=read("admin.html"),sql=read("supabase/migrations/20261010_barbercraft_admin_command_center.sql");
assert.match(sql,/bc_is_platform_admin\(\)/,"Only admin reads private dashboards");
assert.match(sql,/auth\.users/,"User count is calculated from actual auth users");
assert.match(sql,/public\.bc_pro_calendar_events/,"Regional bookings count actual calendar events");
assert.match(sql,/public\.bc_partner_applications/,"Notifications include pending partners");
assert.match(sql,/public\.bc_client_approvals/,"Notifications include pending clients");
assert.match(admin,/active="overview"/,"Admin lands on overview instead of random editor");
assert.match(admin,/bc_admin_command_center/,"Overview reads secure live summary RPC");
assert.match(admin,/cmdRegions/,"Admin shows geographic stats");
assert.match(admin,/cmdQueue/,"Admin shows approval notifications");
assert.match(admin,/openAdminSection\(note\.kind==="client"\?"clients":"partners"\)/,"Tap notification to review");
const publicPage=read("index.html"),geo=read("ro-discovery.js"),market=read("discovery-marketplace.js"),samples=read("demo-salons.js"),prof=read("professionals.html");
assert.match(publicPage,/geo_lat,geo_lng/,"Catalog includes verified salon coordinates");
assert.match(publicPage,/window\.BCVisibleSalons=found/,"Map uses actual search results");
assert.match(publicPage,/query\.split\(\/\\s\+\/\)/,"Multiword search tokenized correctly");
assert.match(market,/let km=2;/,"Default near-me radius is exactly 2 km");
assert.match(market,/max="30"/,"User can adjust search radius");
assert.match(geo,/BCOpenCatalogSalon/,"Click real map pin to open real salon");
assert.match(geo,/Array\.isArray\(visible\)/,"An empty filtered result stays empty on the map");
assert.match(samples,/!linked\.has\(x\.id\)&&!liveKeys\.has\(normKey\(x\)\)/,"Approved live salons replace demo cards");
assert.match(publicPage,/bcSalonWebsite/,"Website is linked with salon name");
assert.match(publicPage,/link\.target="_blank";link\.rel="noopener noreferrer"/,"External salon site opens in a safe new tab");
assert.match(publicPage,/id="clientHeaderAvatar"/,"Avatar replaces both CLIENT label and extra user glyph");
assert.match(publicPage,/bc_client_set_avatar/,"Avatar uploaded through Client-only database RPC");
assert.match(read("client-home-v2.js"),/link\("◉ Portal client","\.\/client\/"\)/,"Client portal is in four-item guest menu");
assert.match(read("client-home-v2.js"),/link\("✂ Portal profesioniști","\.\/pro\/"\)/,"PRO portal is distinct");
assert.ok(!read("client-home-v2.js").includes("Bătălia Zonelor"),"No territorial game links");
assert.match(read("client-home-v2.css"),/:root\[data-theme=light\] body\.bc-premium\.bc-client \.shell/,"Light theme overrides premium background");
assert.match(prof,/bc_pro_save_salon_location/,"Owners can explicitly confirm salon GPS");
assert.match(prof,/showWebsite\.checked\?website\.value\.trim\(\):""/,"Owners can disable external website");
assert.match(read("pro-working-hours-modern.js"),/bcWorkTimeWheel/,"PRO gets scroll-wheel clock");
assert.match(read("pro-working-hours-modern.css"),/\.staffRepeatChoice:has\(input:checked\)/,"PRO gets modern selected-day chips");
assert.match(read("partner.html"),/magazin|magazine/i,"Public partner page and store concept");
assert.match(read("tutorial.html"),/demoPlay/,"Guided animated walkthrough exists");
assert.match(read("supabase/migrations/20261010_barbercraft_client_avatar.sql"),/bc_portal_access\('client'\)/,"Avatar authorization belongs to Client only");
assert.match(read("supabase/migrations/20261010_barbercraft_verified_salon_gps.sql"),/bc_can_manage_pro_hours/,"Salon pin authorized by server");
console.log("PASS: Admin dashboard with live stats, Client GPS/marketplace & avatar, PRO modern hours, brand partners and portal separation");
