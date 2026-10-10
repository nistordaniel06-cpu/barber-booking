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
  for(const [txt,id] of [["Identitate","passportCheckin"],["Medalii","medalBoardSection"],["Recenzii","noteForm"],["Fotografii","photos"]]){
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
  link("▣  Scanează QR","./reward-redeem.html"),link("♛  Barber Passport","./passport.html"));
 const tabs=dash.querySelector(".tabs");tabs?.before(tools);
}
// Navigation of Client is exclusively owned by client-home-v2.js.
// This legacy menu previously overwrote the new 4-link guest menu with old
// Client/PRO/territory-war links and exposed extra items before login.
function roleMenu(){}
function run(){
 passport();pro();admin();roleMenu();
}
if(d.readyState==="loading")d.addEventListener("DOMContentLoaded",run,{once:true});else run();
})();