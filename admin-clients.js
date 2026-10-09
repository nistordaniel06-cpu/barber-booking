/* BARBERCRAFT · Client approvals in Admin. Only platform admins access these RPCs. */
(function(){"use strict";
const n=(tag,txt,cls)=>{const x=document.createElement(tag);if(txt!==undefined)x.textContent=String(txt);if(cls)x.className=cls;return x};
window.BCAdminClients={async render(sb,root){
 root.replaceChildren();root.classList.add("bcClientApprovals");
 root.append(n("span","BARBERCRAFT / ADMIN","bcApprovalKicker"),n("h2","Aprobă clienți"),n("p",
  "Conturile nou create așteaptă verificarea ta. Aprobarea contului permite rezervările din Catalog; conturile existente au fost păstrate active.",
  "bcApprovalIntro"));
 const state=n("p","Se încarcă cererile de aprobare…","bcApprovalState");state.setAttribute("role","status");
 root.append(state);
 const summary=n("div",undefined,"bcApprovalSummary"),bar=n("div",undefined,"bcApprovalBar");
 const input=n("input");input.placeholder="Caută după nume sau e-mail";input.type="search";input.setAttribute("aria-label","Caută un client");
 const choice=n("select");
 for(const [value,label] of [["pending","În așteptare"],["all","Toți"],["approved","Aprobați"],["rejected","Respinși"],["suspended","Suspendați"]])
  choice.append(new Option(label,value));
 const refresh=n("button","↻ Reîncarcă","bcApprovalButton");
 bar.append(input,choice,refresh);
 const list=n("div",undefined,"bcApprovalList");
 root.append(summary,bar,list);
 let clients=[];
 function draw(){
  summary.replaceChildren();
  for(const [label,value] of [["În așteptare",clients.filter(x=>x.status==="pending").length],
   ["Aprobați",clients.filter(x=>x.status==="approved").length],
   ["Total conturi",clients.length]]){
   const box=n("div",undefined,"bcApprovalCounter");box.append(n("strong",value),n("small",label));summary.append(box);
  }
  list.replaceChildren();const term=input.value.trim().toLocaleLowerCase("ro");
  const shown=clients.filter(x=>(choice.value==="all"||x.status===choice.value)&&
   [x.display_name,x.email,x.user_id].join(" ").toLocaleLowerCase("ro").includes(term));
  if(!shown.length){list.append(n("p","Nu sunt conturi în această categorie.","bcApprovalEmpty"));return}
  for(const client of shown){
   const box=n("article",undefined,"bcApprovalCard"),identity=n("div",undefined,"bcApprovalIdentity");
   const initials=(client.display_name||client.email||"C").slice(0,1).toUpperCase();
   const avatar=n("span",initials,"bcApprovalAvatar"),bio=n("div");
   bio.append(n("strong",client.display_name||client.email||"Client BARBERCRAFT"),
    n("small",client.email||"Fără e-mail disponibil"),n("small","Înregistrat: "+new Date(client.requested_at).toLocaleDateString("ro-RO")));
   identity.append(avatar,bio);
   const status=n("span",client.status==="pending"?"În așteptare":client.status==="approved"?"Aprobat":client.status==="rejected"?"Respins":"Suspendat","bcApprovalBadge bcApproval-"+client.status);
   const buttons=n("div",undefined,"bcApprovalActions");
   const act=(label,type)=>{
    const b=n("button",label,"bcApprovalButton"+(type==="approved"?" isApprove":type==="rejected"?" isReject":""));b.type="button";
    b.onclick=async()=>{
     let reason="";
     if(type==="rejected"||type==="suspended"){
      const why=prompt("Motiv (minimum 5 caractere) pentru "+(client.email||client.user_id));
      if(why===null)return;reason=why.trim();
      if(reason.length<5){state.textContent="Motivul trebuie să aibă minimum 5 caractere.";return;}
     }
     if(!confirm("Schimbi statusul clientului în «"+type+"»?"))return;
     b.disabled=true;state.textContent="Actualizăm statusul…";
     const {error}=await sb.rpc("bc_admin_client_review",{p_user:client.user_id,p_status:type,p_reason:reason});
     if(error){state.textContent="Acțiunea a eșuat: "+error.message;b.disabled=false;return}
     state.textContent="Status actualizat: "+(client.email||client.user_id)+".";
     await load();
    };
    buttons.append(b);
   };
   if(client.status!=="approved")act("✓ Aprobă","approved");
   if(client.status!=="pending")act("În așteptare","pending");
   if(client.status!=="rejected")act("Respinge","rejected");
   if(client.status!=="suspended")act("Suspendă","suspended");
   if(client.reason)box.append(n("p","Notă administrator: "+client.reason,"bcApprovalReason"));
   box.prepend(identity,status,buttons);list.append(box);
  }
 }
 async function load(){
  const {data,error}=await sb.rpc("bc_admin_clients_list");
  if(error){state.textContent="Nu putem afișa clienții: "+error.message;return}
  clients=Array.isArray(data)?data:[];state.textContent=clients.filter(x=>x.status==="pending").length+" clienți de aprobat.";
  draw();
 }
 input.oninput=draw;choice.onchange=draw;refresh.onclick=load;
 await load();
}};
})();