(async()=>{"use strict";
const $=id=>document.getElementById(id),n=(t,text)=>{const x=document.createElement(t);if(text!==undefined)x.textContent=String(text);return x};
const params=new URLSearchParams(location.search);const mode=params.get("type")==="pro"?"pro":"client",invite=(params.get("ref")||"").toUpperCase();
if(invite&&/^BC[A-F0-9]{12}$/.test(invite))$("refCode").value=invite;
$("refLogin").elements.scope.value=mode;
$("refLogin").elements.scope.onchange=event=>{
 const url=new URL(location.href);
 url.searchParams.set("type",event.target.value==="pro"?"pro":"client");
 window.location.assign(url.href);
};
let active=null,scope=mode,staff=[];
const clients={
 client:window.BCAuthClient("client",{detectSessionInUrl:mode==="client"}),
 pro:window.BCAuthClient("pro",{detectSessionInUrl:mode==="pro"})
};
const status=msg=>$("refStatus").textContent=msg;
async function findSession(){
 // The invitation's declared portal owns this session. Never silently authenticate
 // Client with the PRO session, or reveal PRO data in a Client invitation.
 const {data:{user},error}=await clients[mode].auth.getUser();
 active=(!error&&user)?clients[mode]:null;
 scope=mode;
 return active?user:null;
}
async function call(name,args){if(!active)throw Error("LOGIN_REQUIRED");const {data,error}=await active.rpc(name,args);if(error)throw Error(error.message);return data}
async function draw(){
 let user=await findSession();
 if(user){
  const gate=mode==="pro"?"bc_pro_portal_access":"bc_client_my_approval";
  const {data,error}=await active.rpc(gate);
  const allowed=!error&&(mode==="pro"?data?.allowed===true:data?.status!=="wrong_portal");
  if(!allowed){
   await active.auth.signOut({scope:"local"});
   active=null;user=null;
   status(mode==="pro"?"Acest cont nu are acces PRO. Folosește un cont profesional.":"Acesta este un cont PRO; pentru invitațiile client folosește contul Client.");
  }
 }
 $("refAuth").hidden=!!user;$("refOwner").hidden=!user;
 if(!user){status("Intră în cont pentru a activa invitația sau a crea linkuri.");return}
 const [state,access]=await Promise.all([call("bc_referral_my_status",{}),active.rpc("bc_my_professional_access")]);
 staff=access.data?.filter(x=>["owner","manager"].includes(x.member_role))||[];
 const sel=$("refSalon");sel.replaceChildren();
 for(const s of staff)sel.append(new Option(s.salon_name,s.salon_id));
 $("refPro").disabled=!staff.length;
 $("refCampaign").textContent=state.enabled?"Campanie activă, cu validare ulterioară. Bonusuri propuse: "+
 state.terms.client_inviter_points+" puncte pentru cel care invită, "+
 state.terms.newcomer_points+" pentru noul client și "+state.terms.pro_free_days+" zile PRO solicitate pentru invitația B2B. Beneficiile se acordă numai după validare.":
 "Campaniile cu premii sunt momentan dezactivate de administrator. Linkurile și validările funcționează, dar NU acordă puncte, reduceri sau abonamente gratuite.";
 const history=$("refHistory"),rewards=$("refRewards"),links=$("refLinks");
 for(const x of [history,rewards,links])x.replaceChildren();
 for(const l of state.links||[])renderLink(l.code,l.audience);
 if(!state.referrals?.length)history.append(n("p","Nu ai invitații înregistrate."));
 for(const ref of state.referrals||[]){
  const row=n("div");row.className="refLine";row.append(n("span",ref.status),n("small",new Date(ref.at).toLocaleDateString("ro-RO")));history.append(row);
 }
 if(!state.rewards?.length)rewards.append(n("p","Nu există beneficii acordate."));
 for(const reward of state.rewards||[]){const row=n("div");row.className="refLine";
 row.append(n("strong",reward.amount+" · "+reward.kind),n("small",reward.status));rewards.append(row)}
 status("Autentificat. Linkurile sunt personale și nu garantează automat un premiu.");
}
function renderLink(code,audience){
 const url=new URL("./referral.html",location.href);
 url.searchParams.set("ref",code);url.searchParams.set("type",audience);
 const row=n("div");row.className="refLine";
 const details=n("div");details.className="refLinkDetails";
 const title=n("strong",audience==="pro"?"Link pentru saloane":"Link pentru clienți");
 const input=n("input");input.type="text";input.className="refShareUrl";input.readOnly=true;
 input.value=url.href;input.setAttribute("aria-label","Link de invitație BARBERCRAFT pentru "+(audience==="pro"?"PRO":"clienți"));
 const link=n("a","Deschide linkul ↗");link.className="refShareOpen";link.href=url.href;
 link.target="_blank";link.rel="noopener noreferrer";
 details.append(title,input,link);
 const actions=n("div");actions.className="refShareActions";
 const copy=n("button","Copiază linkul");copy.type="button";
 copy.onclick=async()=>{
  try{
   if(!navigator.clipboard?.writeText)throw new Error("CLIPBOARD_UNAVAILABLE");
   await navigator.clipboard.writeText(url.href);
   status("Link pentru "+(audience==="pro"?"PRO":"clienți")+" copiat.");
  }catch(_error){
   input.focus();input.select();
   status("Linkul este selectat. Apasă Copiază din meniul telefonului sau folosește «Deschide linkul».");
  }
 };
 actions.append(copy);row.append(details,actions);$("refLinks").append(row);
}
$("refLogin").onsubmit=async e=>{
 e.preventDefault();const f=e.currentTarget;const kind=e.submitter?.value||"login";
 scope=f.elements.scope.value;const target=clients[scope];active=target;
 const email=f.elements.email.value.trim(),password=f.elements.password.value;
 const redirect=new URL(location.href);redirect.hash="";
 const {data,error}=kind==="signup"?
  await target.auth.signUp({email,password,options:{emailRedirectTo:redirect.href}}):
  await target.auth.signInWithPassword({email,password});
 if(error){status(error.message);return}
 if(kind==="signup"&&!data.session){status("Verifică e-mailul pentru activarea contului, apoi revino pe același link.");return}
 await draw();
};
$("refClaim").onsubmit=async e=>{
 e.preventDefault();try{const result=await call("bc_referral_claim",{p_code:$("refCode").value.trim().toUpperCase()});
 status("Invitație înregistrată ("+result.audience+"). Se califică doar după acțiunea reală verificată.");
 await draw()}catch(err){status("Codul nu a fost înregistrat: "+err.message)}
};
$("refClient").onclick=async()=>{
 const button=$("refClient");button.disabled=true;
 try{
  const result=await call("bc_referral_link_create",{p_audience:"client",p_salon:null});
  await draw();
  status("Link pentru clienți pregătit. Îl poți copia sau deschide din lista de mai jos.");
  $("refLinks").scrollIntoView({block:"nearest",behavior:"smooth"});
 }catch(e){status("Nu s-a putut genera linkul: "+e.message)}
 finally{button.disabled=false}
};
$("refPro").onclick=async()=>{try{const result=await call("bc_referral_link_create",{p_audience:"pro",p_salon:$("refSalon").value});renderLink(result.code,"pro");status("Link PRO creat.")}catch(e){status(e.message)}};
await draw();
})();