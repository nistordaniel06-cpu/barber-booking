import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const read=path=>fs.readFileSync(path,"utf8");
const admin=read("admin.html");
const referral=read("referral.js");
const css=read("referral.css");
const clients=read("admin-clients.js");
new vm.Script(referral,{filename:"referral.js"});
new vm.Script(clients,{filename:"admin-clients.js"});
for(const match of admin.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)){
 if(match[1].trim())new vm.Script(match[1],{filename:"admin-inline.js"});
}
assert.ok(admin.includes('data-tab="clients"'),"Client approval tab exists");
assert.ok(admin.includes('"community","clients","moderation","audit"].includes(target)'),"Dashboard click handler supports clients instead of silently dropping click");
assert.ok(admin.includes('window.addEventListener("hashchange"'),"Client approval deep-link supported after page is open");
assert.ok(admin.includes('history.replaceState(null,"","#admin-"+target)'),"Tab selection keeps deep-link synchronized");
assert.ok(admin.includes('BCAdminClients.render(sb,c)'),"Client approval component invoked");
assert.ok(admin.includes("client-approval")||admin.includes("Clienți de aprobat"),"Approvals labeled clearly");
assert.ok(admin.includes('href="./referral.html?type=client"'),"Customer invitations reachable from Admin");
assert.ok(admin.includes('href="./" class="bc-admin-hub-tile"'),"Customer-facing homepage linked from Admin");
assert.ok(referral.includes('new URL("./referral.html",location.href)'),"Customer referral URLs are absolute for sharing");
assert.ok(referral.includes('const link=n("a","Deschide linkul ↗")'),"Customer referral URL is clickable");
assert.ok(referral.includes('input.select()'),"Manual copy fallback provided for phone browsers");
assert.ok(referral.includes('await draw()'),"New referral links refresh persisted list");
assert.ok(css.includes('.refShareUrl')&&css.includes('@media(max-width:540px)'),"Referral link fits mobile viewport");
assert.ok(clients.includes('bc_admin_clients_list'),"Only admin-only RPC used to fetch clients");
assert.ok(clients.includes('bc_admin_client_review'),"Admin review actions use authorization guard");
console.log("PASS: Admin client approvals navigation and deep-link; customer app and referral links; mobile copy fallback.");
