import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {portalDocument,portals} from "../tools/sync-portal-pages.mjs";
const read=p=>fs.readFileSync(p,"utf8");
for(const [portal,source] of Object.entries(portals)){
 const html=read(source),built=read(portal+"/index.html");
 assert.equal(built,portalDocument(html,portal),"Portal "+portal+" matches canonical app source");
 assert.ok(built.includes('<base href="../">'),"Portal assets resolve to app root");
 assert.ok(built.includes('name="barbercraft-portal" content="'+portal+'"'),"Explicit portal marker");
 for(const m of built.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)){
  if(m[1].trim())new vm.Script(m[1],{filename:portal+"/index.html:inline"});
 }
}
const client=read("index.html"),pro=read("professionals.html"),admin=read("admin.html");
const auth=read("auth-config.js"),sql=read("supabase/migrations/20261009210500_strict_portal_account_boundaries.sql");
assert.ok(!client.includes('class="proLink"'),"CLIENT has no PRO navigation");
assert.ok(!client.includes('href="./professionals.html"'),"CLIENT has no PRO login link");
assert.ok(!pro.includes('href="./">← Clienți'),"PRO cannot jump into client identity");
assert.ok(!admin.includes('href="./professionals.html"'),"Admin does not open PRO session");
assert.ok(!admin.includes('href="./" class="bc-admin-hub-tile"'),"Admin does not open Client session");
assert.match(auth,/BCCommitPortalLogin/,"Portal login clears the other stored tokens");
assert.match(auth,/barbercraft-client-isolated-v3/);
assert.match(auth,/barbercraft-pro-isolated-v3/);
assert.match(auth,/barbercraft-admin-isolated-v3/);
assert.match(client,/bc_client_my_approval/);
assert.match(pro,/bc_pro_portal_access/);
assert.match(admin,/bc_is_platform_admin/);
assert.ok(client.includes('BCCommitPortalLogin?.("client")'),"Explicit Client login resets old PRO session");
assert.ok(pro.includes('BCCommitPortalLogin?.("pro")'),"Explicit PRO login resets old Client session");
assert.ok(admin.includes('BCCommitPortalLogin?.("admin")'),"Explicit Admin login resets other sessions");
for(const name of [
 "bc_portal_accounts","bc_assign_portal_on_signup","bc_portal_access",
 "bc_pro_portal_access","bc_client_my_approval","bc_admin_clients_list",
 "bc_member_portal_guard","bc_partner_self_insert"
])assert.ok(sql.includes(name),"Server boundary: "+name);
assert.ok(sql.includes("on conflict (user_id) do nothing"),"Do not overwrite existing portal identity");
assert.ok(sql.includes("not staff and not is_admin"),"Staff and Admin blocked from Client portal");
assert.ok(sql.includes("p.portal='pro'"),"Membership requires PRO identity");
assert.ok(sql.includes("legacy"),"Legacy salon preserved without deleting owner");
const all={localStorage:new Map(),sessionStorage:new Map()};
const storage=key=>({setItem:(k,v)=>all[key].set(k,v),getItem:k=>all[key].get(k)||null,removeItem:k=>all[key].delete(k)});
all.localStorage.set("barbercraft-pro-isolated-v3","stale-pro-session");
all.localStorage.set("barbercraft-admin-isolated-v3","stale-admin-session");
const win={supabase:{createClient:(_url,_key,opts)=>({opts,auth:{signOut:async()=>{}}})},
 localStorage:storage("localStorage"),sessionStorage:storage("sessionStorage"),addEventListener:()=>{}};
vm.runInNewContext(auth,{window:win,Date});
win.BCCommitPortalLogin("client");
assert.equal(all.localStorage.get("barbercraft-pro-isolated-v3"),undefined);
assert.equal(all.localStorage.get("barbercraft-admin-isolated-v3"),undefined);
assert.equal(win.BCAuthClient("client").opts.auth.storageKey,"barbercraft-client-isolated-v3");
console.log("PASS: three independently routable portals, immutable server roles and cross-session sign-out");
