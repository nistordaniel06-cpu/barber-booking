/* BARBERCRAFT Bătălia Zonelor — interactive map of six București sectors.
   Official polygon source: public ArcGIS "Limite sectoare" layer (source below).
   Fallback is explicitly schematic, not administrative borders.
   All colors represent zone identity, never invented territorial control. */
(()=>{"use strict";
const $=id=>document.getElementById(id),target=$("battleMap");
if(!target)return;
const colors=["#eac65e","#9f90e9","#73d6c3","#ef997a","#8fb7e7","#d2a7cf"];
const sectorNames=[["Băneasa","Piața Victoriei","Aviației"],["Obor","Colentina","Tei"],
 ["Titan","Dristor","Vitan"],["Berceni","Tineretului","Olteniței"],
 ["Rahova","Ferentari","13 Septembrie"],["Militari","Drumul Taberei","Crângași"]];
const centerPoints=[[44.4838,26.0705],[44.4670,26.1443],[44.426,26.171],[44.389,26.117],
 [44.401,26.060],[44.440,26.018]];
const mapAlert=$("battleMapStatus"),mapDetail=$("battleSectorDetail"),reset=$("battleMapReset");
let map=null,geoLayer=null,current=6,real=false,features=new Map(),scoreData=null,city="București",status="pregătire";
const fmt=n=>new Intl.NumberFormat("ro-RO").format(n);
const safeSector=(n)=>Number.isInteger(Number(n))&&Number(n)>=1&&Number(n)<=6?Number(n):null;
const sectorId=f=>{
 const label=String(f?.properties?.name||"");
 const m=label.match(/(?:sectorul|sector)\s*([1-6])(?:\b|$)/i);
 return m?safeSector(m[1]):null;
};
function detail(n){
 const number=safeSector(n);if(!number)return;
 current=number;const colour=colors[number-1],areas=sectorNames[number-1];
 const live=scoreData?.sectors?.find(x=>Number(x.sector)===number);
 const score=live?fmt(Number(live.score)||0)+" XP (rundă încheiată)":"Fără scor publicat";
 const head=document.createElement("strong"),sub=document.createElement("p"),statusEl=document.createElement("span");
 head.textContent="Sector "+number;head.style.color=colour;
 sub.textContent=areas.join(" · ")+" · "+score;
 statusEl.className="battleDetailStatus";statusEl.textContent=status==="activ"?"Vezi regulile sezonului":"Sezon în pregătire";
 mapDetail.replaceChildren(head,sub,statusEl);
 document.querySelectorAll("[data-battle-sector]").forEach(button=>{
  const selected=Number(button.dataset.battleSector)===number;
  button.classList.toggle("selected",selected);
  button.setAttribute("aria-pressed",String(selected));
 });
 if(geoLayer){geoLayer.eachLayer(layer=>{
  const id=sectorId(layer.feature),selected=id===number;
  layer.setStyle({fillColor:colors[(id||1)-1],fillOpacity:selected?.55:.2,weight:selected?4:1.7,color:selected?"#fff1b9":"#a8a2a0"});
  if(selected)layer.bringToFront();
 })}
}
function select(n,fly=true){
 detail(n);
 window.dispatchEvent(new CustomEvent("bc-sector-selected",{detail:{sector:safeSector(n)}}));
 if(map&&fly){
  const layer=features.get(safeSector(n));
  if(layer){map.flyToBounds(layer.getBounds().pad(.08),{maxZoom:12.4,duration:.55})}
  else map.flyTo(centerPoints[safeSector(n)-1],12,{duration:.55});
 }
}
const labels=()=>{
 const nav=$("battleSectorNav");if(!nav)return;nav.replaceChildren();
 for(let n=1;n<=6;n++){
  const b=document.createElement("button");
  b.type="button";b.dataset.battleSector=String(n);b.className="battleSectorChip";
  const mark=document.createElement("span");mark.className="battleSectorDot";mark.style.background=colors[n-1];
  b.append(mark,document.createTextNode("Sector "+n));b.onclick=()=>select(n);
  nav.append(b);
 }
};
function svgFallback(){
 target.hidden=true;
 const box=$("battleSchematic");box.hidden=false;box.replaceChildren();
 const ns="http://www.w3.org/2000/svg",svg=document.createElementNS(ns,"svg");
 svg.setAttribute("viewBox","0 0 380 380");svg.setAttribute("role","img");
 svg.setAttribute("aria-label","Hartă schematică de explorare a celor șase sectoare; nu reprezintă limite administrative");
 const title=document.createElementNS(ns,"title");title.textContent="București — sectoare, reprezentare schematică";svg.append(title);
 const sectors=[1,2,3,4,5,6],cx=190,cy=190,inner=51,outer=172;
 const point=(angle,r)=>[cx+Math.cos(angle)*r,cy+Math.sin(angle)*r];
 const angles=[-Math.PI*0.84,-Math.PI*0.51,-Math.PI*0.18,Math.PI*0.15,Math.PI*0.48,Math.PI*0.81];
 // Sector 1 NW, sector 2 NE, sector 3 E, sector 4 S, sector 5 SW, sector 6 W.
 for(const n of sectors){
  const base=angles[n-1],a=base-.32,b=base+.32,aa=point(a,inner),bb=point(b,inner),
  cc=point(b,outer),dd=point(a,outer);
  const sector=document.createElementNS(ns,"path");
  sector.setAttribute("d",`M ${aa.join(" ")} L ${dd.join(" ")} A ${outer} ${outer} 0 0 1 ${cc.join(" ")} L ${bb.join(" ")} A ${inner} ${inner} 0 0 0 ${aa.join(" ")} Z`);
  sector.setAttribute("fill",colors[n-1]);sector.setAttribute("fill-opacity",".36");
  sector.setAttribute("stroke","#b9a681");sector.setAttribute("stroke-width","1.5");
  sector.setAttribute("class","battleSchematicPath");
  sector.setAttribute("tabindex","0");sector.setAttribute("role","button");
  sector.setAttribute("aria-label","Explorează Sector "+n);
  sector.addEventListener("click",()=>select(n,false));
  sector.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();select(n,false)}});
  svg.append(sector);
  const pt=point(base,110),label=document.createElementNS(ns,"text");
  label.setAttribute("x",pt[0]);label.setAttribute("y",pt[1]+5);
  label.setAttribute("text-anchor","middle");label.setAttribute("class","battleMapSvgText");
  label.textContent="S"+n;svg.append(label);
 }
 const core=document.createElementNS(ns,"circle");core.setAttribute("cx","190");core.setAttribute("cy","190");core.setAttribute("r","40");core.setAttribute("fill","#1d1918");core.setAttribute("stroke","#e6bd66");core.setAttribute("stroke-width","2");svg.append(core);
 const coreLabel=document.createElementNS(ns,"text");coreLabel.setAttribute("x","190");coreLabel.setAttribute("y","194");coreLabel.setAttribute("text-anchor","middle");coreLabel.setAttribute("class","battleMapCoreText");coreLabel.textContent="BC";svg.append(coreLabel);
 box.append(svg);
 const note=document.createElement("p");note.className="battleMapCaption";note.textContent="Vizualizare schematică. Contururile reale ale sectoarelor nu sunt disponibile momentan.";box.append(note);
 mapAlert.textContent="Harta geografică nu s-a încărcat; poți explora sectoarele în modul schematic.";
 detail(current);
}
async function mount(){
 if(!window.L){svgFallback();return}
 const L=window.L;
 map=L.map("battleMap",{zoomControl:false,scrollWheelZoom:false,attributionControl:true,
   preferCanvas:true,minZoom:10,maxZoom:15}).setView([44.435,26.102],11);
 L.control.zoom({position:"bottomright"}).addTo(map);
 L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
  {attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>',
    maxZoom:18,subdomains:"abcd"}).addTo(map);
 // Public six-sector administrative polygon layer, via ArcGIS FeatureServer.
 const uri=new URL("https://services.arcgis.com/9nrie6KNVyjacEqa/ArcGIS/rest/services/Parcuri_Bucuresti_WFL1/FeatureServer/15/query");
 const params={where:"1=1",outFields:"name,natcode",returnGeometry:"true",outSR:"4326",f:"geojson"};
 Object.entries(params).forEach(([k,v])=>uri.searchParams.set(k,v));
 try{
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),13000);
  let response;
  try{response=await fetch(uri.toString(),{signal:controller.signal,mode:"cors"});}
  finally{clearTimeout(timer)}
  if(!response.ok)throw Error("HTTP "+response.status);
  const data=await response.json();
  if(!Array.isArray(data.features))throw Error("Geometrie indisponibilă");
  const selected=data.features.filter(f=>!!sectorId(f) && f.geometry);
  const keys=new Set(selected.map(sectorId));
  if(selected.length!==6||keys.size!==6)throw Error("Nu sunt disponibile toate cele 6 sectoare");
  const geojson={type:"FeatureCollection",features:selected};
  geoLayer=L.geoJSON(geojson,{style:f=>({color:"#aea6a0",weight:1.7,fillColor:colors[sectorId(f)-1],fillOpacity:.24}),
   onEachFeature:(f,layer)=>{
    const n=sectorId(f);features.set(n,layer);
    layer.on("click",()=>select(n,false));
    layer.on("mouseover",()=>{layer.setStyle({weight:3,fillOpacity:.48})});
    layer.on("mouseout",()=>detail(current));
    layer.bindTooltip("S"+n,{permanent:true,direction:"center",className:"bcMapSectorLabel"});
   }}).addTo(map);
  const bounds=geoLayer.getBounds();if(bounds.isValid())map.fitBounds(bounds.pad(.025));
  real=true;detail(current);mapAlert.textContent="Atinge o zonă de pe hartă pentru a o explora. Culorile identifică sectoarele, nu câștigători.";
 }catch(err){
  console.warn("Harta sectoarelor indisponibilă",err);
  if(map){map.remove();map=null}
  svgFallback();
 }
}
function setCity(name){
 city=name;const section=$("battleMapSection");
 section.hidden=name!=="București";
 if(!section.hidden&&map)setTimeout(()=>map.invalidateSize(),100);
}
window.BCMap=Object.freeze({
 select,selectCity:setCity,
 setLeaderboard:(round,enabled)=>{scoreData=round||null;status=enabled?"activ":"pregătire";detail(current)},
 getState:()=>({sector:current,city,real})
});
labels();detail(current);
reset.onclick=()=>{if(map&&geoLayer){map.fitBounds(geoLayer.getBounds().pad(.025),{animate:true})}else if(map){map.setView([44.435,26.102],11)}};
document.getElementById("warCity")?.addEventListener("change",e=>setCity(e.target.value));
setCity(document.getElementById("warCity")?.value||"București");
mount();
})();
