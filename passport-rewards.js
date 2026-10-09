/* BARBERCRAFT: authenticated rewards marketplace & expiring claim QR. */
(async()=>{"use strict";
const $=id=>document.getElementById(id);
const el=(tag,content,cls)=>{const x=document.createElement(tag);if(content!==undefined)x.textContent=String(content);if(cls)x.className=cls;return x;};
const root=$("rewardMarketplace");if(!root||!window.supabase)return;
const sb=window.supabase.createClient(window.BARBERCRAFT_SUPABASE_URL,window.BARBERCRAFT_SUPABASE_PUBLISHABLE_KEY);
const {data:{user}}=await sb.auth.getUser();if(!user)return;
const fmt=n=>new Intl.NumberFormat("ro-RO").format(Number(n)||0);
const message=$("rewardFlowStatus"),claims=$("rewardClaimList"),qrPanel=$("rewardQrPanel"),market=$("rewardMarketList");
let available=0,partnerItems=[],rewards=[];
function feedback(text){message.textContent=text}
function readable(e){const codes={INSUFFICIENT_POINTS:"Nu ai suficiente puncte disponibile.",REWARD_OUT_OF_STOCK:"Recompensa nu mai este în stoc.",SALON_NOT_PARTICIPATING:"Salonul nu mai participă la această recompensă.",CLAIM_EXPIRED:"Cererea sau codul au expirat.",REWARD_NOT_AVAILABLE:"Recompensa nu mai este disponibilă."};return codes[e?.message]||e?.message||"A apărut o eroare."}
async function loadWallet(){
 const {data,error}=await sb.rpc("bc_reward_wallet");if(error){feedback("Portofel indisponibil: "+readable(error));return}
 available=Number(data.available)||0;$("rewardBalance").textContent=fmt(available);
 $("rewardCommitted").textContent="Total acumulat: "+fmt(data.earned)+" · Rezervat/folosit: "+fmt(data.committed);
 claims.replaceChildren();
 if(!(data.claims||[]).length){claims.append(el("p","Nu ai revendicat încă recompense.","muted"));return}
 for(const c of data.claims){
  const row=el("article",undefined,"item"),info=el("div");
  info.append(el("strong",c.title),el("p",c.salon+" · "+c.cost+" puncte · "+({requested:"În așteptarea salonului",redeemed:"Utilizată",cancelled:"Anulată",expired:"Expirată"}[c.status]||c.status),"muted"));
  const actions=el("div",undefined,"actions");
  if(c.status==="requested"){
   const view=el("button","Arată cod QR","btn gold");view.type="button";view.onclick=()=>showQr(c.id);
   const cancel=el("button","Anulează","btn");cancel.type="button";cancel.onclick=async()=>{
    if(!confirm("Anulezi această cerere și eliberezi punctele?"))return;
    cancel.disabled=true;const {error}=await sb.rpc("bc_reward_claim_cancel",{p_claim:c.id});
    feedback(error?readable(error):"Cererea a fost anulată și punctele au fost eliberate.");
    await Promise.all([loadWallet(),loadMarket()]);
   };actions.append(view,cancel);
  }
  row.append(info,actions);claims.append(row);
 }
}
async function showQr(id){
 qrPanel.replaceChildren();feedback("Se pregătește un cod de unică folosință…");
 const {data,error}=await sb.rpc("bc_reward_claim_qr",{p_claim:id});
 if(error){feedback("Nu s-a generat codul: "+readable(error));return}
 const name=el("h3","Prezintă codul la salon"),description=el("p","Codul expiră în 5 minute și poate fi utilizat o singură dată. Redeschide-l pentru un cod nou.","muted");
 const square=el("div",undefined,"rewardQrSquare"),secret=el("code",data.payload,"rewardQrCode");
 if(window.QRCode){new window.QRCode(square,{text:data.payload,width:190,height:190,colorDark:"#151515",colorLight:"#ffffff",correctLevel:window.QRCode.CorrectLevel.M})}
 else square.append(el("p","Codul QR nu poate fi desenat offline. Poți copia codul de mai jos.","muted"));
 const copy=el("button","Copiază codul","btn");copy.type="button";copy.onclick=async()=>{try{await navigator.clipboard.writeText(data.payload);feedback("Cod copiat.");}catch{feedback("Selectează și copiază codul afișat.")}};
 const ttl=el("p","Valabil până la "+new Date(data.valid_until).toLocaleTimeString("ro-RO",{hour:"2-digit",minute:"2-digit"}),"muted");
 qrPanel.append(name,description,square,secret,copy,ttl);
 qrPanel.scrollIntoView({behavior:"smooth",block:"center"});feedback("Codul este pregătit. Nu îl distribui public.");
}
async function loadMarket(){
 const [r,p]=await Promise.all([
  sb.from("bc_reward_templates").select("id,title,description,category,points_cost,stock").eq("is_active",true).gt("points_cost",0).order("points_cost"),
  sb.rpc("bc_reward_available_partners")]);
 if(r.error||p.error){feedback("Catalog indisponibil: "+readable(r.error||p.error));return}
 rewards=r.data||[];partnerItems=p.data||[];market.replaceChildren();
 if(!rewards.length){market.append(el("p","Recompensele vor fi afișate aici când sunt activate de administrator.","muted"));return}
 for(const reward of rewards){
  const card=el("article",undefined,"offer"),optionList=partnerItems.filter(s=>s.reward_id===reward.id);
  card.append(el("b",reward.points_cost+" PUNCTE · "+reward.category.toUpperCase()),el("strong",reward.title),el("p",reward.description));
  const label=el("label","Salon participant","field"),select=el("select");select.setAttribute("aria-label","Alege salonul pentru "+reward.title);
  if(!optionList.length)select.append(new Option("Niciun salon înscris",""));
  else for(const opt of optionList)select.append(new Option(opt.salon_name,opt.salon_id));
  label.append(select);card.append(label);
  const button=el("button",!optionList.length?"În pregătire":available<reward.points_cost?"Puncte insuficiente":"Solicită recompensa","btn gold");
  button.type="button";button.disabled=!optionList.length||available<reward.points_cost||reward.stock===0;
  button.onclick=async()=>{
   if(!confirm("Rezervi "+reward.points_cost+" puncte pentru "+reward.title+"? Cererea este valabilă 7 zile."))return;
   button.disabled=true;feedback("Se verifică punctele și stocul…");
   const {data,error}=await sb.rpc("bc_reward_claim_create",{p_reward:reward.id,p_salon:select.value});
   if(error)feedback("Cererea nu s-a înregistrat: "+readable(error));
   else{feedback("Recompensă solicitată. Prezintă codul QR salonului pentru confirmare.");await Promise.all([loadWallet(),loadMarket()]);await showQr(data.id)}
   button.disabled=false;
  };card.append(button);market.append(card);
 }
}
await loadWallet();await loadMarket();
})();