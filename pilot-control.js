(async()=>{"use strict";
const $=id=>document.getElementById(id);
const node=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=String(text);return e};
const setStatus=text=>$("pilotStatus").textContent=text;
try{
 const sb=await window.BCPassportSession();
 if(!sb){setStatus("Configurația aplicației nu este disponibilă.");return}
 const {data:{user}}=await sb.auth.getUser();
 if(!user){setStatus("Conectează-te în contul BARBERCRAFT PRO pentru a configura pilotul.");return}
 const rpc=async(fn,args={})=>{const {data,error}=await sb.rpc(fn,args);if(error)throw Error(error.message);return data};
 const {data:access,error:accessError}=await sb.rpc("bc_my_professional_access");
 if(accessError)throw accessError;
 const salons=(access||[]).filter(x=>["owner","manager"].includes(x.member_role));
 if(!salons.length){setStatus("Acest cont nu administrează încă un salon PRO. Conectează-te cu contul proprietarului din BARBERCRAFT PRO.");return}
 $("pilotOwner").hidden=false;
 const select=$("pilotSalon");
 for(const s of salons)select.append(new Option(s.salon_name,s.salon_id));
 const params=new URLSearchParams(location.search);
 const preferred=params.get("salon");
 const fourMen=salons.find(s=>s.salon_name?.toLowerCase()==="4men");
 select.value=salons.some(s=>s.salon_id===preferred)?preferred:(fourMen?.salon_id||salons[0].salon_id);
 let config=null,services=[];
 function serviceEditor(){
  const box=$("pilotServices");box.replaceChildren();
  services.forEach((service,index)=>{
   const row=node("div");row.className="pilotServiceRow";
   const field=(label,type,value)=>{
    const wrap=node("label"),title=node("span",label),input=node("input");
    input.type=type;input.value=String(value??"");wrap.append(title,input);row.append(wrap);return input;
   };
   const name=field("Serviciu","text",service.name),price=field("Preț RON","number",service.price),
    duration=node("select");
   name.maxLength=90;name.placeholder="Ex.: Tuns clasic";price.min="1";price.max="1000";price.step="1";
   const dWrap=node("label"),dLabel=node("span","Durată");
   for(const minutes of [15,30,45,60,75,90,120])duration.append(new Option(minutes+" min",String(minutes)));
   duration.value=String(service.duration||30);dWrap.append(dLabel,duration);row.append(dWrap);
   const remove=node("button","Elimină");remove.type="button";remove.className="pilotDanger";
   remove.onclick=()=>{services.splice(index,1);serviceEditor()};
   name.oninput=()=>service.name=name.value;
   price.oninput=()=>service.price=price.value;
   duration.onchange=()=>service.duration=Number(duration.value);
   row.append(remove);box.append(row);
  });
 }
 $("pilotAddService").onclick=()=>{
  if(services.length>=12){setStatus("Maximum 12 servicii pentru pilot.");return}
  services.push({name:"",duration:30,price:""});serviceEditor()
 };
 function link(){
  if(!config?.invite_code)return null;
  const u=new URL("./pilot.html",location.href);
  u.searchParams.set("salon",select.value);u.searchParams.set("invite",config.invite_code);
  return u.href;
 }
 function renderLink(){
  const url=link(),enabled=config?.enabled;
  $("pilotShare").hidden=!enabled||!url;
  $("pilotNoShare").hidden=!!enabled&&!!url;
  if(url)$("pilotUrl").value=url;
 }
 function showBookings(items){
  const root=$("pilotBookings");root.replaceChildren();
  if(!items?.length){root.append(node("p","Nu există încă rezervări pilot."));return}
  for(const item of items){
   const row=node("div");row.className="pilotBookingRow";
   row.append(node("strong",item.name+" · "+item.service));
   row.append(node("span",new Date(item.starts_at).toLocaleString("ro-RO",
    {timeZone:"Europe/Bucharest",dateStyle:"medium",timeStyle:"short"})+" · "+item.status));
   row.append(node("span","Telefon: "+item.phone+" · Cod: "+item.code));
   root.append(row);
  }
 }
 async function refresh(){
  try{
   const state=await rpc("bc_pilot_owner_state",{p_salon:select.value});
   config=state;
   $("pilotEnabled").checked=!!state.enabled;
   $("pilotOpens").value=state.opens||"10:00";
   $("pilotCloses").value=state.closes||"19:00";
   services=(state.services||[]).map(s=>({...s}));serviceEditor();
   showBookings(state.bookings);renderLink();
   const feedbackBox=$("pilotFeedbackList");feedbackBox.replaceChildren();
   if(!state.feedback?.length)feedbackBox.append(node("p","Clienții nu au trimis încă feedback."));
   for(const answer of state.feedback||[]){
    const row=node("div");row.className="pilotFeedbackRow";
    row.append(node("strong","★".repeat(answer.rating)+"☆".repeat(5-answer.rating)+" · "+answer.code),
     node("small",answer.comment),node("small",new Date(answer.date).toLocaleDateString("ro-RO")));
    feedbackBox.append(row);
   }
   setStatus(state.enabled?"Pilotul este activ. Programările noi vor intra în calendarul PRO.":
    "Pilotul este oprit. Completează serviciile și apasă «Salvează configurarea» când ești pregătit.");
  }catch(e){setStatus("Configurația nu a putut fi încărcată: "+e.message)}
 }
 select.onchange=refresh;$("pilotRefresh").onclick=refresh;
 $("pilotCopy").onclick=async()=>{
  const url=link();if(!url)return;
  try{await navigator.clipboard.writeText(url);setStatus("Linkul privat a fost copiat.")}
  catch{setStatus("Selectează câmpul cu linkul și copiază-l manual.");$("pilotUrl").focus();$("pilotUrl").select();}
 };
 $("pilotOpen").onclick=()=>{const url=link();if(url)window.open(url,"_blank","noopener")};
 async function save(rotate=false){
  const enabled=$("pilotEnabled").checked;
  const cleaned=services.map(s=>({name:String(s.name||"").trim(),duration:Number(s.duration),price:Number(s.price)}));
  if(cleaned.some(s=>s.name.length<3||!Number.isInteger(s.price)||s.price<1||s.price>1000)){
   setStatus("Completează denumirea și prețul real (RON) la fiecare serviciu.");return
  }
  if(enabled&&!cleaned.length){setStatus("Adaugă cel puțin un serviciu înainte de activare.");return}
  if(rotate&&!confirm("Vechiul link de invitație nu va mai funcționa. Generezi altul?"))return;
  if(enabled&&!config?.enabled&&!confirm("Activezi rezervările reale? Un client care confirmă ocupă efectiv intervalul în calendarul PRO."))return;
  const b=$("pilotSave");b.disabled=true;
  try{
   await rpc("bc_pilot_configure",{p_salon:select.value,p_enabled:enabled,
    p_services:cleaned,p_opens:$("pilotOpens").value,p_closes:$("pilotCloses").value,
    p_regenerate_code:rotate});
   await refresh();
   setStatus(rotate?"Link nou creat. Trimite-l doar clienților de test.":"Salvat. "+(enabled?"Pilotul acceptă acum rezervări.":"Pilotul este oprit."));
  }catch(e){setStatus("Nu am putut salva: "+e.message)}
  finally{b.disabled=false}
 }
 $("pilotSave").onclick=()=>save(false);
 $("pilotRotate").onclick=()=>save(true);
 await refresh();
}catch(e){setStatus("Nu am putut încărca pilotul: "+e.message)}
})();