/* BARBERCRAFT location-aware discovery and map of Romania.
 No user coordinates sent to our server. Geolocation requires browser permission.
 Map clusters show CITY-LEVEL salon counts; not fabricated exact salon pins. */
(()=>{"use strict";
const $=id=>document.getElementById(id),home=$("home"),county=$("countyFilter"),city=$("cityFilter"),sector=$("sectorFilter");
if(!home||!city)return;
const locations=[
["București",44.4268,26.1025],["Cluj-Napoca",46.7712,23.6236],["Iași",47.1585,27.6014],
["Timișoara",45.7489,21.2087],["Constanța",44.1598,28.6348],["Brașov",45.6579,25.6012],
["Craiova",44.3302,23.7949],["Ploiești",44.94,26.02],["Pitești",44.8565,24.8692],
["Sibiu",45.7983,24.1256],["Oradea",47.0465,21.9189],["Arad",46.1866,21.3123],
["Bacău",46.5719,26.9149],["Buzău",45.1503,26.8238],["Suceava",47.6635,26.2732],
["Târgu Mureș",46.5425,24.5575],["Galați",45.4353,28.008],["Brăila",45.2692,27.9575],
["Baia Mare",47.6573,23.5681],["Satu Mare",47.79,22.885],["Râmnicu Vâlcea",45.0997,24.3693],
["Târgu Jiu",45.045,23.274],["Botoșani",47.75,26.667],["Focșani",45.6965,27.184],["Alba Iulia",46.068,23.57],
["Deva",45.878,22.911],["Slatina",44.434,24.371],["Reșița",45.3,21.885],["Giurgiu",43.9,25.97],
["Alexandria",43.971,25.333],["Călărași",44.2,27.33],["Tulcea",45.178,28.805],
["Bistrița",47.132,24.501],["Zalău",47.185,23.057],["Sfântu Gheorghe",45.867,25.788],
["Miercurea Ciuc",46.359,25.801],["Vaslui",46.64,27.728],["Bârlad",46.231,27.668],
["Târgoviște",44.924,25.457],["Drobeta-Turnu Severin",44.63,22.658],["Slobozia",44.567,27.366]
];
const norm=x=>String(x||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
const dist=(a,b,c,d)=>{let r=Math.PI/180,la=(c-a)*r,lo=(d-b)*r,term=Math.sin(la/2)**2+Math.cos(a*r)*Math.cos(c*r)*Math.sin(lo/2)**2;return 6371*2*Math.asin(Math.sqrt(term))};
const controls=document.createElement("div");controls.className="bcDiscoverBar";controls.innerHTML=
 '<div class="bcDiscoverActions"><button id="bcNearMe" type="button">⌖ Lângă mine</button><button id="bcAllRomania" type="button">▦ Toată România</button><button id="bcShowMap" type="button" aria-pressed="false">▧ Vezi harta</button></div><p id="bcLocationNotice" role="status"></p>';
const search=home.querySelector(".search");search?.insertAdjacentElement("beforebegin",controls);
const drawer=document.createElement("details");drawer.className="bcAdvancedFilters";
drawer.innerHTML='<summary>Filtre suplimentare · județ, oraș, sector</summary>';
const current=home.querySelector(".locationFilters");if(current)drawer.append(current);
controls.insertAdjacentElement("afterend",drawer);
const mapCard=document.createElement("section");mapCard.className="bcCountryMap";mapCard.hidden=true;
mapCard.innerHTML='<div class="bcMapHeader"><div><strong>Explorează saloanele din România</strong><small>Marcaje agregate pe oraș. Nu sunt poziții exacte ale saloanelor.</small></div><button id="bcMapClose" type="button">Închide</button></div><div id="bcMapRoot" aria-label="Harta României cu saloane grupate pe oraș"></div><div id="bcMapLegend"></div>';
drawer.insertAdjacentElement("afterend",mapCard);
let map=null,markers=null,lastCity=null,pendingCity=null,manualSelection=false;
const notice=$("bcLocationNotice");
function refreshSearch(){window.BCRefreshSearch?.();}
function setAll(){
 county.value="";city.value="";sector.value="";
 for(const select of [county,city,sector])select.dispatchEvent(new Event("change",{bubbles:true}));
 try{sessionStorage.setItem("bc-location-mode","all")}catch{}
 notice.textContent="Explorezi toată România. Nu am folosit locația telefonului.";
 refreshSearch();
}
function setNearest(name,source="gps"){
 const options=[...city.options],opt=options.find(x=>norm(x.value)===norm(name));
 if(!opt){
  if(!window.BCDemoCatalog){pendingCity=name;notice.textContent="Se încarcă saloanele pentru "+name+"…";return}
  setAll();notice.textContent="Nu sunt încă saloane indexate în "+name+". Vezi toată România.";return
 }
 pendingCity=null;
 city.value=opt.value;county.value="";
 // The county option, when available, is re-synchronized after city selection; no arbitrary sector selection.
 sector.value="";
 city.dispatchEvent(new Event("change",{bubbles:true}));
 try{sessionStorage.setItem("bc-location-mode",source==="manual"?"manual":"nearby");
 sessionStorage.setItem("bc-location-city",name)}catch{}
 notice.textContent="Oraș selectat: "+name+". Poți alege alt oraș sau Toată România.";
 refreshSearch();
}
async function usePosition(ask){
 if(!navigator.geolocation){notice.textContent="Acest browser nu permite localizarea. Poți folosi harta României.";return}
 if(!ask&&navigator.permissions){
  try{const p=await navigator.permissions.query({name:"geolocation"});if(p.state!=="granted")return}
  catch{return}
 }else if(!ask)return;
 notice.textContent="Determinăm cel mai apropiat oraș, fără să salvăm coordonatele tale.";
 navigator.geolocation.getCurrentPosition(({coords})=>{
  const nearby=locations.map(x=>({name:x[0],d:dist(coords.latitude,coords.longitude,x[1],x[2])})).sort((a,b)=>a.d-b.d)[0];
  if(!nearby||nearby.d>65){setAll();notice.textContent="Nu am identificat un oraș apropiat dintre cele indexate. Rămâne activă toată România.";return}
  if(manualSelection)return;
  lastCity=nearby.name;setNearest(nearby.name,"gps");
 },()=>notice.textContent="Locația a fost refuzată sau indisponibilă. Poți naviga pe harta României.",
 {timeout:10000,maximumAge:180000,enableHighAccuracy:false});
}
$("bcAllRomania").onclick=()=>{manualSelection=true;setAll()};
$("bcNearMe").onclick=()=>{manualSelection=false;usePosition(true)};
function initMap(){
 if(map)return;
 if(!window.L){$("bcMapLegend").textContent="Harta necesită încărcarea bibliotecii cartografice. Filtrele rămân disponibile.";return}
 const L=window.L;
 map=L.map("bcMapRoot",{scrollWheelZoom:false}).setView([45.8,24.95],7);
 L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
 {maxZoom:17,attribution:'&copy; OpenStreetMap contributors'}).addTo(map);
 markers=L.layerGroup().addTo(map);
 updatePins();
}
async function updatePins(){
 if(!markers)return;
 markers.clearLayers();
 // Only public source-defined city-level aggregates; locations without known centers stay in search results.
 try{
  const client=window.supabase.createClient(window.BARBERCRAFT_SUPABASE_URL,window.BARBERCRAFT_SUPABASE_PUBLISHABLE_KEY);
  const {data,error}=await client.from("bc_public_salon_catalog").select("city,visibility").eq("visibility","listed").limit(300);
  if(error)throw error;
  const count={};
  for(const row of data||[]){const key=norm(row.city);count[key]=(count[key]||0)+1}
  if(window.BCDemoCatalog?.length)for(const row of window.BCDemoCatalog){const key=norm(row.city);count[key]=(count[key]||0)+1}
  for(const [name,lat,lon] of locations){
   const n=count[norm(name)]||0;if(!n)continue;
   const marker=window.L.circleMarker([lat,lon],{radius:Math.min(24,9+Math.sqrt(n)*3),
   color:"#ffe19a",weight:2,fillColor:"#d7a941",fillOpacity:.58});
   marker.bindTooltip(name+" · "+n+" saloane indexate", {direction:"top"});
   marker.on("click",()=>{setNearest(name);mapCard.hidden=true;$("bcShowMap").setAttribute("aria-pressed","false");});
   marker.addTo(markers);
  }
  $("bcMapLegend").textContent="Cercurile indică numărul de saloane afișate la nivel de oraș, nu adrese GPS exacte.";
 }catch(e){$("bcMapLegend").textContent="Saloanele nu pot fi încărcate pe hartă momentan. Folosește căutarea.";console.warn(e)}
}
$("bcShowMap").onclick=()=>{
 mapCard.hidden=!mapCard.hidden;$("bcShowMap").setAttribute("aria-pressed",String(!mapCard.hidden));
 if(!mapCard.hidden){initMap();setTimeout(()=>map?.invalidateSize(),70);updatePins()}
};
$("bcMapClose").onclick=()=>{mapCard.hidden=true;$("bcShowMap").setAttribute("aria-pressed","false")};
// A user-selected city always wins over an automatic GPS result.
city.addEventListener("change",event=>{
 if(!event.isTrusted)return;
 manualSelection=true;
 try{sessionStorage.setItem("bc-location-mode","manual");
 sessionStorage.setItem("bc-location-city",city.value)}catch{}
 notice.textContent=city.value?"Ai selectat manual "+city.value+".":"Sunt afișate toate orașele.";
});
for(const control of [county,sector])control?.addEventListener("change",event=>{
 if(event.isTrusted){manualSelection=true;try{sessionStorage.setItem("bc-location-mode","manual")}catch{}}
});
// Asynchronous catalogue load may finish after GPS resolution.
const retryOnOptions=new MutationObserver(()=>{if(pendingCity&&window.BCDemoCatalog)setNearest(pendingCity)});
retryOnOptions.observe(city,{childList:true});
window.addEventListener("bc-demo-catalog-ready",()=>{if(pendingCity)setNearest(pendingCity,manualSelection?"manual":"gps")});
const retryPending=setInterval(()=>{if(pendingCity&&window.BCDemoCatalog){setNearest(pendingCity,manualSelection?"manual":"gps");clearInterval(retryPending)}},850);
setTimeout(()=>clearInterval(retryPending),14000);
const toolbar=$("bcLocationTitle");
if(toolbar)toolbar.onclick=()=>{drawer.open=true;drawer.scrollIntoView({block:"nearest",behavior:"smooth"})};
const mode=(()=>{try{return sessionStorage.getItem("bc-location-mode")}catch{return null}})();
const remembered=(()=>{try{return sessionStorage.getItem("bc-location-city")}catch{return null}})();
if(mode==="all"){manualSelection=true;setAll();}
else if(mode==="manual"&&remembered){manualSelection=true;setNearest(remembered,"manual");}
else if(mode==="nearby"&&remembered){setNearest(remembered,"gps");}
else {
 notice.textContent="Detectăm orașul tău (dacă permiți localizarea)…";
 // Browser consent is required; failure never blocks the national catalog.
 usePosition(true);
}
window.BCLocationMap={updatePins,showAll:setAll};
})();
