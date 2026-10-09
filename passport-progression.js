/* Individual Barber Passport: server-trusted XP, never old territory XP. */
(()=>{"use strict";
const root=document.getElementById("bcIndividualPassport");if(!root)return;
const $=id=>document.getElementById(id),create=(tag,text,cls)=>{const n=document.createElement(tag);n.textContent=text;if(cls)n.className=cls;return n};
const cutoff=level=>level<20?100+50*(level-1)+10*(level-1)**2:null;
function render(c){
 root.replaceChildren();
 const top=create("div",null,"bcPassTop");
 const title=create("div");title.append(create("small","BARBER PASSPORT · PROGRES INDIVIDUAL"),create("h2","Nivel "+c.nivel_passport+" / 20"));
 const badge=create("span",c.tip_passport==="premium"?"✦ PREMIUM":"✂ FREE","bcPassTier");top.append(title,badge);root.append(top);
 const prior=Array.from({length:Math.max(0,c.nivel_passport-1)},(_,index)=>cutoff(index+1)).reduce((a,b)=>a+b,0);
 const levelXP=Math.max(0,Number(c.xp_client||0)-prior),max=cutoff(Number(c.nivel_passport));
 root.append(create("p",Number(c.xp_client||0).toLocaleString("ro-RO")+" XP din vizite și misiuni validate","bcPassTotal"));
 const meter=create("div");meter.className="bcPassMeter";meter.setAttribute("role","progressbar");
 meter.setAttribute("aria-valuemin","0");meter.setAttribute("aria-valuemax",String(max||levelXP||1));meter.setAttribute("aria-valuenow",String(Math.min(levelXP,max||levelXP)));
 const fill=create("span");fill.style.width=(max?Math.min(100,(levelXP/max)*100):100)+"%";meter.append(fill);root.append(meter);
 root.append(create("p",max?levelXP+" / "+max+" XP până la nivelul "+(c.nivel_passport+1):"Nivel maxim atins ✨","bcPassMuted"));
 if($("xp"))$("xp").textContent=Number(c.xp_client||0).toLocaleString("ro-RO");
 if($("rank"))$("rank").textContent="Barber Passport · Nivel "+c.nivel_passport;
 if($("xpProgress"))$("xpProgress").style.width=(max?Math.min(100,levelXP/max*100):100)+"%";
 if($("xpNext"))$("xpNext").textContent=max?levelXP+" din "+max+" XP spre nivelul "+(c.nivel_passport+1):"Felicitări! Ai atins nivelul 20.";
 const quests=create("section",null,"bcPassQuests");quests.append(create("h3","Misiunile tale"));
 const list=create("div",null,"bcPassQuestList");
 for(const q of c.quests||[]){
  const row=create("div",null,"bcPassQuest"),left=create("div");
  left.append(create("strong",(q.completed?"✓ ":"✂ ")+q.title),create("small",q.description));
  row.append(left,create("span",(q.completed?"Completă":q.progress+" / "+q.target)+" · +"+q.bonus_xp+" XP"));
  list.append(row);
 }
 quests.append(list);root.append(quests);
 const rewards=create("section",null,"bcPassQuests");rewards.append(create("h3","Recompense deblocate"));
 const unlocked=c.rewards||[];
 rewards.append(create("p",unlocked.length?"Recompensele tale individuale, obținute din progres:":"Primele recompense apar când atingi nivelul 2.","bcPassMuted"));
 for(const reward of unlocked)rewards.append(create("div",(reward.tier==="premium"?"♛ ":"✦ ")+reward.title,"bcPassReward"));
 root.append(rewards);
 const note=create("p","Se acordă XP numai după ce salonul confirmă efectiv vizita prin check-in QR. O simplă rezervare nu oferă XP.","bcPassMuted");root.append(note);
}
async function refresh(){
 try{
  const sb=window.BCPassportSession?await window.BCPassportSession():window.BCAuthClient?.("client");
  if(!sb)return;
  const {data:{user}}=await sb.auth.getUser();
  if(!user)return;
  const {data,error}=await sb.rpc("bc_passport_my_progress");
  if(error)throw error;
  render(data);
 }catch(err){root.textContent="Progresul Barber Passport nu este disponibil acum. Reîncarcă pagina când ești conectat ca Client.";console.warn("Passport progress",err)}
}
document.addEventListener("DOMContentLoaded",()=>void refresh(),{once:true});
document.addEventListener("visibilitychange",()=>{if(!document.hidden)void refresh()});
})();
