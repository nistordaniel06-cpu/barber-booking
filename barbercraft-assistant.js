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
 discovery:"Începe cu un serviciu sau un salon. «Locația ta» folosește GPS-ul doar cu acordul tău; raza poate fi mărită. Dacă salonul n-a confirmat poziția GPS, nu poate apărea în rezultatele exacte pe kilometri.",
 account:"Aici îți creezi contul Client. Poți încărca avatarul după conectare. Contul PRO și Admin sunt separate.",
 passport:"Barber Passport este progresul tău individual. XP se primește după vizite finalizate și confirmate de salon prin QR, nu din programări nefinalizate.",
 calendar:"Atinge o oră ca să programezi; poți glisa un interval. Selectează 1, 3 sau 7 zile și folosește două degete pentru zoom.",
 pro:"În Setări salon poți modifica programul de lucru, copia orele în alte zile și configura specialiștii. Doar orele salvate devin publice.",
 admin:"În prima pagină Admin vezi utilizatori noi și saloane care așteaptă aprobarea. Selectează notificarea pentru a le verifica înainte de publicare.",
 plans:"Nu-i suport pe cei cu 7,99 lei, așa că am pus 8 lei. 😄 Prețurile sunt directe: 15 lei pentru salon, 8 lei pentru frizer sau +5 lei la un salon activ. Încă nu încasăm abonamente.",
 partners:"Un salon costă 15 lei/lună pentru funcțiile cosmetice propuse; un profil personal 8 lei, sau 5 lei în plus cu abonamentul salonului activ. Checkout-ul nu este încă pornit.",
 notifications:"Notificările telefonului au nevoie de permisiunea browserului și de activarea unui serviciu Web Push. Fără abonarea la un serviciu Push, nu putem trimite alerte din fundal."
};
function context(){
 const pathname=location.pathname;
 if(pathname.includes("/admin"))return "admin";
 if(pathname.includes("/pro/calendar"))return "calendar";
 if(pathname.includes("/pro/")||pathname.includes("professionals.html"))return "pro";
 if(pathname.includes("passport"))return "passport";
 if(pathname.includes("barber-pass"))return "plans";
 if(pathname.includes("partner"))return "partners";
 if(pathname.includes("notification"))return "notifications";
 if(pathname.includes("/client")||pathname.endsWith("/index.html")||pathname.endsWith("/"))return document.querySelector(".view.active")?.id==="account"?"account":"discovery";
 return "discovery";
}
function say(text,role){
 const p=el("div","bcAssistantMessage "+(role==="user"?"isUser":"isBot"),text);
 transcript.append(p);transcript.scrollTop=transcript.scrollHeight;
}
function answer(q){
 const s=q.toLocaleLowerCase("ro-RO");
 if(/7[.,]99|preț|pret|abon|cost|lei|vip|premium/.test(s))
  return "Nu-i suport pe cei cu 7,99 lei, așa că am pus 8 lei. 😄 Pe bune: 8 lei pentru stilul personal, 15 lei pentru salon și 5 lei extra dacă salonul are deja un plan activ. Momentan sunt prețuri propuse; plata nu e activată.";
 if(/gps|raza|km|loca|harta|hartă|4men/.test(s))
  return "Apasă «Locația ta», acceptă GPS și reglează raza. Pe hartă, doar saloanele cu coordonate reale confirmate apar ca pinuri precise. Dacă 4MEN lipsește, proprietarul trebuie să-i confirme poziția din PRO → Profil online.";
 if(/misiun|nivel|xp|passport|streak|recompens/.test(s))
  return "Barber Passport are 20 de niveluri. Misiunile aduc XP doar din vizite QR finalizate, recenzii verificate și avatar. Rezervele nefinalizate nu cresc nivelul.";
 if(/program|orar|calendar|timp|zi|zile/.test(s))
  return "În PRO → Program de lucru, alegi orele și «Repetă în alte zile». Calendarul permite intervale din 15 în 15 minute și vederi 1, 3 sau 7 zile.";
 if(/cont|avatar|poz|parol|inregistr|autent/.test(s))
  return "Conturile Client și PRO sunt separate. În Contul meu poți încărca avatarul și edita profilul. Nu-ți cer parola în chat.";
 if(/admin|aproba|aprobare|public/.test(s))
  return "Admin → Prezentare generală afișează cererile în așteptare. Verifică datele salonului înainte să îl publici.";
 if(/notific|push|telefon/.test(s))return messages.notifications;
 if(/produs|magazin|partener|firma|firmă/.test(s))return "Pagina Parteneriate prezintă conceptul de magazin cu produse branduite. Furnizorul și salonul trebuie să semneze un acord înainte de checkout.";
 return messages[context()]||messages.discovery;
}
function showChat(){
 note.hidden=true;dialog.hidden=false;input.focus({preventScroll:true});
 if(!transcript.children.length)say("Salut! Spune-mi ce vrei să faci. Te pot ghida prin meniuri, calendar, misiuni și programări.","bot");
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
