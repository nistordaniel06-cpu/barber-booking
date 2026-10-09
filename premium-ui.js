/* BARBERCRAFT premium navigation: role-aware links; server remains the authority. */
(()=>{"use strict";
const d=document,body=d.body;
const node=(tag,label,klass)=>{const x=d.createElement(tag);if(label!==undefined)x.textContent=String(label);if(klass)x.className=klass;return x};
const link=(label,href,klass)=>{const a=node("a",label,klass);a.href=href;return a};
function passport(){
 const hero=d.querySelector(".bc-passport .hero");
 if(hero&&!hero.querySelector(".bc-profile-actions")){
  const actions=node("div",undefined,"bc-profile-actions");
  actions.append(link("♛  Vezi profilul meu","./passport-preview.html"),link("📷  Adaugă fotografii","#photos","secondary"));
  hero.append(actions);
 }
 const container=d.getElementById("signedIn");
 if(container&&!d.querySelector(".bc-passport-tabs")){
  const nav=node("nav",undefined,"bc-passport-tabs");nav.setAttribute("aria-label","Secțiunile pașaportului");
  for(const [txt,id] of [["Activitate","passportCheckin"],["Recompense","rewardMarketplace"],["Recenzii","noteForm"],["Fotografii","photos"]]){
   nav.append(link(txt,"#"+id));}
  container.prepend(nav);
  nav.addEventListener("click",e=>{const a=e.target.closest("a");if(!a)return;
   nav.querySelectorAll("a").forEach(x=>x.classList.toggle("active",x===a))});
  nav.firstChild.classList.add("active");
 }
}
// Scanning is available from the single PRO header link. Do not duplicate the CTA.
function pro(){}
function admin(){
 const dash=d.getElementById("dashboard");
 if(!dash||dash.querySelector(".bc-admin-tools"))return;
 const tools=node("nav",undefined,"bc-admin-tools");tools.setAttribute("aria-label","Legături între aplicații");
 tools.append(link("⌂  Aplicația client","./"),link("✂  Portal PRO","./professionals.html"),
  link("▣  Scanează QR","./reward-redeem.html"),link("♛  Bătălia Zonelor","./territory-war.html"));
 const tabs=dash.querySelector(".tabs");tabs?.before(tools);
}
async function roleMenu(){
 const trigger=d.getElementById("infoBtn");
 if(!trigger||!body.classList.contains("bc-client"))return;
 const menu=node("nav",undefined,"bc-role-menu");menu.hidden=true;menu.setAttribute("aria-label","Navigație BARBERCRAFT");
 menu.append(link("⌂ Descoperă saloane","./"),link("♛ Barber Passport","./passport.html"),link("↗ Invită prieteni","./referral.html?type=client"),
  link("▦ Profilul meu","./passport-preview.html"),link("🏆 Bătălia Zonelor","./territory-war.html"),
  link("✂ Portal profesioniști","./professionals.html"));
 const adminLink=link("⚙ Admin BARBERCRAFT","./admin.html");adminLink.hidden=true;menu.append(adminLink);
 const proScan=link("▣ Scanează QR · PRO","./reward-redeem.html");proScan.hidden=true;menu.append(proScan);
 trigger.insertAdjacentElement("afterend",menu);
 trigger.setAttribute("aria-expanded","false");
 trigger.setAttribute("aria-controls","bcRoleMenu");menu.id="bcRoleMenu";
 trigger.onclick=()=>{menu.hidden=!menu.hidden;trigger.setAttribute("aria-expanded",String(!menu.hidden))};
 d.addEventListener("click",e=>{if(!trigger.contains(e.target)&&!menu.contains(e.target)){menu.hidden=true;trigger.setAttribute("aria-expanded","false")}});
 d.addEventListener("keydown",e=>{if(e.key==="Escape"){menu.hidden=true;trigger.setAttribute("aria-expanded","false")}});
 if(!window.supabase||!window.BARBERCRAFT_SUPABASE_URL)return;
 try{
  const sb=window.supabase.createClient(window.BARBERCRAFT_SUPABASE_URL,window.BARBERCRAFT_SUPABASE_PUBLISHABLE_KEY);
  const {data:{user}}=await sb.auth.getUser();if(!user)return;
  const [adm,pro]=await Promise.all([sb.rpc("bc_is_platform_admin"),sb.rpc("bc_my_professional_access")]);
  adminLink.hidden=adm.error||adm.data!==true;
  proScan.hidden=!!pro.error||!(pro.data||[]).length;
 }catch(e){console.warn("Navigarea pe roluri nu poate fi verificată",e)}
}
function run(){
 passport();pro();admin();roleMenu();
}
if(d.readyState==="loading")d.addEventListener("DOMContentLoaded",run,{once:true});else run();
})();