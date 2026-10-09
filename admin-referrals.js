(function(){"use strict";
const el=(t,text,cls)=>{const x=document.createElement(t);if(text!==undefined)x.textContent=String(text);if(cls)x.className=cls;return x};
window.BCReferralAdmin={render:async(sb,root)=>{
 root.replaceChildren(el("h2","Referral · campanii și conversii"));
 const tip=el("p","Campania pornește DEZACTIVATĂ. Creează regulile și aprobă bugetul înainte de a permite bonusuri. Linkurile funcționează pentru invitații, dar nu acordă automat puncte.","sub");
 root.append(tip);
 const {data,error}=await sb.rpc("bc_admin_referral_overview");
 if(error){root.append(el("p","Datele nu sunt disponibile: "+error.message,"status"));return}
 const cfg=data.campaign||{},form=el("form");
 form.innerHTML='<label class="field">Activare campanie<select name="enabled" class="input"><option value="false">Dezactivată</option><option value="true">Activă — după aprobarea regulamentului</option></select></label>'+
 '<label class="field">Puncte promo propuse pentru invitator<input name="referrer" class="input" type="number" min="0" max="1000" required></label>'+
 '<label class="field">Puncte promo propuse pentru invitat<input name="invitee" class="input" type="number" min="0" max="1000" required></label>'+
 '<label class="field">Zile PRO propuse pentru partenerul nou<input name="days" class="input" type="number" min="0" max="90" required></label>'+
 '<button type="submit" class="btn gold">Salvează regulamentul</button>';
 form.elements.enabled.value=String(!!cfg.enabled);
 form.elements.referrer.value=cfg.client_referrer_points??100;
 form.elements.invitee.value=cfg.client_newcomer_points??50;
 form.elements.days.value=cfg.pro_free_days??14;
 const msg=el("p","","status");
 form.onsubmit=async e=>{
  e.preventDefault();
  if(form.elements.enabled.value==="true"&&!confirm("Activezi campania? Asigură-te că ai regulament, buget și un mecanism de valorificare a beneficiilor. Bonusurile nu se alocă automat în wallet."))return;
  const {error}=await sb.rpc("bc_admin_referral_config",{
   p_enabled:form.elements.enabled.value==="true",p_referrer:Number(form.elements.referrer.value),
   p_invitee:Number(form.elements.invitee.value),p_days:Number(form.elements.days.value)});
  msg.textContent=error?"Nu s-a salvat: "+error.message:"Regulament salvat. Bonusurile se gestionează separat de punctele XP ale jocului.";
 };
 root.append(form,msg,el("h3","Invitații recente"));
 if(!data.claims?.length)root.append(el("p","Încă nu există invitații înregistrate.","sub"));
 for(const item of data.claims||[]){
  const row=el("div",undefined,"item"),info=el("div");
  info.append(el("strong",(item.audience==="pro"?"Saloane":"Client")+" · "+item.status),
  el("small",new Date(item.created_at).toLocaleDateString("ro-RO")));
  row.append(info);
  if(item.audience==="pro"&&item.status==="registered"){
   const b=el("button","Verifică salonul nou","btn");b.type="button";
   b.onclick=async()=>{
    const {error}=await sb.rpc("bc_admin_referral_pro_verify",{p_claim:item.id});
    msg.textContent=error?"Verificare respinsă: "+error.message:"Invitație PRO calificată, bonusul rămâne în așteptarea gestionării comerciale.";
    if(!error)b.disabled=true;
   };
   row.append(b);
  }
  root.append(row);
 }
}};
})();