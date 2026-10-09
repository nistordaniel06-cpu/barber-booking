/* City options from verified BARBERCRAFT directory. No competing leaderboard calls. */
(async()=>{"use strict";
const city=document.getElementById("warCity");if(!city||!window.supabase)return;
const sb=window.supabase.createClient(window.BARBERCRAFT_SUPABASE_URL,window.BARBERCRAFT_SUPABASE_PUBLISHABLE_KEY);
const {data,error}=await sb.rpc("bc_city_zones_public");
if(error){console.warn("Nu se pot încărca orașele",error.message);return}
const cities=Array.isArray(data)?data:[];if(!cities.length)return;
window.BCCityZones=cities;
const previous=city.value;
city.replaceChildren();
for(const item of cities)city.append(new Option(item.name+(item.name==="București"?" · pilot":" · în pregătire"),item.name));
city.value=cities.some(x=>x.name===previous)?previous:cities[0].name;
if(city.value!==previous)city.dispatchEvent(new Event("change",{bubbles:true}));
})();