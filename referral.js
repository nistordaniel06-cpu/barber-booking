(async()=>{"use strict";
const $=id=>document.getElementById(id),n=(t,text)=>{const x=document.createElement(t);if(text!==undefined)x.textContent=String(text);return x};
const params=new URLSearchParams(location.search);const mode=params.get("type")==="pro"?"pro":"client",invite=(params.get("ref")||"").toUpperCase();
if(invite&&/^BC[A-F0-9]{12}$/.test(invite))$("refCode").value=invite;
$("refLogin").elements.scope.value=mode;
let active=null,scope=mode,staff=[];
const clients={
 client:window.supabase.createClient(window.BARBERCRAFT_SUPABASE_URL,window.BARBERCRAFT_SUPABASE_PUBLISHABLE_KEY),
 pro:window.supabase.createClient(window.BARBERCRAFT_SUPABASE_URL,window.BARBERCRAFT_SUPABASE_PUBLISHABLE_KEY,{auth:{storageKey:"barbercraft-pro-session",persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}})
};
const status=msg=>$("refStatus").textContent=msg;
async function findSession(){
 for(const which of [mode,mode==="client"?"pro":"client"]){
  const {data:{user}}=await clients[which].auth.getUser();
  if(user){active=clients[which];scope=which;return user}
 }return null
}
async function call(name,args){if(!active)throw Error("LOGIN_REQUIRED");const {data,error}=await active.rpc(name,args);if(error)throw Error(error.message);return data}
async function draw(){
 const user=await findSession();$("refAuth").hidden=!!user;$("refOwner").hidden=!user;
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
 const row=n("div");row.className="refLine",details=n("div");details.append(n("strong",audience==="pro"?"Link pentru saloane":"Link pentru prieteni"));
 details.append(n("p",url.href));const b=n("button","Copiază linkul");b.type="button";
 b.onclick=()=>navigator.clipboard?.writeText(url.href).then(()=>status("Link copiat."),()=>status("Selectează linkul și copiază-l."));
 row.append(details,b);$("refLinks").append(row);
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
 if(kind==="signup"&&!data.user?.confirmed_at){status("Verifică e-mailul pentru activarea contului, apoi revino pe același link.");return}
 await draw();
};
$("refClaim").onsubmit=async e=>{
 e.preventDefault();try{const result=await call("bc_referral_claim",{p_code:$("refCode").value.trim().toUpperCase()});
 status("Invitație înregistrată ("+result.audience+"). Se califică doar după acțiunea reală verificată.");
 await draw()}catch(err){status("Codul nu a fost înregistrat: "+err.message)}
};
$("refClient").onclick=async()=>{try{const result=await call("bc_referral_link_create",{p_audience:"client",p_salon:null});renderLink(result.code,"client");status("Link client creat.")}catch(e){status(e.message)}};
$("refPro").onclick=async()=>{try{const result=await call("bc_referral_link_create",{p_audience:"pro",p_salon:$("refSalon").value});renderLink(result.code,"pro");status("Link PRO creat.")}catch(e){status(e.message)}};
await draw();
})();