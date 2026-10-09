/* BARBERCRAFT discovery — no Google address CTA; booking catalogue stays partner-only. */
(()=>{"use strict";
const home=document.getElementById("home");
if(!home)return;
const search=document.getElementById("search"),city=document.getElementById("cityFilter"),
      label=home.querySelector(".location"),salons=document.getElementById("salongrid");
const partner=document.createElement("p");
partner.className="bcPartnerLabel";
partner.textContent="Rezervările sunt disponibile numai la saloanele partenere BARBERCRAFT.";
salons?.before(partner);
if(label){
 label.textContent="";
 const selector=document.createElement("button");
 selector.type="button";selector.id="bcLocationTitle";
 selector.setAttribute("aria-label","Selectează orașul");
 function refreshTitle(){
   selector.textContent="⌖  "+(city?.value||"Toată România")+"  ⌄";
  }
 refreshTitle();label.append(selector);
 selector.onclick=()=>{city?.focus();if(typeof city?.showPicker==="function"){try{city.showPicker()}catch{}}};
 city?.addEventListener("change",refreshTitle);
 // The catalogue is loaded asynchronously; update the label after select options arrive.
 const observer=new MutationObserver(refreshTitle);
 if(city)observer.observe(city,{childList:true});
}
const passport=document.createElement("a");
passport.className="bcPassportShortcut";
passport.href="./passport.html";
const lead=document.createElement("strong");lead.textContent="♛  Barber Passport";
const meta=document.createElement("span");meta.textContent="Profil · Vizite · XP · Recompense  →";
passport.append(lead,meta);
const account=document.querySelector("#accountUser");
if(account&&!account.querySelector(".bcPassportShortcut"))account.prepend(passport);
})();