/* BARBERCRAFT Bătălia Zonelor — pure client-side preview helpers.
   Authoritative scoring, settlement, budgets and awards always run in Supabase. */
(function(root){
 "use strict";
 const VALID_SECTORS=new Set([1,2,3,4,5,6]);
 const localParts=(instant)=>{const fmt=new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Bucharest",weekday:"short",hour:"2-digit",minute:"2-digit",hourCycle:"h23"});const parts=Object.fromEntries(fmt.formatToParts(new Date(instant)).filter(x=>x.type!=="literal").map(x=>[x.type,x.value]));return{weekday:parts.weekday,hour:Number(parts.hour),minute:Number(parts.minute)};};
 const n=value=>Number.isFinite(Number(value))?Number(value):0;
 function calculateVisit({homeSector,salonSector,instant,underdogSector=null,championSector=null,baseXP=100}){
  const home=n(homeSector),shop=n(salonSector);
  if(!VALID_SECTORS.has(home)||!VALID_SECTORS.has(shop))throw Error("Sector invalid");
  const local=localParts(instant);
  const happyHour=["Tue","Wed"].includes(local.weekday)&&local.hour>=11&&local.hour<16;
  const happyMultiplier=happyHour?3:1;
  const underdogShop=shop===n(underdogSector)?1.5:1;
  const underdogHome=home===n(underdogSector)?1.5:1;
  const buffHome=home===shop&&shop===n(championSector)?2:1;
  const sectorPoints=Math.round(baseXP*happyMultiplier*underdogShop*buffHome);
  const raidPoints=home!==shop?Math.round(150*underdogHome):0;
  return{shopSector:shop,homeSector:home,sectorPoints,raidPoints,happyHour,
   happyMultiplier,underdogShop,buffHome,loyaltyPoints:buffHome===2?20:10,
   totalPoints:sectorPoints+raidPoints};
 }
 function scoreRound(visits){
  const scores=Array.from({length:6},(_,i)=>({sector:i+1,score:0,visits:0}));
  for(const visit of visits){const shop=scores.find(x=>x.sector===visit.shopSector);if(shop){shop.score+=n(visit.sectorPoints);shop.visits++}
   if(n(visit.raidPoints)>0){const origin=scores.find(x=>x.sector===visit.homeSector);if(origin)origin.score+=n(visit.raidPoints);}
  }
  return scores.sort((a,b)=>b.score-a.score||b.visits-a.visits||a.sector-b.sector).map((entry,i)=>({...entry,rank:i+1}));
 }
 function whatsappBooking({salonName,barberName,clientName,service,when,vipTitle,upgrade}){
  const clean=v=>String(v||"").replace(/[\r\n<>]/g," ").trim().slice(0,140);
  const lines=["Salut! Vreau să verific o programare prin BARBERCRAFT.",
   "Salon: "+clean(salonName||"Salon"),"Frizer: "+clean(barberName||"La alegere"),
   "Client: "+clean(clientName),"Serviciu: "+clean(service),"Data și ora: "+clean(when)];
  if(vipTitle)lines.push("🏆 Statut Bătălia Zonelor: "+clean(vipTitle)+" (verificare în aplicație)");
  if(upgrade)lines.push("🎁 Upgrade gratuit disponibil spre confirmare: "+clean(upgrade)+".");
  lines.push("Te rog să-mi confirmi disponibilitatea și eventualele beneficii.");
  return lines.join("\n");
 }
 root.BCTerritory=Object.freeze({calculateVisit,scoreRound,whatsappBooking});
})(window);
