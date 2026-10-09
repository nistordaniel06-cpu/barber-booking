import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const read=p=>fs.readFileSync(p,"utf8");
const site="https://nistordaniel06-cpu.github.io/barber-booking/";
const config={window:{}};
vm.runInNewContext(read("auth-config.js"),config);
assert.equal(config.window.BARBERCRAFT_AUTH_REDIRECT_CLIENT,site);
assert.equal(config.window.BARBERCRAFT_AUTH_REDIRECT_PRO,site+"professionals.html");
for(const file of ["catalog-booking.js","social.js"]){
 new vm.Script(read(file),{filename:file});
}
for(const file of ["index.html","professionals.html","social.html","catalog-booking.html"]){
 const html=read(file);
 for(const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)){
  if(match[1].trim())new vm.Script(match[1],{filename:file+":inline"});
 }
}
const booking=read("catalog-booking.js");
const main=read("index.html");
const pro=read("professionals.html");
const bookingHtml=read("catalog-booking.html");
assert.match(booking,/emailRedirectTo:window\.BARBERCRAFT_AUTH_REDIRECT_CLIENT/);
assert.match(booking,/sb\.auth\.resend\(/);
assert.match(booking,/type:"signup"/);
assert.match(booking,/options:\{emailRedirectTo:window\.BARBERCRAFT_AUTH_REDIRECT_CLIENT\}/);
assert.match(bookingHtml,/id="catalogResendEmail"/);
assert.match(bookingHtml,/<button type="button" id="catalogResendEmail"/);
assert.match(main,/emailRedirectTo:window\.BARBERCRAFT_AUTH_REDIRECT_CLIENT/);
assert.match(pro,/emailRedirectTo:window\.BARBERCRAFT_AUTH_REDIRECT_PRO/);
for(const [name,value] of [["client",config.window.BARBERCRAFT_AUTH_REDIRECT_CLIENT],["pro",config.window.BARBERCRAFT_AUTH_REDIRECT_PRO]]){
 assert.equal(new URL(value).protocol,"https:","Confirmation redirect is HTTPS: "+name);
 assert.equal(new URL(value).hostname,"nistordaniel06-cpu.github.io");
 assert.equal(new URL(value).pathname.startsWith("/barber-booking/"),true);
}
const social=read("social.html"),css=read("social.css");
assert.match(social,/<label class="socialToggle"><input type="checkbox" name="public"><span>/);
assert.match(social,/<label class="socialToggle"><input type="checkbox" name="messages"><span>/);
assert.match(css,/#socialProfileForm label\.socialToggle input\[type="checkbox"\]/);
assert.match(css,/flex:0 0 22px!important/);
assert.match(css,/width:22px!important;height:22px!important/);
assert.match(css,/-webkit-appearance:checkbox!important/);
assert.match(css,/label\.socialToggle span\{/);
assert.match(css,/overflow-wrap:anywhere/);
assert.match(css,/@media\(max-width:390px\)/);
const docs=read("SUPABASE_AUTH_URL_CONFIGURATION.md");
assert.ok(docs.includes(site),"Dashboard configuration includes production Site URL");
assert.ok(docs.includes("professionals.html"),"Dashboard allowlist includes PRO callback URL");
console.log("PASS confirmation redirects configured in all 3 registration flows, resend wired, native checkboxes sized and centered.");
console.log("NOTE Supabase Site URL / allowed redirect URLs must also be configured separately in its dashboard.");
