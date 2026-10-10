/* BARBERCRAFT guided assistant. Offline contextual knowledge, no third-party AI data transfer. */
(()=>{"use strict";
const el=(tag,cls,txt)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(txt!==undefined)n.textContent=txt;return n};
let familiar=null;
try{familiar=localStorage.getItem("bc-assistant-familiar-v1")}catch(_){}
const root=el("aside","bcAssistant");root.id="bcAssistant";
root.setAttribute("aria-label","Asistentul BARBERCRAFT");
const bubble=el("button","bcAssistantOrb","✂");
bubble.type="button";bubble.setAttribute("aria-label","Deschide Asistent BARBERCRAFT");bubble.title="Asistent BARBERCRAFT · ține apăsat pentru a muta";
const note=el("div","bcAssistantTip");note.hidden=true;
const tipTxt=el("span");const tipX=el("button","bcAssistantTipClose","×");tipX.type="button";tipX.title="Ascunde indiciul";
tipX.onclick=()=>{note.hidden=true};note.append(tipTxt,tipX);
const dialog=el("section","bcAssistantChat");dialog.hidden=true;dialog.setAttribute("aria-label","Întreabă asistentul");
const top=el("div","bcAssistantTop");
const title=el("strong",null,"✂ Asistent BARBERCRAFT");
const tabs=el("div","bcAssistantTools");
const expand=el("a",null,"↗");expand.href="./tutorial.html";expand.target="_blank";expand.rel="noopener noreferrer";expand.title="Tutorial în tab nou";
const close=el("button",null,"✕");close.type="button";close.setAttribute("aria-label","Închide asistentul");close.onclick=()=>{dialog.hidden=true};tabs.append(expand,close);top.append(title,tabs);
const transcript=el("div","bcAssistantMessages");
transcript.setAttribute("aria-live","polite");
const form=el("form","bcAssistantForm");
const input=el("input");input.name="question";input.type="search";input.maxLength=220;input.placeholder="Întreabă-mă despre aplicație…";input.setAttribute("aria-label","Întrebarea ta");
const submit=el("button",null,"Trimite");submit.type="submit";
form.append(input,submit);
const suggestions=el("div","bcAssistantSuggestions");
const footer=el("small","Ghid contextual, fără acces la date private. Răspunsurile sunt din documentația BARBERCRAFT, nu dintr-un model generativ.");
dialog.append(top,transcript,suggestions,form,footer);root.append(note,bubble,dialog);
document.body.append(root);
const messages={
 discovery:"Ca să te programezi: caută un salon, deschide profilul, alege serviciul, specialistul și ora liberă, apoi confirmă rezervarea.",
 account:"În Contul meu îți gestionezi avatarul, rezervările și accesul la Barber Passport. Pentru gestionarea unui salon folosește portalul PRO.",
 passport:"Barber Passport este identitatea ta de membru BARBERCRAFT: profil, istoric, QR de identificare, portofoliu și medalii. Nivelurile și misiunile apar separat, la Barber Pass.",
 community:"În Comunitate îți poți prezenta profilul și urmări frizeri sau clienți. După 3 tunsori verificate poți alege dacă profilul rămâne public sau devine privat.",
 calendar:"Ca profesionist, în Calendar PRO poți selecta și muta programări, bloca intervale și modifica programul de lucru.",
 pro:"Din PRO setezi serviciile, prețurile, programul fiecărui frizer și calendarul salonului. Clientul rezervă prin profilul public al salonului.",
 plans:"8 lei/lună: culoare, motto și efecte pentru profilul frizerului. 15 lei/lună: profil premium de salon. Ai salonul activ? Profilul frizerului e doar +5 lei/lună. Plata e în pregătire.",
 partners:"Saloanele își pot promova profilul, programările și, după integrare, produsele branduite. Vezi pagina «Devino partener».",
 notifications:"Poți activa permisiunea browserului pentru notificări. Trimiterea automată din fundal devine disponibilă după conectarea serviciului Web Push."
};
const howToBook="Descoperă → caută salonul sau serviciul → deschide salonul → alege serviciul și frizerul → selectează data și ora liberă → confirmă rezervarea. O găsești apoi la «Rezervări».";
const identityHelp="Barber Passport este identitatea ta în BARBERCRAFT: profil de Client sau frizer, istoricul vizitelor, QR-ul personal, pozele și medaliile. Barber Pass este separat: niveluri, XP și personalizări.";
const priceHelp="8 lei/lună pentru motto și stilul numelui frizerului; 15 lei/lună pentru prezentarea premium a salonului; +5 lei/lună pentru frizer dacă salonul are deja planul activ. Plățile nu sunt pornite.";
function context(){
 const pathname=location.pathname;
 if(pathname.includes("/pro/calendar"))return "calendar";
 if(pathname.includes("/pro/")||pathname.includes("professionals.html"))return "pro";
 if(pathname.includes("social.html"))return "community";
 if(pathname.includes("barber-pass"))return "plans";
 if(pathname.includes("passport"))return "passport";
 if(pathname.includes("partner"))return "partners";
 if(pathname.includes("notification"))return "notifications";
 if(pathname.includes("/client")||pathname.endsWith("/index.html")||pathname.endsWith("/")){
  const current=document.querySelector(".view.active")?.id;
  return current==="account"?"account":"discovery";
 }
 return "discovery";
}
function say(text,role){
 const p=el("div","bcAssistantMessage "+(role==="user"?"isUser":"isBot"),text);
 transcript.append(p);transcript.scrollTop=transcript.scrollHeight;
}
function answer(q){
 const s=q.toLocaleLowerCase("ro-RO");
 if(/cum m[aă] programez|vreau (o )?programare|f[aă] o programare|cum rezerv|aleg (un )?salon|book/.test(s))return howToBook;
 if(/barber passport|pa[sș]aport|identitat/.test(s))return identityHelp;
 if(/c[aâ]t cost|pre[tț]|preț|pret|abon|7[.,]99|\blei\b|pl[aă]tesc/.test(s))return priceHelp;
 if(/barber pass|misiun|nivel|\bxp\b|streak|medali|distinc|recompens/.test(s))
  return "Barber Pass îți arată misiunile și progresul din vizite confirmate. Medaliile sunt distincții obținute, nu oferte comerciale. Pentru produse și reduceri intră în pagina «Revendică recompense».";
 if(/gps|raza|\bkm\b|loca|hart[aă]/.test(s))
  return "Apasă «Locația ta» și permite GPS. Folosește glisorul pentru raza în kilometri. Harta include pinuri exacte numai la saloanele cu localizare confirmată.";
 if(/program|orar|calendar|rezerv|tuns|servici|frizer/.test(s))
  return context()==="pro"||context()==="calendar"?messages.pro:howToBook;
 if(/avatar|fotografi|poz|cont|profil|parol|autent/.test(s))
  return "Din Contul meu alegi avatarul și îți editezi profilul. În Comunitate îl poți personaliza; după trei tunsori verificate poți schimba vizibilitatea.";
 if(/notific|push|telefon/.test(s))return messages.notifications;
 if(/produs|magazin|partener|firm[aă]/.test(s))return messages.partners;
 return messages[context()]||messages.discovery;
}
function showChat(){
 note.hidden=true;dialog.hidden=false;input.focus({preventScroll:true});
 if(!transcript.children.length)say("Salut! Te ajut să găsești saloane, să faci rezervări și să îți personalizezi Barber Passport.","bot");
 suggestions.replaceChildren();
 for(const label of ["Cum mă programez?","Ce este Barber Passport?","Cât costă?"]){
  const b=el("button",null,label);b.type="button";b.onclick=()=>{say(label,"user");say(answer(label),"bot")};suggestions.append(b);
 }
}
form.onsubmit=e=>{e.preventDefault();const text=input.value.trim();if(!text)return;say(text,"user");say(answer(text),"bot");input.value=""};
let pointer=null,moved=false,initial={x:0,y:0,left:0,top:0};
const keepInScreen=(x,y)=>{
 const width=56,height=56;return {x:Math.min(innerWidth-width-9,Math.max(9,x)),
  y:Math.min(innerHeight-height-70,Math.max(65,y))};
};
function place(x,y){const p=keepInScreen(x,y);root.style.left=p.x+"px";root.style.top=p.y+"px";root.style.right="auto";root.style.bottom="auto"}
try{const saved=JSON.parse(localStorage.getItem("bc-assistant-position"));if(saved&&Number.isFinite(saved.x)&&Number.isFinite(saved.y))place(saved.x,saved.y)}catch(_){}
bubble.addEventListener("pointerdown",e=>{
 if(e.button!==0)return;pointer=e.pointerId;moved=false;
 const rect=root.getBoundingClientRect();initial={x:e.clientX,y:e.clientY,left:rect.left,top:rect.top};
 bubble.setPointerCapture?.(pointer);
});
bubble.addEventListener("pointermove",e=>{
 if(pointer!==e.pointerId)return;
 const dx=e.clientX-initial.x,dy=e.clientY-initial.y;
 if(Math.hypot(dx,dy)>8)moved=true;
 if(moved){place(initial.left+dx,initial.top+dy);e.preventDefault()}
});
bubble.addEventListener("pointerup",e=>{
 if(pointer!==e.pointerId)return;pointer=null;
 if(moved){
  try{localStorage.setItem("bc-assistant-position",JSON.stringify({x:root.getBoundingClientRect().left,y:root.getBoundingClientRect().top}))}catch(_){}
 }else showChat();
});
bubble.addEventListener("click",e=>{if(e.detail===0)showChat()});
function showHint(){
 if(familiar!=="beginner")return;
 const key="bc-assistant-hint:"+context();
 try{if(sessionStorage.getItem(key))return;sessionStorage.setItem(key,"yes")}catch(_){}
 tipTxt.textContent=messages[context()];
 note.hidden=false;setTimeout(()=>{note.hidden=true},12500);
}
function askFamiliar(){
 if(familiar!==null)return;
 note.hidden=true;dialog.hidden=false;
 transcript.replaceChildren();say("Ești familiarizat cu BARBERCRAFT sau folosești aplicația pentru prima dată?","bot");
 suggestions.replaceChildren();
 for(const [text,value] of [["Sunt la început","beginner"],["Am mai folosit aplicația","familiar"]]){
  const b=el("button",null,text);b.type="button";
  b.onclick=()=>{
   familiar=value;try{localStorage.setItem("bc-assistant-familiar-v1",value)}catch(_){}
   transcript.replaceChildren();suggestions.replaceChildren();
   say(value==="beginner"?"Perfect! Îți voi arăta indicii scurte când ajungi într-o zonă nouă.":"Perfect! Nu voi afișa indicii automat. Mă poți întreba oricând.","bot");
   setTimeout(()=>{dialog.hidden=true;showHint()},2500);
  };suggestions.append(b);
 }
}
window.addEventListener("bc-client-auth-changed",()=>{
 if(window.BCClientUser&&familiar===null)setTimeout(askFamiliar,1600)
});
setTimeout(()=>{if(familiar==="beginner")showHint();else if(familiar===null&&window.BCClientUser)askFamiliar()},3000);
let lastContext=context();
const watcher=new MutationObserver(()=>{
 const next=context();if(next!==lastContext){lastContext=next;showHint();}
});
watcher.observe(document.body,{subtree:true,attributes:true,attributeFilter:["class"]});
})();
