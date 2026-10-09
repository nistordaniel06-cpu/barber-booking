/* One authoritative UI loader; never doubles sector buttons during async responses. */
(()=>{"use strict";
const $=id=>document.getElementById(id);
const format=n=>new Intl.NumberFormat("ro-RO").format(n||0);
const sb=window.supabase&&window.BARBERCRAFT_SUPABASE_URL?
 window.supabase.createClient(window.BARBERCRAFT_SUPABASE_URL,window.BARBERCRAFT_SUPABASE_PUBLISHABLE_KEY):null;
let request=0,loadedCity=null,loadedSummary=null;
const clear=()=>{$("sectorScores").replaceChildren();$("sectorActions").replaceChildren();$("myAwards").replaceChildren()};
function makeCard(n,round){
 const sector=round?.sectors?.find(x=>Number(x.sector)===n);
 const card=document.createElement("div");card.className="card"+(round?.winner===n?" champion":"");
 const title=document.createElement("b"),scope=document.createElement("span"),
 value=document.createElement("strong"),rank=document.createElement("small");
 title.textContent="Sector "+n;scope.textContent="București";
 value.textContent=sector?format(Number(sector.score))+" XP":"—";
 rank.textContent=sector?"Locul "+sector.rank:"Fără scor publicat";
 card.append(scope,title,value,rank);return card;
}
function showChooseButton(sector,home,loadToken){
 const host=$("sectorActions");host.replaceChildren();
 const current=Number(home)||0;
 const chosen=Number(sector)||6;
 const button=document.createElement("button");button.type="button";
 button.className=current===chosen?"secondary":"";
 button.textContent=current===chosen?"✓ Ești în echipa Sectorului "+chosen:"Intră în echipa Sectorului "+chosen+" →";
 button.disabled=current===chosen;
 host.append(button);
 button.onclick=async()=>{
  if(current===chosen)return;
  if(!confirm("Alegi Sectorul "+chosen+" ca echipă? Schimbarea poate fi limitată timp de 30 de zile."))return;
  button.disabled=true;$("userStatus").textContent="Verificăm alegerea echipei…";
  const {error}=await sb.rpc("bc_tw_choose_territory",{p_sector:chosen});
  if(loadToken!==request)return;
  if(error){$("userStatus").textContent="Sectorul nu a fost schimbat: "+error.message;button.disabled=false;return}
  await loadWar();
 };
}
function cityEmpty(city){
 clear();
 $("warCityStatus").textContent=city+": zone pregătite pentru viitoarele sezoane.";
 $("roundInfo").textContent="Nu există încă o rundă activă în "+city+".";
 $("userStatus").textContent="Alegerea unei zone devine disponibilă după lansarea competiției locale.";
 $("myXp").textContent="—";$("myLoyalty").textContent="—";
 $("battleMapSection").hidden=true;
 $("warMode").textContent="În pregătire · fără punctaje generate";
}
async function loadWar(){
 const seq=++request,city=$("warCity").value;
 loadedCity=city;loadedSummary=null;
 if(city!=="București"){cityEmpty(city);return}
 clear();
 $("battleMapSection").hidden=false;
 window.BCMap?.selectCity("București");
 $("warCityStatus").textContent="București · 6 sectoare disponibile pentru explorare.";
 $("roundInfo").textContent="Verificăm rundele publicate…";
 $("userStatus").textContent="Verificăm contul și echipa…";
 if(!sb){
  $("roundInfo").textContent="Conexiunea la scoruri nu este disponibilă.";
  $("userStatus").textContent="Reîncarcă pagina și verifică internetul.";
  return;
 }
 const leaderboard=await sb.rpc("bc_tw_leaderboard");
 if(seq!==request)return;
 if(leaderboard.error){
  $("roundInfo").textContent="Nu putem încărca clasamentul acum.";
  $("userStatus").textContent="Încearcă din nou mai târziu.";
  return;
 }
 const data=leaderboard.data||{},round=data.rounds?.[0]||null;
 $("warMode").textContent=data.enabled?"Sezon activ":"În pregătire · fără premii automate";
 $("roundInfo").textContent=round?"Ultima rundă încheiată: "+round.week_start:"Nu există runde încheiate sau scoruri publicate.";
 for(let n=1;n<=6;n++)$("sectorScores").append(makeCard(n,round));
 window.BCMap?.setLeaderboard(round,!!data.enabled);
 const auth=await sb.auth.getUser();
 if(seq!==request)return;
 if(auth.error||!auth.data?.user){
  $("myXp").textContent="—";$("myLoyalty").textContent="—";
  $("userStatus").textContent="Autentifică-te ca să vezi progresul și să-ți alegi echipa.";
  const link=document.createElement("a");link.className="button secondary";
  link.href="./#account";link.textContent="Deschide contul client";
  $("sectorActions").append(link);return;
 }
 const summary=await sb.rpc("bc_client_rewards_summary");
 if(seq!==request)return;
 if(summary.error){$("userStatus").textContent="Progresul nu poate fi încărcat acum: "+summary.error.message;return}
 const stats=summary.data||{};loadedSummary=stats;
 $("myXp").textContent=format(Number(stats.xp));
 $("myLoyalty").textContent=format(Number(stats.loyalty_points));
 $("userStatus").textContent=stats.home_sector?
  "Echipa ta: Sectorul "+stats.home_sector+". Schimbările sunt limitate pentru a preveni abuzul.":
  "Explorează o zonă pe hartă și intră în echipa ei.";
 showChooseButton(window.BCMap?.getState().sector||stats.home_sector||6,stats.home_sector,seq);
 if(stats.pending_prizes?.length)
  $("myAwards").textContent="Beneficii în așteptarea verificării: "+
   stats.pending_prizes.map(x=>x.kind+" ("+x.month+")").join(", ");
}
document.getElementById("warCity")?.addEventListener("change",loadWar);
document.getElementById("battleSectorNav")?.addEventListener("click",e=>{
 const n=Number(e.target.closest("[data-battle-sector]")?.dataset.battleSector||0);
 if(n&&loadedSummary)showChooseButton(n,loadedSummary.home_sector,request);
});
window.addEventListener("bc-sector-selected",e=>{
 const n=Number(e.detail?.sector||0);
 if(n&&loadedSummary&&loadedCity==="București")showChooseButton(n,loadedSummary.home_sector,request);
});
window.BCLoadWar=loadWar;
loadWar();
})();