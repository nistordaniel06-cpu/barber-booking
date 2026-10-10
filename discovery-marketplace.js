/* Marketplace search controls: confirmed 2 km GPS radius and niche services. */
(()=>{"use strict";
const home=document.getElementById("home");if(!home)return;
const $=id=>document.getElementById(id),normalize=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
const haversine=(lat1,lon1,lat2,lon2)=>{
 const rad=Math.PI/180,a=Math.sin((lat2-lat1)*rad/2)**2+
 Math.cos(lat1*rad)*Math.cos(lat2*rad)*Math.sin((lon2-lon1)*rad/2)**2;
 return 12742*Math.asin(Math.min(1,Math.sqrt(a)));
};
let km=2;try{const saved=Number(localStorage.getItem("bc-client-search-radius-km"));if(saved>=1&&saved<=30)km=saved}catch(_){}
let coordinates=null,active=false;
const radius=document.createElement("section");radius.id="bcRadiusPanel";radius.className="bcRadiusPanel";radius.hidden=true;
radius.innerHTML='<div class="bcRadiusHeader"><strong>📍 Raza de căutare</strong><b id="bcRadiusValue">2 km</b></div><input id="bcRadiusSlider" type="range" min="1" max="30" step="1" aria-label="Raza maximă în kilometri"><div class="bcRadiusHints"><span>1 km</span><span>30 km</span></div><p id="bcRadiusHelp" role="status">Se afișează exclusiv saloanele cu o poziție GPS confirmată în raza aleasă.</p>';
$("bcNearMe")?.insertAdjacentElement("afterend",radius);
const slider=$("bcRadiusSlider"),label=$("bcRadiusValue");
function changeRadius(next){
 km=Math.max(1,Math.min(30,Number(next)||2));
 slider.value=String(km);label.textContent=km+" km";
 try{localStorage.setItem("bc-client-search-radius-km",String(km))}catch(_){}
 window.BCRefreshSearch?.();window.BCLocationMap?.updatePins?.();
}
slider.value=String(km);label.textContent=km+" km";
slider.addEventListener("input",()=>changeRadius(slider.value));
window.BCLocationRadius={
 state:()=>({enabled:active,km}),
 position:()=>coordinates?{...coordinates}:null,
 setRadius:changeRadius,
 setPosition:(lat,lon)=>{
  if(!Number.isFinite(lat)||!Number.isFinite(lon))return;
  coordinates={lat,lon};active=true;radius.hidden=false;
  $("bcNearMe")?.setAttribute("aria-pressed","true");
  window.BCRefreshSearch?.();window.BCLocationMap?.updatePins?.();
 },
 clear:()=>{
  active=false;coordinates=null;radius.hidden=true;
  $("bcNearMe")?.setAttribute("aria-pressed","false");
  window.BCRefreshSearch?.();window.BCLocationMap?.updatePins?.();
 },
 distance:salon=>{
  if(!coordinates)return null;
  const lat=Number(salon.geo_lat),lon=Number(salon.geo_lng);
  if(salon.geo_lat===null||salon.geo_lat===undefined||salon.geo_lng===null||salon.geo_lng===undefined||
   !Number.isFinite(lat)||!Number.isFinite(lon))return null;
  return haversine(coordinates.lat,coordinates.lon,lat,lon);
 }
};
const rare=[
 ["Skin fade","Skin fade"],["Tunsori creative","design"],
 ["Hair tattoo","hair tattoo"],["Vopsit păr","vopsit"],
 ["Dreadlocks","dreadlocks"],["Barbă premium","barbă premium"],
 ["Tratamente scalp","scalp"],["Tuns copii","copii"]
];
window.BCDiscoveryRareServices=[];
// Accessible service suggestions inspired by the best booking marketplace searches.
const categories=document.createElement("section");categories.className="bcServiceSuggestions";
categories.setAttribute("aria-label","Caută rapid după tipul de serviciu");
const heading=document.createElement("h3");heading.textContent="Ce ai nevoie astăzi?";categories.append(heading);
const scroller=document.createElement("div");scroller.className="bcServiceScroller";
for(const [title,term] of [["✂ Frizerie & barber","tuns"],["♙ Aranjat barbă","barbă"],["✨ Fade","fade"],["♛ Experiență VIP","vip"],["♧ Îngrijire scalp","scalp"],["◌ Coafor & styling","coafor"],["☀ Vopsit păr","vopsit"],["✧ Tuns copii","copii"]]){
 const b=document.createElement("button");b.type="button";b.textContent=title;
 b.onclick=()=>{
  const search=$("search");if(!search)return;
  search.value=term;search.dispatchEvent(new Event("input",{bubbles:true}));
  search.scrollIntoView({block:"center",behavior:"smooth"});
 };scroller.append(b);
}
categories.append(scroller);
const searchPanel=home.querySelector(".search");
searchPanel?.insertAdjacentElement("afterend",categories);
const details=document.querySelector(".bcAdvancedFilters");
if(details){
 details.open=false; // Closed by default. Expand only after a direct user tap.
 const section=document.createElement("section");section.className="bcRareServices";
 section.append(document.createElement("h3"));section.querySelector("h3").textContent="Servicii speciale · ce cauți mai rar";
 const info=document.createElement("p");info.textContent="Afișăm doar saloanele care au declarat serviciile respective.";
 section.append(info);
 const buttons=document.createElement("div");buttons.className="bcRareButtons";
 for(const [name,term] of rare){
  const b=document.createElement("button");b.type="button";b.textContent=name;b.dataset.rareService=term;b.setAttribute("aria-pressed","false");
  b.onclick=()=>{
   b.setAttribute("aria-pressed",b.getAttribute("aria-pressed")==="true"?"false":"true");
   window.BCDiscoveryRareServices=[...buttons.querySelectorAll('[aria-pressed="true"]')].map(x=>x.dataset.rareService);
   window.BCRefreshSearch?.();window.BCUpdateDemoSearch?.();
  };buttons.append(b);
 }
 section.append(buttons);
 const reset=document.createElement("button");reset.type="button";reset.className="bcRareClear";reset.textContent="Curăță filtrele speciale";
 reset.onclick=()=>{
  buttons.querySelectorAll("button").forEach(b=>b.setAttribute("aria-pressed","false"));
  window.BCDiscoveryRareServices=[];window.BCRefreshSearch?.();window.BCUpdateDemoSearch?.();
 };
 section.append(reset);details.append(section);
}
// Marketing is always a clear link, never an unconsented popup.
const partner=document.createElement("aside");partner.className="bcPartnerBanner";
partner.innerHTML='<strong>Ai un salon, un brand sau distribui produse pentru frizeri?</strong><p>Intră în ecosistemul BARBERCRAFT: profil de salon, programări, servicii și posibilitatea unui magazin cu produse personalizate.</p><a href="./partner.html">Devino partener BARBERCRAFT ↗</a>';
home.append(partner);
document.getElementById("search")?.addEventListener("input",()=>window.BCUpdateDemoSearch?.());
document.querySelectorAll("#countyFilter,#cityFilter,#sectorFilter").forEach(s=>s.addEventListener("change",()=>window.BCUpdateDemoSearch?.()));
window.addEventListener("bc-discovery-results",()=>window.BCUpdateDemoSearch?.());
})();
