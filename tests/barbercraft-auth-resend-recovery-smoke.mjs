import assert from "node:assert/strict";
import fs from "node:fs";import vm from "node:vm";
const read=p=>fs.readFileSync(p,"utf8");
for(const path of ["index.html","professionals.html","catalog-booking.html"]){
 const html=read(path);
 for(const part of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)){
  if(part[1].trim())new vm.Script(part[1],{filename:path});
 }
 console.log("PASS inline JS",path);
}
new vm.Script(read("catalog-booking.js"),{filename:"catalog-booking.js"});
const home=read("index.html"),pro=read("professionals.html"),book=read("catalog-booking.js"),catalog=read("catalog-booking.html");
assert.ok(home.includes('id="resendSignupBtn"'),"Client resend visible");
assert.ok(pro.includes('id="proResendConfirmation"'),"PRO resend visible");
assert.ok(catalog.includes('id="catalogResendConfirmation"'),"Catalog resend visible");
for(const [file,text] of [["index.html",home],["professionals.html",pro],["catalog-booking.js",book]]){
 assert.ok(text.includes('auth.resend({type:"signup",email'),"Supabase signup resend wired in "+file);
 assert.ok(text.includes('emailRedirectTo:'),"Production redirect specified in "+file);
 assert.ok(!text.includes('emailRedirectTo:"http://localhost'),"No localhost redirect hardcoded");
}
assert.ok(book.includes('confirmUrl.searchParams.set("salon",salon)'),"Resend keeps catalog salon context");
assert.ok(book.includes('emailRedirectTo:confirmUrl.toString()'),"Catalog resend and signup use public GitHub URL");
const social=read("social.css");
assert.match(social,/#socialProfileForm \.socialToggle input\[type="checkbox"\]/,"Legacy 100% checkbox width overridden");
assert.ok(social.includes("width:22px!important"),"Native 22px checkbox remains fully visible");
assert.ok(read("SUPABASE_EMAIL_REDIRECT_SETUP.md").includes("Site URL"),"Required hosted Supabase URL configuration documented");
console.log("PASS: resend signup e-mails to hosted GitHub Pages with catalog context; mobile social checkbox fix retained.");
