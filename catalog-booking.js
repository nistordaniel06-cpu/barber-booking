(async()=>{"use strict";
const $=id=>document.getElementById(id),params=new URLSearchParams(location.search);
const salon=params.get("salon");
const setStatus=msg=>$("pilotClientStatus").textContent=msg;
const uuid=v=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v||"");
if(!uuid(salon)){
 setStatus("Adresa rezervării este invalidă. Revino în Catalog saloane.");return
}
if(!window.supabase){setStatus("Serviciul de rezervări nu este disponibil.");return}
const sb=window.BCAuthClient("client");
const rpc=async(fn,args={})=>{const {data,error}=await sb.rpc(fn,args);if(error)throw Error(error.message);return data};
let config=null,requestId=null,selected=null,busy=false;
async function checkAccount(){
 const access=$("catalogApprovalAccess"),form=$("catalogAccountLogin"),status=$("catalogAccountStatus");
 const {data:{user},error}=await sb.auth.getUser();
 access.hidden=false;
 if(error||!user){
  $("pilotClientForm").hidden=true;form.hidden=false;$("catalogLogout").hidden=true;
  status.textContent="Conectează-te sau creează cont. Conturile noi au nevoie de aprobarea administratorului.";
  return false;
 }
 $("catalogLogout").hidden=false;form.hidden=true;
 try{
  const result=await rpc("bc_client_my_approval");
  const state=result?.status||"pending";
  if(state==="approved"){
   access.hidden=true;$("pilotClientForm").hidden=false;
   setStatus("Cont aprobat. Alege serviciul și ora pentru rezervare.");return true;
  }
  $("pilotClientForm").hidden=true;
  status.textContent=state==="pending"?"Contul tău este în așteptarea aprobării din Admin. Revino aici după aprobare.":
   state==="suspended"?"Contul tău este suspendat. Contactează administratorul.":
   "Contul nu a fost aprobat. Contactează administratorul BARBERCRAFT.";
  return false;
 }catch(e){$("pilotClientForm").hidden=true;status.textContent="Nu am putut verifica aprobarea: "+e.message;return false;}
}
$("catalogAccountLogin").onsubmit=async e=>{
 e.preventDefault();const email=$("catalogAuthEmail").value.trim(),password=$("catalogAuthPassword").value;
 const {error}=await sb.auth.signInWithPassword({email,password});
 if(error){$("catalogAccountStatus").textContent="Autentificare eșuată: "+error.message;return;}
 await checkAccount();
};
$("catalogRegister").onclick=async()=>{
 const email=$("catalogAuthEmail").value.trim(),password=$("catalogAuthPassword").value;
 if(!email||password.length<8){$("catalogAccountStatus").textContent="Introdu e-mailul și o parolă de minimum 8 caractere.";return;}
 // Always send email-confirmation users to our deployed GitHub Pages booking page,
 // never to the Supabase localhost fallback. This URL must be on Supabase Auth's allowlist.
 const confirmUrl=new URL("https://nistordaniel06-cpu.github.io/barber-booking/catalog-booking.html");
 confirmUrl.searchParams.set("salon",salon);
 const {data,error}=await sb.auth.signUp({
  email,password,options:{
   emailRedirectTo:confirmUrl.toString(),
   data:{barbercraft_account_type:"client"}
  }
 });
 if(error){$("catalogAccountStatus").textContent="Nu am putut crea contul: "+error.message;return;}
 if(data.session){
  await checkAccount();
 }else{
  $("catalogAccountStatus").textContent="Verifică e-mailul pentru confirmarea contului, apoi așteaptă aprobarea administratorului.";
 }
};
$("catalogResendConfirmation").onclick=async()=>{
 const email=$("catalogAuthEmail").value.trim(),button=$("catalogResendConfirmation");
 if(!email||!$("catalogAuthEmail").checkValidity()){
  $("catalogAccountStatus").textContent="Introdu e-mailul corect înainte de retrimitere.";return;
 }
 button.disabled=true;$("catalogAccountStatus").textContent="Retrimitem confirmarea…";
 try{
  const confirmUrl=new URL("https://nistordaniel06-cpu.github.io/barber-booking/catalog-booking.html");
  confirmUrl.searchParams.set("salon",salon);
  const {error}=await sb.auth.resend({type:"signup",email,
   options:{emailRedirectTo:confirmUrl.toString()}});
  $("catalogAccountStatus").textContent=error?"Nu am putut retrimite: "+error.message:
   "Dacă adresa poate primi confirmări, vei primi un nou e-mail. Verifică și Spam.";
 }finally{button.disabled=false}
};
$("catalogLogout").onclick=async()=>{await sb.auth.signOut({scope:"local"});await checkAccount();};
$("catalogRecheck").onclick=checkAccount;

const localDate=(d)=>{
 const parts=new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Bucharest",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(d);
 const get=x=>parts.find(v=>v.type===x)?.value||"";
 return get("year")+"-"+get("month")+"-"+get("day");
};
const today=localDate(new Date()),end=new Date(Date.UTC(Number(today.slice(0,4)),Number(today.slice(5,7))-1,Number(today.slice(8,10))+14));
$("pilotDate").min=today;$("pilotDate").max=end.toISOString().slice(0,10);$("pilotDate").value=today;
function price(service){return Number(service.price).toLocaleString("ro-RO")+" lei · "+service.duration+" min";}
async function slots(){
 if(!config)return;
 selected=null;$("pilotSelectedTime").value="";
 const box=$("pilotSlots");box.replaceChildren();box.textContent="Se verifică orele…";
 const service=$("pilotService").value,date=$("pilotDate").value;
 if(!service||!date||date<today||date>$("pilotDate").max)return;
 try{
  const times=await rpc("bc_catalog_booking_slots",{p_catalog:salon,p_date:date,p_service:service});
  box.replaceChildren();
  if(!times?.length){box.textContent="Nu sunt ore disponibile în ziua aleasă. Încearcă altă zi.";return}
  for(const value of times){
   const b=document.createElement("button");b.type="button";b.textContent=value;b.setAttribute("aria-pressed","false");
   b.onclick=()=>{
    selected=value;$("pilotSelectedTime").value=value;
    box.querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed",String(x===b)));
   };
   box.append(b);
  }
 }catch(e){box.textContent="Nu am putut încărca orele. Reîncearcă.";setStatus(e.message)}
}
$("pilotService").onchange=()=>{const s=config.services.find(x=>x.name===$("pilotService").value);
 $("pilotServiceDetail").textContent=s?price(s):"";slots()};
$("pilotDate").onchange=slots;
$("pilotBookingForm").onsubmit=async e=>{
 e.preventDefault();
 if(busy)return;
 if(!(await checkAccount())){setStatus("Așteaptă aprobarea contului din Admin înainte de confirmare.");return;}
 if(!selected){setStatus("Selectează o oră disponibilă.");return}
 if(!$("pilotConsent").checked){setStatus("Pentru rezervare este necesar acordul privind datele de contact.");return}
 const name=$("pilotClientName").value.trim();
 let phone=$("pilotClientPhone").value.replace(/[\s().-]/g,"");
 if(/^07\d{8}$/.test(phone))phone="+4"+phone;
 if(!/^\+[1-9][0-9]{7,14}$/.test(phone)){setStatus("Introdu un număr valid, de exemplu +407xxxxxxxx.");return}
 if(!confirm("Confirmi această programare REALĂ la "+config.name+" în "+$("pilotDate").value+", ora "+selected+"?"))return;
 busy=true;$("pilotSubmit").disabled=true;
 if(!requestId)requestId=crypto.randomUUID();
 try{
  const result=await rpc("bc_catalog_booking_create",{p_catalog:salon,p_request:requestId,
   p_service:$("pilotService").value,p_date:$("pilotDate").value,p_time:selected,
   p_name:name,p_phone:phone,p_consent:true});
  if(!result?.confirmed)throw Error("Rezervarea nu a fost confirmată.");
  const when=new Date(result.start).toLocaleString("ro-RO",
   {timeZone:"Europe/Bucharest",dateStyle:"full",timeStyle:"short"});
  $("pilotResult").textContent=result.salon+" · "+result.service+" · "+when+
   " · "+result.price_ron+" lei. Programarea este salvată în calendarul salonului.";
  $("pilotBookingCode").textContent=result.code;
  $("pilotClientForm").hidden=true;$("pilotSuccess").hidden=false;
  setStatus("Rezervarea a fost confirmată. Salvează codul de mai jos.");
  $("pilotSuccess").scrollIntoView({behavior:"smooth",block:"start"});
 }catch(err){
  setStatus(err.message==="SLOT_TAKEN"?"Ora a fost rezervată între timp. Selectează alt interval.":"Rezervarea nu a fost efectuată: "+err.message);
  if(err.message==="SLOT_TAKEN")await slots();
 }finally{busy=false;$("pilotSubmit").disabled=false}
};
$("pilotFeedbackForm").onsubmit=async event=>{
 event.preventDefault();
 const form=event.currentTarget,button=form.querySelector("button"),notice=$("pilotFeedbackStatus");
 button.disabled=true;
 try{
  await rpc("bc_pilot_feedback_send",{p_booking_code:$("pilotBookingCode").textContent,
   p_rating:Number($("pilotRating").value),p_comment:$("pilotComment").value.trim()});
  notice.textContent="Mulțumim! Feedbackul a fost trimis salonului.";form.hidden=true;
 }catch(e){notice.textContent="Feedbackul nu a fost trimis: "+e.message;button.disabled=false}
};
$("pilotCopyCode").onclick=async()=>{
 const content=$("pilotResult").textContent+" Cod: "+$("pilotBookingCode").textContent;
 try{await navigator.clipboard.writeText(content);setStatus("Confirmarea a fost copiată.")}
 catch{setStatus("Poți salva o captură de ecran cu confirmarea.")}
};
try{
 config=await rpc("bc_catalog_booking_public",{p_catalog:salon});
 if(!config?.enabled){setStatus("Programările online nu sunt activate de acest salon. Revino în Catalog saloane.");return}
 $("pilotSalonName").textContent=config.name;
 $("pilotSalonAddress").textContent=config.address||"";
 for(const s of config.services||[])$("pilotService").append(new Option(s.name+" · "+price(s),s.name));
 await checkAccount();
 $("pilotService").dispatchEvent(new Event("change"));
}catch(e){setStatus("Nu am putut verifica salonul: "+e.message)}
})();