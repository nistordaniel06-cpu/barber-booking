/* PRO: a check-in alone does not create a reviewable visit.
   Staff must explicitly attest the finished service in this audited step. */
(async()=>{"use strict";
const $=id=>document.getElementById(id),el=(tag,text,cls)=>{const x=document.createElement(tag);if(text!==undefined)x.textContent=String(text);if(cls)x.className=cls;return x};
if(!$("serviceConfirmList")||!window.supabase)return;
const sb=window.supabase.createClient(window.BARBERCRAFT_SUPABASE_URL,window.BARBERCRAFT_SUPABASE_PUBLISHABLE_KEY);
const {data:{user}}=await sb.auth.getUser();if(!user)return;
const list=$("serviceConfirmList"),status=$("serviceConfirmStatus");
async function load(){
 const select=$("salon");if(!select?.value)return;
 list.replaceChildren();status.textContent="Se verifică ultimele check-in-uri…";
 const {data,error}=await sb.rpc("bc_pro_recent_checkins",{p_salon:select.value});
 if(error){status.textContent="Check-in-urile nu sunt disponibile: "+error.message;return}
 status.textContent="Confirmă numai serviciile finalizate efectiv. Nu se acordă XP automat.";
 if(!data?.length){list.append(el("p","Nu există check-in-uri QR în ultimele 48 de ore.","sub"));return}
 for(const item of data){
  const row=el("div",undefined,"item"),info=el("div");
  info.append(el("strong",item.name),el("p",new Date(item.date).toLocaleString("ro-RO")+" · "+(item.completed?"✓ Serviciu confirmat":"În așteptarea finalizării"),"sub"));
  row.append(info);
  if(!item.completed){const b=el("button","Confirmă serviciu finalizat","btn gold");b.type="button";
   b.onclick=async()=>{
    if(!confirm("Ai prestat și finalizat acest serviciu pentru clientul prezent? Această confirmare permite o recenzie verificată, dar nu acordă XP."))return;
    b.disabled=true;
    const {error}=await sb.rpc("bc_service_visit_complete",{p_checkin:item.id});
    status.textContent=error?"Confirmarea a eșuat: "+error.message:"Vizită verificată după check-in și confirmarea salonului.";
    await load();
   };row.append(b)}
  list.append(row);
 }
}
$("serviceConfirmReload").onclick=load;
$("salon")?.addEventListener("change",load);
document.addEventListener("bc-pro-salon-ready",load);
document.addEventListener("bc-pro-checkin-confirmed",load);
await load();
})();