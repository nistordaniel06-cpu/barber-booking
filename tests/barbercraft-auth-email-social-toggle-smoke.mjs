import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const read=path=>fs.readFileSync(path,"utf8");
const code=read("catalog-booking.js");
new vm.Script(code,{filename:"catalog-booking.js"});
const html=read("social.html"),css=read("social.css");
assert.ok(code.includes('new URL("https://nistordaniel06-cpu.github.io/barber-booking/catalog-booking.html")'),"Email confirmations return to deployed GitHub Pages");
assert.ok(code.includes('confirmUrl.searchParams.set("salon",salon)'),"Salon context preserved in email confirmation");
assert.ok(code.includes("emailRedirectTo:confirmUrl.toString()"),"Signup passes explicit redirectTo");
assert.ok(!code.includes('emailRedirectTo:"http://localhost'),"No localhost target configured for signup");
assert.ok(html.includes('<input type="checkbox" name="public"><span>Profil vizibil în comunitate</span>'),"Public toggle has separate wrap label");
assert.ok(html.includes('<input type="checkbox" name="messages"><span>Acceptă mesaje de la persoane urmărite reciproc</span>'),"Mutual messages toggle has separate wrap label");
assert.match(css,/body\.bc-social #socialProfileForm \.socialToggle input\[type="checkbox"\]/,"Selector overrides generic form input width");
assert.match(css,/width:22px!important/,"Checkbox width pinned to 22 pixels");
assert.match(css,/height:22px!important/,"Checkbox height pinned to 22 pixels");
assert.match(css,/grid-template-columns:24px minmax\(0,1fr\)/,"Mobile labels place text next to box");
assert.match(css,/@media\(max-width:375px\)/,"Narrow viewport rules retained");
const doc=read("SUPABASE_EMAIL_REDIRECT_SETUP.md");
for(const value of ["Site URL","Redirect URLs","https://nistordaniel06-cpu.github.io/barber-booking/","https://nistordaniel06-cpu.github.io/barber-booking/**"]){
 assert.ok(doc.includes(value),"Documented required Supabase Auth setting "+value);
}
console.log("PASS: GitHub email redirects, preserved booking salon, responsive social profile toggle and Auth URL setup guide");
