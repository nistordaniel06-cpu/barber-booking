/* Medals are identity achievements, never monetary rewards or claim requests.
   All criteria are computed from signed-in Client's verified visits and quests. */
(()=>{"use strict";
const root=document.getElementById("bcMedalBoard");if(!root)return;
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n};
const grades=[
 {name:"Bronz",emoji:"🥉",clazz:"bronze",visits:1,quests:1,description:"Primul pas"},
 {name:"Argint",emoji:"🥈",clazz:"silver",visits:3,quests:2,description:"Primele realizări"},
 {name:"Aur",emoji:"🏆",clazz:"gold",visits:10,quests:3,description:"Client dedicat"},
 {name:"Platină",emoji:"🏆",clazz:"platinum",visits:25,quests:4,description:"Fidelitate de top"},
 {name:"Diamant",emoji:"💎",clazz:"diamond",visits:50,quests:5,description:"Legendă BARBERCRAFT"}
];
function show(progress,history){
 root.replaceChildren();
 const completed=(progress.quests||[]).filter(q=>q.completed).length;
 const visits=Number(history.total_visits||0);
 const count=grades.filter(g=>visits>=g.visits&&completed>=g.quests).length;
 const sum=el("p","bcMedalIntro",count+" din 5 medalii câștigate · "+completed+" misiuni finalizate · "+visits+" vizite confirmate");root.append(sum);
 const grid=el("div","bcMedalGrid");
 for(const medal of grades){
  const unlocked=visits>=medal.visits&&completed>=medal.quests;
  const card=el("article","bcMedal bcMedal-"+medal.clazz+(unlocked?" isUnlocked":" isLocked"));
  card.setAttribute("aria-label",(unlocked?"Obținută: ":"Blocată: ")+medal.name);
  const icon=el("div","bcMedalIcon",unlocked?medal.emoji:"🔒");
  icon.setAttribute("aria-hidden","true");
  const name=el("strong",null,medal.name);
  const desc=el("small",null,medal.description);
  const requirements=el("span","bcMedalRequirement",
   unlocked?"✓ MEDALIE OBȚINUTĂ":Math.min(visits,medal.visits)+"/"+medal.visits+" vizite · "+Math.min(completed,medal.quests)+"/"+medal.quests+" misiuni");
  card.append(icon,name,desc,requirements);grid.append(card);
 }
 root.append(grid);
 root.append(el("p","bcMedalFineprint","Medaliile sunt distincții de profil. Nu sunt puncte de plată și nu reprezintă oferte de la saloane."));
}
async function reload(){
 try{
  if(!window.BCPassportSession)return;
  const sb=await window.BCPassportSession();
  const {data:{user}}=await sb.auth.getUser();if(!user)return;
  const [p,v]=await Promise.all([sb.rpc("bc_passport_my_progress"),sb.rpc("bc_passport_my_visit_history")]);
  if(p.error||v.error)throw p.error||v.error;
  show(p.data||{},v.data||{});
 }catch(error){
  root.textContent="Medaliile nu pot fi încărcate momentan. Reîncarcă pagina după ce te conectezi ca Client.";
  console.warn("Barber Passport medals",error);
 }
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>void reload(),{once:true});else void reload();
document.addEventListener("visibilitychange",()=>{if(!document.hidden)void reload()});
})();