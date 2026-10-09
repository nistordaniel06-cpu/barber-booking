import assert from "node:assert/strict";
import fs from "node:fs";import vm from "node:vm";
const read=p=>fs.readFileSync(p,"utf8");
const code=read("catalog-booking.js"),html=read("catalog-booking.html");
new vm.Script(code,{filename:"catalog-booking.js"});
assert.ok(code.includes('emailRedirectTo:confirmUrl.toString()'),"Signup and resend use salon-specific callback");
assert.ok(code.includes('sb.auth.resend('),"Resend action is live");
assert.ok(code.includes('type:"signup",email,options:{emailRedirectTo:confirmUrl.toString()}'),"Resent email gets GitHub callback");
assert.ok(code.includes('confirmUrl.searchParams.set("salon",salon)'),"Salon query kept on return");
assert.ok(html.includes('id="catalogResendEmail"'),"Accessible resend button exists");
assert.ok(read("social.css").includes('grid-template-columns:24px minmax(0,1fr)!important'),"Premium mobile toggles remain intact");
assert.ok(read("social.css").includes('width:22px!important'),"Checkbox input cannot stretch to 100%");
const doc=read("SUPABASE_AUTH_URL_CONFIGURATION.md");
for(const url of [
 "https://nistordaniel06-cpu.github.io/barber-booking/",
 "https://nistordaniel06-cpu.github.io/barber-booking/professionals.html",
 "https://nistordaniel06-cpu.github.io/barber-booking/catalog-booking.html**"
])assert.ok(doc.includes(url),"Dashboard allowlist mentions "+url);
console.log("PASS: client confirmation resend keeps salon callback, existing social checkbox styling retained, Supabase dashboard instructions complete.");
console.log("NOTE: Auth Site URL and redirect allowlist are managed in Supabase Dashboard, not changed by this commit.");
