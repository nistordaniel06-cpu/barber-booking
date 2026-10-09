(async()=>{"use strict";
const select=document.getElementById("warCity");
if(!select||!window.supabase||!window.BARBERCRAFT_SUPABASE_URL)return;
const sb=window.supabase.createClient(window.BARBERCRAFT_SUPABASE_URL,window.BARBERCRAFT_SUPABASE_PUBLISHABLE_KEY);
const {data,error}=await sb.rpc("bc_city_zones_public");
if(error){console.warn("Directorul orașelor nu poate fi încărcat",error.message);return}
const cities=Array.isArray(data)?data:[];
if(!cities.length)return;
const previous=select.value;
select.replaceChildren();
for(const city of cities)select.append(new Option(city.name+(city.name==="București"?" · pilot":" · în pregătire"),city.name));
select.value=cities.some(c=>c.name===previous)?previous:cities[0].name;
function present(){
 const name=select.value;if(name==="București")return;
 const city=cities.find(c=>c.name===name),score=document.getElementById("sectorScores");
 if(!score)return;
 score.replaceChildren();
 if(!city?.zones?.length){
  const empty=document.createElement("p");empty.className="status";empty.textContent="Zonele din "+name+" vor fi afișate după ce administratorul le configurează și le publică.";score.append(empty);return
 }
 for(const zone of city.zones){
  const card=document.createElement("article");card.className="card";
  const cityLabel=document.createElement("span");cityLabel.textContent=name;
  const label=document.createElement("b");label.textContent=zone.name;
  const desc=document.createElement("small");desc.textContent="În pregătire · fără clasament activ";
  card.append(cityLabel,label,desc);score.append(card);
 }
}
select.addEventListener("change",present);
if(select.value==="București"){if(typeof loadWar==="function")loadWar()}else{if(typeof loadWar==="function")loadWar();present()}
})();