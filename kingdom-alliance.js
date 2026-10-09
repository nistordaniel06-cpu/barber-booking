(async()=>{"use strict";
const $=id=>document.getElementById(id);
if(!$("kingAllianceTeams")||!window.supabase)return;
const sb=window.supabase.createClient(window.BARBERCRAFT_SUPABASE_URL,window.BARBERCRAFT_SUPABASE_PUBLISHABLE_KEY);
const {data:{user}}=await sb.auth.getUser();if(!user)return;
const rpc=async(name,args={})=>{const {data,error}=await sb.rpc(name,args);if(error)throw Error(error.message);return data};
let current=null;
async function load(){
 try{
  const state=await rpc("bc_kingdom_alliance_state");current=state;
  const root=$("kingAllianceTeams");root.replaceChildren();
  for(const alliance of state.alliances||[]){
   const card=document.createElement("article");card.className="kingAllianceCard"+(alliance.sector===state.sector?" selected":"");
   const name=document.createElement("strong");name.textContent="♜ Sector "+alliance.sector+" · Fort Lv."+alliance.fortress;
   const sub=document.createElement("small");sub.textContent="Rezervă: "+alliance.wood+" lemn · "+alliance.stone+" piatră";
   card.append(name,sub);root.append(card);
  }
  $("kingDonate").disabled=!state.sector||state.donated_today;
  $("kingFortify").disabled=!state.sector;
  $("kingExpeditionGo").disabled=state.expedition_today;
  $("kingAllianceStatus").textContent=state.sector?
  "Echipa ta: Sectorul "+state.sector+(state.donated_today?" · Donația zilnică a fost făcută.":" · Poți contribui o dată pe zi."):
  "Nu ai ales încă echipa. Intră în Bătălia Zonelor ca să selectezi sectorul.";
  if(state.expedition_today)$("kingExpeditionStatus").textContent="Expediția de astăzi a fost deja efectuată.";
 }catch(e){$("kingAllianceStatus").textContent="Alianțele nu pot fi încărcate: "+e.message}
}
async function act(name,args,output){
 const b=output==="kingExpeditionStatus"?$("kingExpeditionGo"):name==="bc_kingdom_alliance_donate"?$("kingDonate"):$("kingFortify");
 b.disabled=true;
 try{const data=await rpc(name,args);
  $(output).textContent=name==="bc_kingdom_alliance_donate"?"Donație confirmată pentru Sectorul "+data.sector:
  name==="bc_kingdom_alliance_upgrade"?"Fortăreața a ajuns la nivelul "+data.fortress:
  "Expediție reușită: +"+data.virtual_iron+" fier virtual.";
  await load();document.getElementById("kingRefresh").click();
 }catch(e){$(output).textContent="Acțiunea a fost respinsă: "+e.message;await load()}
}
$("kingDonate").onclick=()=>act("bc_kingdom_alliance_donate",{},"kingAllianceStatus");
$("kingFortify").onclick=()=>act("bc_kingdom_alliance_upgrade",{},"kingAllianceStatus");
$("kingExpeditionGo").onclick=()=>act("bc_kingdom_expedition",{p_target:Number($("kingExpeditionTarget").value)},"kingExpeditionStatus");
await load();
})();