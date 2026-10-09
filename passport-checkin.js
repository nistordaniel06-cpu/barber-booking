/* BARBERCRAFT temporary identity QR: opt-in check-in only, never loyalty award. */
(async()=>{"use strict";
const $=id=>document.getElementById(id),el=(tag,txt,cls)=>{const n=document.createElement(tag);if(txt!==undefined)n.textContent=String(txt);if(cls)n.className=cls;return n};
if(!$("passportCheckin")||!window.supabase)return;
const sb=await window.BCPassportSession();
const {data:{user}}=await sb.auth.getUser();if(!user)return;
const display=$("passportCheckinCode"),log=$("passportCheckins"),status=$("passportCheckinStatus"),button=$("passportIssueQr");
let expiryTimer=null;
async function refresh(){
 const {data,error}=await sb.rpc("bc_passport_my_checkins");log.replaceChildren();
 if(error){log.append(el("p","Istoricul check-in nu este disponibil: "+error.message,"muted"));return}
 if(!data?.length){log.append(el("p","Încă nu ai check-in-uri verificate. Acestea sunt distincte de vizitele care oferă XP.","muted"));return}
 for(const row of data){const node=el("div",undefined,"item");node.append(el("span",row.salon),el("small",new Date(row.at).toLocaleString("ro-RO")));log.append(node)}
}
button.onclick=async()=>{
 button.disabled=true;if(expiryTimer)clearTimeout(expiryTimer);display.replaceChildren();status.textContent="Generăm un cod de identificare temporar…";
 const {data,error}=await sb.rpc("bc_passport_qr_issue");
 if(error){status.textContent="Codul nu a fost generat: "+(error.message==="TRY_AGAIN_SHORTLY"?"Reîncearcă în câteva secunde.":error.message);button.disabled=false;return}
 const square=el("div",undefined,"rewardQrSquare");
 try{window.BCRenderPassportQr(square,data.payload)}
 catch(err){square.replaceChildren(el("p","QR indisponibil ("+err.message+"). Folosește «Copiază codul».","muted"));}
 const token=el("code","BCP1 ···· "+data.payload.slice(-8),"rewardQrCode");
 const reveal=el("button","Vezi codul complet","bc-qr-disclosure");reveal.type="button";
 reveal.onclick=()=>{const visible=token.dataset.revealed==="true";token.dataset.revealed=visible?"false":"true";
 token.textContent=visible?"BCP1 ···· "+data.payload.slice(-8):data.payload;reveal.textContent=visible?"Vezi codul complet":"Ascunde codul"};
 const copy=el("button","Copiază codul","btn");
 copy.type="button";copy.onclick=async()=>{try{await navigator.clipboard.writeText(data.payload);status.textContent="Cod copiat. Prezintă-l doar personalului salonului."}catch{status.textContent="Selectează codul și copiază-l manual."}};
 const brand=el("div","PAȘAPORTUL MEU · QR PRIVAT","eyebrow");
 const expire=el("p","Valabil până la "+new Date(data.valid_until).toLocaleTimeString("ro-RO",{hour:"2-digit",minute:"2-digit"}),"muted");
 display.append(brand,square,token,reveal,copy,expire);
 const remaining=Math.max(0,new Date(data.valid_until).getTime()-Date.now());
 expiryTimer=setTimeout(()=>{display.replaceChildren(el("p","Codul a expirat. Apasă din nou pentru unul nou.","muted"));status.textContent="Codul QR este expirat. Generează unul nou la salon.";},remaining+150);
 
 status.textContent="Arată codul doar când ești la salon. Check-in-ul nu acordă puncte și nu confirmă prestarea serviciului.";
 button.disabled=false;
};
await refresh();
})();