/* Client header menu: everyone sees exactly the four requested actions. */
(()=>{"use strict";
const toggle=document.getElementById("infoBtn");if(!toggle)return;
const dialog=document.createElement("dialog");dialog.className="bcClientMenu";dialog.setAttribute("aria-label","Meniul BARBERCRAFT");
dialog.innerHTML='<div class="bcClientMenuTop"><strong class="bcClientMenuBrand">◩ BARBER<b>CRAFT</b></strong><div class="bcClientMenuTools"><button type="button" id="bcClientMenuClose" aria-label="Închide">✕</button></div></div><div id="bcClientMenuItems" class="bcClientMenuItems"></div><p class="bcClientMenuInfo" id="bcClientMenuInfo" role="status"></p>';
document.body.append(dialog);
dialog.querySelector("#bcClientMenuClose").onclick=()=>dialog.close();
const box=dialog.querySelector("#bcClientMenuItems");
function button(title,fn){
 const b=document.createElement("button");b.type="button";b.textContent=title;
 b.onclick=()=>{dialog.close();fn();};box.append(b);
}
function link(title,url){
 const a=document.createElement("a");a.href=url;a.textContent=title;a.target="_blank";a.rel="noopener noreferrer";box.append(a);
}
function openDiscovery(){
 document.querySelector('[data-go="home"]')?.click();
 window.scrollTo({top:0,behavior:"smooth"});
}
async function invite(){
 const url=new URL("./client/",document.baseURI).href;
 try{if(navigator.share)await navigator.share({title:"BARBERCRAFT",text:"Descoperă saloane și servicii de barbering",url});
 else{await navigator.clipboard.writeText(url);toggle.title="Linkul de invitație a fost copiat";}}
 catch(e){if(e?.name!=="AbortError")toggle.title="Nu am putut distribui linkul";}
}
function populate(){
 box.replaceChildren();
 // Guest and authenticated menus remain focused on the requested entrypoints.
 if(window.BCClientUser){
  button("♙ Profil Client",()=>document.querySelector('[data-go="account"]')?.click());
 }else{
  button("♙ Profil Client",()=>document.querySelector('[data-go="account"]')?.click());
 }
 link("✂ Profil Profesionist","./pro/");
 link("◇ Devino partener","./partner.html");
 button("↗ Invită prietenii",()=>{void invite()});
}

toggle.onclick=()=>{populate();if(typeof dialog.showModal==="function")dialog.showModal();else dialog.setAttribute("open","")};
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&dialog.open)dialog.close()});
})();
