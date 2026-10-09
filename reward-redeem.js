(async()=>{"use strict";
const $=id=>document.getElementById(id),el=(tag,text,cls)=>{const d=document.createElement(tag);if(text!==undefined)d.textContent=String(text);if(cls)d.className=cls;return d};
if(!window.supabase){$("authStatus").textContent="Autentificarea nu este configurată.";return}
const sb=window.supabase.createClient(window.BARBERCRAFT_SUPABASE_URL,window.BARBERCRAFT_SUPABASE_PUBLISHABLE_KEY);
const {data:{user}}=await sb.auth.getUser();
if(!user){$("authStatus").replaceChildren(el("span","Intră în contul PRO pentru a valida recompense. "),Object.assign(el("a","Autentificare →"),{href:"./professionals.html"}));return}
const {data:shops,error:shopsError}=await sb.rpc("bc_my_professional_access");
if(shopsError||!shops?.length){$("authStatus").textContent=shopsError?"Nu s-au încărcat saloanele: "+shopsError.message:"Nu ai un salon asociat. Solicită acces de la proprietar.";return}
$("portal").hidden=false;$("authStatus").textContent="Acces verificat: "+shops.length+" locații disponibile.";
const select=$("salon");
for(const shop of shops)select.append(new Option(shop.salon_name+" · "+shop.member_role,shop.salon_id));
const current=()=>shops.find(s=>s.salon_id===select.value);
async function loadOffers(){
 const s=current(),canEdit=["owner","manager"].includes(s.member_role);
 $("role").textContent="Rolul tău: "+s.member_role+(canEdit?" · poți activa/dezactiva ofertele.":" · poți confirma recompense prezentate de clienți.");
 const box=$("offerList");box.replaceChildren();$("offerStatus").textContent="Se încarcă ofertele…";
 const {data,error}=await sb.rpc("bc_reward_partner_catalog",{p_salon:s.salon_id});
 if(error){$("offerStatus").textContent="Nu s-au încărcat: "+error.message;return}
 $("offerStatus").textContent="Doar ofertele activate de administratorul platformei sunt vizibile clienților.";
 if(!data?.length){box.append(el("p","Nu există recompense configurate în platformă.","sub"));return}
 for(const item of data){
  const row=el("div",undefined,"item"),info=el("div");
  info.append(el("strong",item.title),el("p",item.cost+" puncte · "+(item.active?"Catalog activ":"Draft administrativ"),"sub"));
  const label=el("label",undefined,"toggle"),toggle=el("input");toggle.type="checkbox";toggle.checked=!!item.enabled;toggle.disabled=!canEdit;toggle.setAttribute("aria-label","Activează "+item.title);
  const caption=el("span",item.enabled?"Participă":"Nu participă");label.append(toggle,caption);
  toggle.onchange=async()=>{toggle.disabled=true;
   if(!confirm("Confirmi "+(toggle.checked?"participarea la":"dezactivarea pentru")+" "+item.title+"?")){toggle.checked=!toggle.checked;toggle.disabled=!canEdit;return}
   const {error}=await sb.rpc("bc_reward_partner_set",{p_salon:s.salon_id,p_reward:item.id,p_enabled:toggle.checked});
   $("offerStatus").textContent=error?"Schimbarea nu s-a salvat: "+error.message:"Participarea a fost actualizată.";
   await loadOffers();
  };
  row.append(info,label);box.append(row);
 }
}
$("redeemBtn").onclick=async()=>{
 const input=$("claimCode"),payload=input.value.trim(),s=current(),button=$("redeemBtn");
 if((!payload.startsWith("BC1|")&&!payload.startsWith("BCP1|"))||payload.length>200){$("redeemStatus").textContent="Introdu un cod BARBERCRAFT valid.";return}
 const identity=payload.startsWith("BCP1|");if(!confirm(identity?"Confirmi prezența clientului în salon? Check-in-ul nu acordă puncte.":"Confirmi că ai acordat deja clientului beneficiul corespunzător? Codul va fi consumat definitiv."))return;
 button.disabled=true;$("redeemStatus").textContent="Se verifică autenticitatea codului…";
 try{
  const {data,error}=identity?await sb.rpc("bc_passport_qr_checkin",{p_salon:s.salon_id,p_payload:payload}):await sb.rpc("bc_reward_claim_redeem",{p_salon:s.salon_id,p_qr:payload});
  if(error)throw error;
  $("redeemStatus").textContent=identity?"✓ Check-in verificat: "+data.display_name+(data.new_checkin?" · înregistrat":" · deja înregistrat recent")+". Nu s-au acordat XP.":"✓ Recompensă validată: "+data.reward+" · "+data.points_used+" puncte consumate.";
  input.value="";
 }catch(err){$("redeemStatus").textContent="Cod respins: "+err.message}finally{button.disabled=false}
};
let stream=null,raf=0,detector=null,stopped=true;
function stop(){stopped=true;if(raf)cancelAnimationFrame(raf);raf=0;if(stream){stream.getTracks().forEach(t=>t.stop());stream=null}$("scanVideo").hidden=true;$("stopBtn").hidden=true;$("scanBtn").hidden=false}
$("stopBtn").onclick=stop;
$("scanBtn").onclick=async()=>{
 if(!navigator.mediaDevices?.getUserMedia||typeof BarcodeDetector==="undefined"){$("redeemStatus").textContent="Scanarea QR nu este compatibilă cu acest browser. Copiază codul din Barber Passport.";return}
 try{
  detector=new BarcodeDetector({formats:["qr_code"]});
  stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"}},audio:false});
  const video=$("scanVideo");video.srcObject=stream;await video.play();video.hidden=false;
  $("stopBtn").hidden=false;$("scanBtn").hidden=true;stopped=false;
  const frame=async()=>{
   if(stopped)return;
   try{const hits=await detector.detect(video);const found=hits.find(h=>(h.rawValue?.startsWith("BC1|")||h.rawValue?.startsWith("BCP1|")));if(found){$("claimCode").value=found.rawValue;$("redeemStatus").textContent="Cod citit. Verifică și confirmă manual utilizarea.";stop();return}}
   catch{}
   if(!stopped)raf=requestAnimationFrame(frame);
  };raf=requestAnimationFrame(frame);
 }catch(e){stop();$("redeemStatus").textContent="Camera nu poate fi deschisă: "+e.message}
};
window.addEventListener("pagehide",stop);select.addEventListener("change",()=>{stop();$("claimCode").value="";loadOffers()});
await loadOffers();
})();