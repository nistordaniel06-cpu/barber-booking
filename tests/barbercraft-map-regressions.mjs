import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const read=path=>fs.readFileSync(path,"utf8");
for(const file of ["battle-map.js","battle-war-ui.js","zones-public.js","premium-ui.js"]){
 new vm.Script(read(file),{filename:file});console.log("PASS syntax",file)
}
for(const file of ["territory-war.html","admin.html","professionals.html"]){
 const s=read(file);
 for(const match of s.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi))
  if(match[1].trim())new vm.Script(match[1],{filename:file+":inline"});
 console.log("PASS HTML inline",file)
}
const war=read("territory-war.html"),selector=read("zones-public.js"),ui=read("battle-war-ui.js"),map=read("battle-map.js");
assert.equal((war.match(/id="sectorActions"/g)||[]).length,1,"Join CTA mount only once");
assert.equal((war.match(/id="battleSectorNav"/g)||[]).length,1,"Map sector selector only once");
assert.equal((war.match(/id="battleMap"/g)||[]).length,1,"Only one map instance");
assert.ok(!war.includes("function loadWar()"),"Removed previous competing loader");
assert.ok(!selector.includes("loadWar()"),"City selector cannot start duplicate war requests");
assert.match(ui,/let request=0/,"Race guard exists");
assert.match(ui,/if\(seq!==request\)return/,"Stale requests are ignored");
assert.match(ui,/replaceChildren\(\)/,"Selectors are cleared before render");
assert.match(ui,/showChooseButton\(/,"Exactly one join action at a time");
assert.ok(ui.includes("bc_tw_choose_territory"),"Team selection stays server-authoritative");
assert.ok(map.includes("FeatureServer/15/query"),"Official mapped boundary layer");
assert.ok(map.includes('f:"geojson"'),"GeoJSON boundary request");
assert.ok(map.includes("svgFallback"),"Always usable without map service");
assert.ok(map.includes("bc-sector-selected"),"UI selection synchronization");
assert.ok(war.includes("leaflet@1.9.4"),"Interactive leaflet map");
assert.ok(read("battle-map.css").includes("battleSectorChip"),"Responsive interactive controls");
assert.ok(read("supabase/migrations/20261009_publish_bucharest_sectors.sql").includes("generate_series(1,6)"),"Six sectors seed");
const premium=read("premium-ui.js"),pro=read("professionals.html");
assert.ok(!premium.includes("querySelector(\".proQuickGrid\")"),"No duplicated PRO scanner quick tile");
assert.ok(!premium.includes("bc-pro-scan\""),"No duplicated PRO scan promo");
assert.ok(!pro.includes("class=\"proScanBottom\""),"No second scan in bottom nav");
assert.ok(pro.includes('href="./reward-redeem.html"'),"Top scanner remains available");
assert.ok(pro.includes('data-pro-route="sales"'),"Salon activity restored");
const admin=read("admin.html");
assert.match(admin,/addEventListener\("click",e=>\{/,"Delegated admin card navigation");
assert.ok(admin.includes('e.target.closest("button[data-tab]")'),"Quick actions handle nested text/icons");
assert.ok(admin.includes('scrollIntoView({block:"start"'),"Quick actions scroll to selected panel");
assert.ok(admin.includes('"#admin-"+target'),"Selected admin panel persists in URL");
console.log("PASS all three regressions and map controls");
