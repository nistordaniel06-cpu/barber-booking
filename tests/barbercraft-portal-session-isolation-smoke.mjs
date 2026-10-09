import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const read=path=>fs.readFileSync(path,"utf8");
const made=[];
const fake={createClient:(url,key,options)=>{
 const handle={auth:{getUser:async()=>({data:{user:null}})},opts:options};
 made.push(handle);return handle;
}};
const win={supabase:fake};
const context=vm.createContext({window:win,URLSearchParams,location:{search:""},document:{addEventListener:()=>{}}});
new vm.Script(read("auth-config.js"),{filename:"auth-config.js"}).runInContext(context);
const client=win.BCAuthClient("client"),pro=win.BCAuthClient("pro"),admin=win.BCAuthClient("admin");
assert.equal(client.opts.auth.storageKey,"barbercraft-client-session");
assert.equal(pro.opts.auth.storageKey,"barbercraft-pro-session");
assert.equal(admin.opts.auth.storageKey,"barbercraft-admin-session");
assert.equal(new Set(made.map(x=>x.opts.auth.storageKey)).size,3,"No shared browser session key");
assert.equal(win.BCAuthClient("client"),client,"One auth instance for client pages");
assert.equal(win.BCAuthClient("pro"),pro,"One auth instance for PRO");
assert.equal(win.BCAuthClient("admin"),admin,"One auth instance for Admin");
assert.equal(made.length,3,"Scoped auth helpers cache their instances");
assert.equal(admin.opts.auth.detectSessionInUrl,false,"Admin must not process client recovery links");
assert.throws(()=>win.BCAuthClient("other"),/Invalid BARBERCRAFT portal/);
async function passportScope(search,expected){
 let chosen=null;
 const windowMock={BCAuthClient:scope=>{chosen=scope;return {scope}}};
 const ctx=vm.createContext({window:windowMock,URLSearchParams,location:{search},
 document:{addEventListener:()=>{}}});
 new vm.Script(read("passport-session.js")).runInContext(ctx);
 const resolved=await windowMock.BCPassportSession();
 assert.equal(chosen,expected);assert.equal(resolved.scope,expected);
}
await passportScope("?from=pro","pro");
await passportScope("","client");
await passportScope("?from=client","client");
for(const path of ["index.html","professionals.html","admin.html","catalog-booking.js",
 "referral.js","passport-session.js","pilot-control.js","pro-lifecycle.js",
 "reward-redeem.js","battle-war-ui.js","kingdom-strategy.js","pilot-client.js",
 "passport.js","passport-preview.js"]){
 const s=read(path);
 if(path.endsWith(".js"))new vm.Script(s,{filename:path});
 console.log("PASS JS parse",path);
}
const index=read("index.html"),proHtml=read("professionals.html"),adminHtml=read("admin.html"),
 referral=read("referral.js"),catalog=read("catalog-booking.js");
assert.ok(index.includes('BCAuthClient("client")'),"Client portal uses branded client storage");
assert.ok(proHtml.includes('BCAuthClient("pro"'),"PRO portal uses PRO storage");
assert.ok(adminHtml.includes('BCAuthClient?.("admin"'),"Admin portal uses Admin storage");
assert.ok(catalog.includes('BCAuthClient("client")'),"Catalog requires a Client session");
assert.ok(!read("passport-session.js").includes("[client,pro]"),"No Passport cross-portal fallback");
assert.ok(!referral.includes('for(const which of [mode,'),"Referral doesn't try opposite portal");
assert.ok(referral.includes('data:{barbercraft_account_type:scope==="pro"?"professional":"client"}'),"Referral signup persists intended account type");
assert.ok(read("pilot-control.js").includes('BCAuthClient?.("pro"'),"PRO-only booking configuration");
assert.ok(read("reward-redeem.js").includes('BCAuthClient("pro"'),"PRO staff scanner can't borrow Client session");
for(const [name,source] of [["Client",index],["PRO",proHtml],["Admin",adminHtml],["Catalog",catalog]]){
 assert.ok(source.includes('signOut({scope:"local"})'),name+" logout is local");
 assert.ok(!source.includes('.auth.signOut()'),name+" must not use global signout");
}
const migrate=read("supabase/migrations/20261009_isolate_client_pro_accounts.sql");
assert.ok(migrate.includes("not in ('professional','pro','admin')"),"PRO signups excluded from Client queue");
assert.ok(migrate.includes("bc_pro_portal_access"),"Role isolation enforced by backend");
assert.ok(migrate.includes("wrong_portal"),"Client identity rejected when it is PRO-only");
assert.ok(migrate.includes("bc_client_my_approval()->>'status'"),"Public booking checks actual portal type");
assert.ok(migrate.includes("not exists(select 1 from public.bc_platform_admins"),"Admin account excluded from Client approval queue");
console.log("PASS: independent Client/PRO/Admin sessions, role checks, local sign-out and no cross-portal fallback.");
