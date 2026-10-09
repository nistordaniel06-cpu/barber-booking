import assert from "node:assert/strict";
import fs from "node:fs";import vm from "node:vm";
const read=path=>fs.readFileSync(path,"utf8");
for(const path of ["auth-config.js","auth-confirmed.js","catalog-booking.js","social.js"]){
 new vm.Script(read(path),{filename:path});console.log("PASS JavaScript",path);
}
for(const path of ["index.html","professionals.html","catalog-booking.html","social.html","auth-confirmed.html"]){
 const html=read(path);assert.match(html,/<!doctype html>/i);
 for(const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi))
 if(match[1].trim())new vm.Script(match[1],{filename:path+":inline"});
 console.log("PASS HTML",path);
}
const auth=read("auth-config.js"),index=read("index.html"),pro=read("professionals.html"),
 catalog=read("catalog-booking.js"),callback=read("auth-confirmed.js"),social=read("social.html"),css=read("social.css");
assert.ok(auth.includes('https://nistordaniel06-cpu.github.io/barber-booking/'),"GitHub Pages is configured base");
assert.ok(auth.includes('BARBERCRAFT_AUTH_CONFIRM_URL'),"Confirmation return URL defined centrally");
assert.ok(index.includes('emailRedirectTo:window.BARBERCRAFT_AUTH_CONFIRM_URL'),"Client signup returns to GitHub confirmation");
assert.ok(pro.includes('emailRedirectTo:window.BARBERCRAFT_SITE_URL+"professionals.html"'),"PRO signup returns to professional portal");
assert.ok(catalog.includes('emailRedirectTo:window.BARBERCRAFT_AUTH_CONFIRM_URL'),"Catalog client signup explicitly redirects");
for(const path of ["index.html","professionals.html","catalog-booking.js"]){
 assert.ok(read(path).includes('auth.resend({type:"signup",email'),"Resend exists for old localhost email links in "+path);
}
assert.ok(callback.includes('client.auth.getUser()'),"Callback verifies user identity");
assert.ok(callback.includes('getSession()'),"Callback consumes hosted browser session");
assert.ok(callback.includes('error_description'),"Callback displays expired/invalid confirmation links");
assert.ok(!callback.includes("setSession({"),"Callback must not share refresh tokens across client and PRO sessions");
assert.ok(social.includes('<span>Permite afișarea profilului în comunitate</span>'),"Public-profile toggle label wraps independently");
assert.ok(social.includes('<span>Acceptă mesaje de la persoane urmărite reciproc</span>'),"Reciprocal-messaging label wraps independently");
assert.match(css,/#socialProfileForm \.socialToggle input\[type="checkbox"\]/,"Higher specificity checkbox sizing");
assert.ok(css.includes('width:44px!important'),"Switch width overrides old 100% input");
assert.ok(css.includes('flex:0 0 44px!important'),"Switch cannot collapse on mobile");
assert.ok(css.includes('input[type="checkbox"]:checked'),"Switch checked state is visible");
assert.ok(css.includes('input[type="checkbox"]:focus-visible'),"Keyboard focus remains visible");
assert.ok(css.includes('@media(max-width:390px)'),"Tiny Android/iPhone switch layout");
assert.ok(read("SUPABASE_EMAIL_CONFIRMATION_SETUP.md").includes('Authentication → URL Configuration'),"Dashboard step documented");
console.log("PASS: GitHub email confirmation target, resend flow, PRO session isolation and premium Passport switches.");
