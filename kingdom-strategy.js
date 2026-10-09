(async()=>{"use strict";
const $=id=>document.getElementById(id),status=$("kingStatus");
if(!window.supabase)return;
const sb=window.supabase.createClient(window.BARBERCRAFT_SUPABASE_URL,window.BARBERCRAFT_SUPABASE_PUBLISHABLE_KEY);
const {data:{user}}=await sb.auth.getUser();
if(!user){status.textContent="Autentifică-te în BARBERCRAFT pentru a juca. Satul este asociat contului tău.";const a=document.createElement("a");a.href="./#account";a.textContent="Autentificare →";status.append(" ",a);return}
const kinds=[
 ["wood","🌲 Pădure","Produce lemn"],["stone","⛰ Carieră","Produce piatră"],["iron","⚒ Fierărie","Produce fier"],
 ["farm","🌾 Fermă","Produce hrană"],["storage","▣ Depozit","Mărește capacitatea resurselor"],
 ["barracks","⚔ Cazarmă","Mărește capacitatea trupelor"],["wall","♜ Zid","Dezvoltă apărarea satului"]
];
const run=async(name,args={})=>{const {data,error}=await sb.rpc(name,args);if(error)throw Error(error.message);return data};
const fmt=v=>new Intl.NumberFormat("ro-RO").format(Number(v)||0);
async function load(){
 try{
  const data=await run("bc_kingdom_state");
  $("kingControls").hidden=false;
  for(const k of ["wood","stone","iron","food"])$(k).textContent=fmt(data[k]);
  $("kingName").textContent=data.name;$("kingSector").textContent=data.sector?"Echipa · Sector "+data.sector:"Alege echipa în Bătălia Zonelor";
  $("kingTroops").textContent=fmt(data.infantry)+" soldați";
  $("kingMission").disabled=!data.mission_available;
  $("kingMission").textContent=data.mission_available?"Colectează proviziile zilnice":"✓ Provizii colectate astăzi";
  const grid=$("kingBuildings");grid.replaceChildren();
  for(const [key,title,description] of kinds){
   const lvl=Number(data.buildings?.[key]||1),cost=[30,25,20].map(x=>x*lvl*lvl);
   const card=document.createElement("article");card.className="kingBuilding";card.dataset.kind=key;
   const header=document.createElement("strong");header.textContent=title+" · Nivel "+lvl;
   const detail=document.createElement("small");detail.textContent=description;
   const price=document.createElement("small");price.textContent="Următorul nivel: "+cost[0]+" lemn · "+cost[1]+" piatră · "+cost[2]+" fier";
   const button=document.createElement("button");button.type="button";button.textContent=lvl>=10?"Nivel maxim":"⬆ Îmbunătățește";
   button.disabled=lvl>=10||data.wood<cost[0]||data.stone<cost[1]||data.iron<cost[2];
   button.onclick=async()=>{button.disabled=true;try{await run("bc_kingdom_build",{p_kind:key});status.textContent="Clădire îmbunătățită.";await load()}
    catch(e){status.textContent=e.message;await load()}};
   card.append(header,detail,price,button);grid.append(card);
  }
  window.dispatchEvent(new CustomEvent("bc-kingdom-updated",{detail:data}));
  status.textContent="Regatul tău se salvează automat pe server. Producția de resurse e limitată la 6 ore între vizite.";
 }catch(e){status.textContent="Regatul nu este disponibil: "+e.message}
}
document.querySelectorAll("[data-train]").forEach(b=>b.onclick=async()=>{
 const number=Number(b.dataset.train);b.disabled=true;
 try{await run("bc_kingdom_train",{p_units:number});await load()}catch(e){status.textContent=e.message;await load()}
});
$("kingMission").onclick=async()=>{try{await run("bc_kingdom_daily_mission");await load()}catch(e){status.textContent=e.message}};
$("kingRefresh").onclick=load;
await load();
})();