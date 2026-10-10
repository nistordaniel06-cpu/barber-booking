/* BARBERCRAFT Social: client/barber profiles, mutual follows, safe text chat,
   haircut polls, verified visits/reviews and feedback from 5-visit customers. */
(async()=>{"use strict";
const $=id=>document.getElementById(id);
const el=(tag,txt,cls)=>{const n=document.createElement(tag);if(txt!==undefined)n.textContent=String(txt);if(cls)n.className=cls;return n};
const btn=(label,fn,cls="")=>{const b=el("button",label,"socialButton "+cls);b.type="button";b.onclick=fn;return b};
const line=(msg)=>$("socialStatus").textContent=String(msg);
const rpc=async(name,args={})=>{const {data,error}=await sb.rpc(name,args);if(error)throw new Error(error.message);return data};
const favoriteClient=window.BCAuthClient?.("client",{detectSessionInUrl:false});
const heartFormat=n=>new Intl.NumberFormat("ro-RO").format(Number(n)||0);
async function barberHeart(id){
 const button=el("button",null,"socialBarberHeart");
 button.type="button";button.setAttribute("aria-label","Salvează frizerul la favorite");
 const sym=el("span","♡","socialHeartSymbol"),count=el("span","0","socialHeartCount");
 button.append(sym,count);
 try{
  const {data,error}=await sb.rpc("bc_favorite_summary",{p_kind:"barber",p_targets:[id]});
  if(!error&&data?.[0]){button.classList.toggle("isSaved",!!data[0].saved);
   sym.textContent=data[0].saved?"♥":"♡";count.textContent=heartFormat(data[0].count);}
 }catch(_){}
 button.onclick=async()=>{
  if(!favoriteClient)return;
  const {data:{user:clientUser}}=await favoriteClient.auth.getUser();
  if(!clientUser){line("Pentru favorite, autentifică-te în Portal Client.");return}
  button.disabled=true;
  const {data,error}=await favoriteClient.rpc("bc_favorite_toggle",{p_kind:"barber",p_target:id});
  button.disabled=false;
  if(error){line("Nu am salvat frizerul: "+error.message);return}
  button.classList.toggle("isSaved",!!data.saved);
  sym.textContent=data.saved?"♥":"♡";count.textContent=heartFormat(data.count);
  line(data.saved?"Frizer salvat în favorite.":"Frizer eliminat din favorite.");
 };
 return button;
}
async function friendOnlineMap(ids){
 if(!ids.length)return new Map();
 try{const data=await rpc("bc_social_online_for",{p_users:[...new Set(ids)].slice(0,100)});
 return new Map((data||[]).map(v=>[v.user_id,!!v.online]))}catch{return new Map()}
}
function onlineDot(online){
 const d=el("span",null,"socialOnlineDot"+(online?" isOnline":""));
 d.title=online?"Online acum (cu acordul utilizatorului)":"Status online nedisponibil";
 d.setAttribute("aria-label",online?"Online":"Status online nepublic");
 return d;
}
let onlineTick=null;
async function startPresence(){
 if(!user)return;
 try{
  const state=await rpc("bc_social_presence_ping");
  const control=$("socialOnlineVisible");if(control)control.checked=!!state.share_online;
  if(!onlineTick)onlineTick=setInterval(()=>{
   if(document.visibilityState==="visible")void rpc("bc_social_presence_ping").catch(()=>{});
  },60000);
 }catch(_){}
}
$("socialOnlineVisible")?.addEventListener("change",async event=>{
 const control=event.target;control.disabled=true;
 try{await rpc("bc_social_presence_ping",{p_share:control.checked});
  line(control.checked?"Online public activat.":"Online public dezactivat.");}
 catch(e){control.checked=!control.checked;msgErr(e)}
 finally{control.disabled=false}
});
async function loadFriends(){
 const box=$("socialFriends");if(!box||!user)return;
 box.replaceChildren(el("p","Se încarcă prietenii…"));
 try{
  const items=await rpc("bc_social_friends_list");box.replaceChildren();
  if(!items.length){box.append(el("p","Prietenii apar aici după ce vă urmăriți reciproc."));return}
  for(const person of items){
   const row=el("div",null,"socialPerson socialFriendRow"),info=el("div");
   const label=el("strong",person.name);label.prepend(onlineDot(person.online));
   info.append(label,el("small","@"+person.handle+" · "+(person.online?"Online":"Offline sau invizibil")));
   const see=btn("Profil",()=>showPerson(person.user_id));
   row.append(info,see);
   if(person.can_message)row.append(btn("Mesaj",()=>startChat(person.user_id,person.name),"primary"));
   box.append(row);
  }
 }catch(e){box.replaceChildren(el("p","Lista prietenilor nu este disponibilă."));msgErr(e)}
}

const api=window.supabase;
if(!api||!window.BARBERCRAFT_SUPABASE_URL){line("Comunitatea nu este disponibilă.");return}
const sb=await window.BCPassportSession();
const {data:{user},error}=await sb.auth.getUser();
const profileForm=$("socialProfileForm"),self=$("socialMyProfile"),barber=$("socialBarber"),clientGallery=$("socialClientGallery");
let me=null,own=null,selected=null,chatWith=null,staff=[],mutuals=[],chatTimer=null;
let privacyEligibility=null;
const uuid=x=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x||"");
function openTab(name){
 if(name==="ideas")name="discover";
 document.querySelectorAll(".socialPanel").forEach(x=>x.hidden=x.id!=="panel"+name[0].toUpperCase()+name.slice(1));
 document.querySelectorAll(".socialTabs button").forEach(x=>x.classList.toggle("selected",x.dataset.panel===name));
 if(name==="messages"){void loadMutuals();void loadFriends();}
 
}
document.querySelectorAll(".socialTabs button").forEach(b=>b.onclick=()=>openTab(b.dataset.panel));
function msgErr(err){line("Nu am putut efectua acțiunea: "+(err?.message||String(err)))}
async function loadMyProfile(){
 if(!user)return;
 own=await rpc("bc_social_profile_read",{p_user:user.id});
 if(own){
  profileForm.elements.name.value=own.display_name;profileForm.elements.handle.value=own.handle;
  profileForm.elements.bio.value=own.bio;profileForm.elements.public.checked=!!own.is_public;
  profileForm.elements.messages.checked=!!own.allow_messages;
 }else{
  // No social profile becomes public until the Client explicitly saves one.
  profileForm.elements.public.checked=true;
 }
 const privacyHint=$("socialPrivacyHint"),privacyInput=profileForm.elements.public;
 try{
  privacyEligibility=await rpc("bc_social_privacy_eligibility");
  const eligible=!!privacyEligibility?.can_make_private;
  privacyInput.disabled=!eligible;
  privacyInput.checked=own?!!own.is_public:true;
  privacyHint.textContent=eligible?
   "Vizibilitatea este la alegerea ta. Poți schimba oricând între public și privat.":
   "Profilul nou poate fi doar public. După "+privacyEligibility.verified_visits+
   " / 3 tunsori finalizate și verificate, vei putea să-l faci privat. Nu ești obligat să publici profilul.";
  privacyHint.dataset.unlocked=String(eligible);
 }catch(error){
  privacyEligibility=null;
  privacyInput.disabled=true;
  privacyHint.textContent="Nu putem verifica cele 3 vizite momentan; schimbarea vizibilității rămâne indisponibilă.";
 }
 self.replaceChildren();
 self.append(el("strong",own?"@"+own.handle:"Profil nepublicat"),el("p",own?(own.is_public?"Vizibil în comunitate":"Privat — nu apari la căutare"):"Publicarea este opțională."));
 if(own){
  self.append(el("p",own.followers+" urmăritori · "+own.following+" urmăriți · "+(own.kind==="barber"?"Profesionist verificat":"Client")));
  const share=el("a","✦ Vizualizează Profil →","socialButton socialViewProfile");share.href="./social.html?u="+encodeURIComponent(user.id);self.append(share);
 }
 const pro=await rpc("bc_social_is_barber",{p_user:user.id});
 barber.hidden=!pro;
 const ideasTab=$("socialClientIdeasTab");if(ideasTab)ideasTab.hidden=!!pro;
 if(pro){
  clientGallery.hidden=true;
  await loadBarberDetails(user.id,true);
  if(location.hash==="#ideas")openTab("profile");
 }else{
  clientGallery.hidden=false;
  await loadClientGallery(user.id,true);
 }
 await refreshGalleryStatus();
}
profileForm.onsubmit=async e=>{
 e.preventDefault();const b=profileForm.querySelector("button");b.disabled=true;
 try{
  await rpc("bc_social_profile_save",{p_handle:profileForm.elements.handle.value.trim(),
   p_name:profileForm.elements.name.value.trim(),p_bio:profileForm.elements.bio.value.trim(),
   p_public:profileForm.elements.public.checked,p_messages:profileForm.elements.messages.checked});
  line("Profilul a fost actualizat.");await loadMyProfile();await discover();window.dispatchEvent(new Event("bc-social-profile-updated"));
 }catch(e){if(e?.message==="THREE_VERIFIED_VISITS_FOR_PRIVACY")line("Pentru a face profilul privat ai nevoie de 3 tunsori finalizate și verificate.");else msgErr(e)}finally{b.disabled=false}
};
async function discover(){
 const list=$("socialDiscover");list.replaceChildren(el("p","Se caută membri…"));
 try{
  const records=await rpc("bc_social_discover",{p_search:$("socialSearch").value.trim()});list.replaceChildren();
  const online=await friendOnlineMap((records||[]).map(p=>p.user_id));
  if(!records?.length){list.append(el("p","Nu există încă profiluri publice pentru această căutare."));return}
  for(const item of records){
   const row=el("div",undefined,"socialPerson"),info=el("div");const username=el("strong",item.display_name);username.prepend(onlineDot(online.get(item.user_id)));info.append(username,el("small","@"+item.handle+" · "+(item.kind==="barber"?"Frizer":"Membru")+" · "+item.followers+" urmăritori"));
   row.append(info,btn("Vizualizează",()=>showPerson(item.user_id)));if(item.kind==="barber")row.append(await barberHeart(item.user_id));list.append(row);
  }
 }catch(e){list.replaceChildren(el("p","Căutarea nu este disponibilă momentan."));msgErr(e)}
}
let debounce;
$("socialSearch").oninput=()=>{clearTimeout(debounce);debounce=setTimeout(discover,300)};
async function showPerson(id){
 if(!uuid(id))return;
 try{
  const p=await rpc("bc_social_profile_read",{p_user:id});
  const box=$("socialSelected");box.replaceChildren();selected=p;
  if(!p){box.hidden=false;box.append(el("p","Profilul nu este public sau nu mai este disponibil."));return}
  box.hidden=false;
  box.closest("#panelDiscover")?.prepend(box);
  const hero=el("div",undefined,"socialProfileView"),identity=el("div",undefined,"socialSelectedRow"),
  avatar=el("div",p.display_name.slice(0,1).toUpperCase(),"socialAvatar"),info=el("div");
  info.append(el("h2",p.display_name),el("small","@"+p.handle+" · "+p.followers+" urmăritori · "+p.following+" urmăriți"));
  if(p.kind==="barber")info.append(el("span","✂ Frizer verificat","socialVerified"));
  else {
   try{
    const rank=await rpc("bc_social_client_rank",{p_user:p.user_id});
    if(rank)info.append(el("span","🏅 "+rank.rank+" · "+rank.visits+" tunsori verificate","socialVerified socialRankBadge"));
   }catch(_){}
  }
  identity.append(avatar,info);hero.append(identity);
  const topTools=el("div",null,"socialProfileCornerActions");
  if(p.is_me){topTools.append(btn("✎ Editează",()=>openTab("profile"),"socialEditCorner"))}
  else if(p.kind==="barber"){topTools.append(await barberHeart(p.user_id))}
  else{topTools.append(onlineDot((await friendOnlineMap([p.user_id])).get(p.user_id)))}
  hero.append(topTools);
  box.append(hero,el("p",p.bio||"Fără descriere publică."));
  const actions=el("div",undefined,"socialActions");
  if(user&&!p.is_me){
   const follow=btn(p.is_following?(p.follows_me?"✓ Prieteni · Renunță":"✓ Cerere trimisă · Renunță"):"＋ Adaugă la prieteni",async()=>{
    try{await rpc("bc_social_follow_set",{p_target:p.user_id,p_follow:!p.is_following});
     line(p.is_following?"Nu mai urmărești acest membru.":"Acum urmărești acest membru.");await showPerson(id);await discover()}
    catch(e){msgErr(e)}},p.is_following?"":"primary");
   actions.append(follow);
   if(p.message_allowed)actions.append(btn("✉ Mesaj",()=>startChat(p.user_id,p.display_name),"primary"));
   actions.append(btn("Blochează",async()=>{
    if(!confirm("Blochezi acest membru și închizi posibilitatea de a vă urmări sau scrie?"))return;
    try{await rpc("bc_social_block_set",{p_target:id,p_block:true});line("Membrul a fost blocat.");box.hidden=true;await discover()}catch(e){msgErr(e)}
   }));
   actions.append(btn("Raportează",async()=>{
    const reason=prompt("Descrie motivul raportării (10–350 caractere):");if(reason===null)return;
    try{await rpc("bc_social_report",{p_user:id,p_reason:reason.trim()});line("Raportarea a fost înregistrată.")}catch(e){msgErr(e)}
   }));
  }else if(p.is_me){/* Edit pencil lives next to avatar above. */}
  else actions.append(el("p","Autentifică-te pentru a urmări și a trimite mesaje."));
  box.append(actions);
  if(p.kind==="barber"){
   const title=el("h3","Barber Passport · Portofoliu");box.append(title);
   await loadBarberDetails(id,false,box);
  }else{
   box.append(el("h3","Galerie de tunsori · Client"));
   await loadClientGallery(id,false,box);
  }
  box.scrollIntoView({behavior:"smooth",block:"start"});
 }catch(e){msgErr(e)}
}
async function loadMutuals(){
 if(!user){$("socialMutuals").textContent="Autentifică-te pentru mesaje.";return}
 const box=$("socialMutuals");box.replaceChildren();
 try{mutuals=await rpc("bc_social_mutuals");
 if(!mutuals.length){box.append(el("p","Nu există încă persoane pe care le urmărești reciproc și care acceptă mesaje."));return}
 for(const person of mutuals){
  const row=el("div",undefined,"socialPerson"),label=el("div");
  label.append(el("strong",person.display_name),el("small","@"+person.handle));
  row.append(label,btn("Deschide chat",()=>startChat(person.user_id,person.display_name)));box.append(row);
 }
 }catch(e){msgErr(e)}
}
async function startChat(id,name){
 if(!user){line("Autentifică-te pentru mesaje.");return}
 if(chatTimer)clearInterval(chatTimer);
 chatWith=id;openTab("messages");
 chatTimer=setInterval(()=>{if(chatWith===id&&document.visibilityState==="visible")loadConversation()},12000);
 const panel=$("socialChat");panel.hidden=false;$("socialChatName").textContent="Mesaje cu "+name;
 await loadConversation();
 panel.scrollIntoView({behavior:"smooth",block:"start"});
}
async function loadConversation(){
 if(!chatWith)return;const box=$("socialChatMessages");box.replaceChildren();
 try{const msgs=await rpc("bc_social_conversation",{p_with:chatWith});
 if(!msgs.length)box.append(el("p","Încă nu aveți mesaje. Primul mesaj poate începe conversația."));
 for(const m of msgs){
  const bubble=el("div",m.body,"socialBubble"+(m.mine?" mine":""));
  bubble.append(el("small",new Date(m.at).toLocaleString("ro-RO")));
  box.append(bubble);
 }box.scrollTop=box.scrollHeight;
 }catch(e){msgErr(e)}
}
$("socialChatForm").onsubmit=async e=>{
 e.preventDefault();if(!chatWith)return;
 const form=e.currentTarget,txt=form.elements.message.value.trim(),b=form.querySelector("button");
 if(!txt)return;b.disabled=true;
 try{await rpc("bc_social_message_send",{p_to:chatWith,p_body:txt});form.reset();await loadConversation();line("Mesaj trimis privat.")}
 catch(e){msgErr(e)}finally{b.disabled=false}
};
$("socialChatClose").onclick=()=>{chatWith=null;if(chatTimer)clearInterval(chatTimer);chatTimer=null;$("socialChat").hidden=true};
function galleryStatusNote(id,message){
 const node=$(id);
 if(node)node.textContent=message;
}
function clientGalleryError(err){
 const code=String(err?.message||err||"");
 const messages={
  THREE_VERIFIED_VISITS_REQUIRED:"Ai nevoie de cel puțin 3 tunsori confirmate (QR + finalizarea serviciului).",
  QR_24H_WINDOW_EXPIRED:"Au trecut 24 de ore de la QR sau vizita nu a fost finalizată și confirmată.",
  PHOTO_ALREADY_POSTED_FOR_VISIT:"Ai publicat deja o fotografie pentru această vizită.",
  CLIENT_ONLY:"Pentru contul PRO folosește portofoliul profesionistului.",
  INVALID_IMAGE:"Fotografia nu a fost acceptată. Încearcă un fișier JPG, PNG sau WebP de până la 5 MB."
 };
 return messages[code]||code;
}
async function refreshGalleryStatus(){
 if(!user)return;
 const state=await rpc("bc_social_gallery_status");
 if(state.kind==="barber"){
  const used=Number(state.used_today)||0,limit=Number(state.daily_limit)||1;
  galleryStatusNote("socialProQuota",
   "Astăzi: "+used+"/"+limit+" fotografii publicate. Limita crește după 1 lună (2/zi), 5 luni (3/zi), 6 luni (4/zi) și 1 an (5/zi). Se resetează la miezul nopții, ora României.");
  const b=$("socialPortfolioForm")?.querySelector('button[type="submit"]');
  if(b)b.disabled=used>=limit;
  return;
 }
 const visits=Array.isArray(state.visits)?state.visits:[];
 const selector=$("socialClientGalleryVisit"),b=$("socialClientGalleryForm").querySelector('button[type="submit"]');
 selector.replaceChildren();
 for(const q of visits){
  const d=new Date(q.checked_at),expiry=new Date(q.expires_at);
  const value="Tunsoare confirmată "+d.toLocaleDateString("ro-RO")+" · mai poți posta până la "+expiry.toLocaleTimeString("ro-RO",{hour:"2-digit",minute:"2-digit"});
  selector.append(new Option(value,q.checkin_id));
 }
 const visitsDone=Number(state.completed_visits)||0;
 const ranks=[["Bronz I",3],["Bronz II",6],["Argint I",12],["Argint II",20],["Aur I",30],["Aur II",45],["Platină",65],["Diamant",100]];
 const goal=ranks.find(x=>visitsDone<x[1]);
 const rankText=goal?Math.min(visitsDone,goal[1])+"/"+goal[1]+" tunsori pentru "+goal[0]:"Diamant · rang maxim";
 const rankBadge=$("socialClientRankProgress");if(rankBadge)rankBadge.textContent="✂ "+rankText;
 let message;
 if(visitsDone<3){
  message=visitsDone+"/3 tunsori finalizate și confirmate. Mai ai nevoie de "+(3-visitsDone)+" pentru a putea posta.";
 }else if(!visits.length){
  message="Ai "+visitsDone+" tunsori confirmate. Nu ai acum o vizită eligibilă: cere verificarea QR la frizer, confirmarea finalizării serviciului și postează în 24 de ore.";
 }else{
  message="Ai "+visitsDone+" tunsori confirmate și "+visits.length+" vizită/vizite eligibile. Poți urca o singură fotografie pentru fiecare QR, înainte de expirare.";
 }
 galleryStatusNote("socialClientQuota",message);
 selector.disabled=!visits.length;
 b.disabled=!visits.length;
}
async function loadClientGallery(id,mine,target){
 const gallery=mine?$("socialClientGalleryPhotos"):el("div",undefined,"socialPortfolio");
 gallery.replaceChildren();
 if(!mine)target.append(gallery);
 const photos=await rpc("bc_social_client_gallery_list",{p_user:id});
 if(!photos?.length){gallery.append(el("p","Nu există fotografii publicate în această galerie."));return}
 for(const photo of photos){
  const card=el("div",undefined,"socialPortfolioItem"),img=el("img");
  img.loading="lazy";img.alt=photo.caption||"Tunsoare din galeria clientului";
  img.src=sb.storage.from("bc-client-social-gallery").getPublicUrl(photo.path).data.publicUrl;
  const caption=el("p",photo.caption||"Tunsoare publicată");
  card.append(img,caption);
  if(window.BCSalonMentions)void window.BCSalonMentions.load().then(()=>window.BCSalonMentions.render(caption,photo.caption||"Tunsoare publicată"));
  if(mine)card.append(btn("Șterge",async()=>{
   if(!confirm("Ștergi fotografia? Nu vei putea publica din nou pentru același QR."))return;
   try{
    const path=await rpc("bc_social_client_gallery_delete",{p_id:photo.id});
    if(path){
     const {error:removeErr}=await sb.storage.from("bc-client-social-gallery").remove([path]);
     if(removeErr)throw removeErr;
    }
    await loadClientGallery(user.id,true);
    await refreshGalleryStatus();
    galleryStatusNote("socialClientGalleryStatus","Fotografia a fost eliminată. Dreptul de postare pentru acel QR rămâne consumat.");
   }catch(e){galleryStatusNote("socialClientGalleryStatus","Nu am putut șterge fotografia: "+clientGalleryError(e))}
  }));
  gallery.append(card);
 }
}
$("socialClientGalleryForm").onsubmit=async e=>{
 e.preventDefault();
 const form=e.currentTarget,button=form.querySelector('button[type="submit"]');
 const file=form.elements.namedItem("photo")?.files?.[0];
 const types={"image/jpeg":"jpg","image/png":"png","image/webp":"webp"};
 if(!file||file.size>5*1024*1024||!types[file.type]){
  galleryStatusNote("socialClientGalleryStatus","Alege o fotografie JPG, PNG sau WebP de maximum 5 MB.");return;
 }
 const checkin=form.elements.namedItem("visit")?.value;
 if(!checkin){galleryStatusNote("socialClientGalleryStatus","Nu există un QR eligibil pentru publicare.");return}
 if(!confirm("Fotografia va avea un link public. Ai acordul persoanelor din imagine pentru publicare?"))return;
 button.disabled=true;
 const oldLabel=button.textContent;
 button.textContent="Se publică…";
 galleryStatusNote("socialClientGalleryStatus","Se încarcă fotografia...");
 const path=user.id+"/"+crypto.randomUUID()+"."+types[file.type];
 try{
  const {error}=await sb.storage.from("bc-client-social-gallery")
   .upload(path,file,{contentType:file.type,upsert:false});
  if(error)throw error;
  try{
   await rpc("bc_social_client_gallery_add",{
    p_path:path,p_caption:form.elements.namedItem("caption").value.trim(),p_checkin:checkin});
  }catch(err){
   await sb.storage.from("bc-client-social-gallery").remove([path]);
   throw err;
  }
  form.reset();
  try{
   await loadClientGallery(user.id,true);
   await refreshGalleryStatus();
   galleryStatusNote("socialClientGalleryStatus","Fotografia a fost postată! QR-ul folosit nu mai permite o a doua fotografie.");
  }catch(refreshErr){
   galleryStatusNote("socialClientGalleryStatus","Fotografia a fost publicată, dar galeria nu s-a actualizat. Reîncarcă pagina.");
  }
 }catch(err){
  galleryStatusNote("socialClientGalleryStatus","Publicarea a eșuat: "+clientGalleryError(err));
  await refreshGalleryStatus().catch(()=>{});
 }finally{
  button.textContent=oldLabel;
 }
};

async function loadBarberDetails(id,mine,target){
 const info=await rpc("bc_social_barber_details",{p_user:id});
 if(!info)return;
 const jobs=mine?$("socialMyJobs"):el("div"),photos=mine?$("socialMyPortfolio"):el("div",undefined,"socialPortfolio");
 jobs.replaceChildren();photos.replaceChildren();
 if(!mine)target.append(el("h3","Experiență declarată")); 
 if(!info.jobs?.length)jobs.append(el("p","Istoric profesional necompletat."));
 for(const job of info.jobs||[]){
  const row=el("div",undefined,"socialIdea"),desc=el("div");
  desc.append(el("strong",job.title+" · "+job.salon),el("small",job.start+" – "+(job.end||"prezent")+" · Istoric declarat, neverificat"));
  row.append(desc);
  if(mine)row.append(btn("Șterge",async()=>{if(!confirm("Ștergi această experiență?"))return;
   try{await rpc("bc_social_barber_job_delete",{p_id:job.id});await loadBarberDetails(id,true)}catch(e){msgErr(e)}}));
  jobs.append(row);
 }
 if(!mine){target.append(jobs,el("h3","Tunsori din portofoliu"));target.append(photos)}
 if(!info.portfolio?.length)photos.append(el("p","Nu există încă fotografii publicate."));
 for(const photo of info.portfolio||[]){
  const card=el("div",undefined,"socialPortfolioItem"),img=el("img");
  img.loading="lazy";img.alt=photo.caption||"Tunsoare din portofoliul frizerului";
  const {data}=sb.storage.from("bc-barber-portfolio").getPublicUrl(photo.path);
  img.src=data.publicUrl;card.append(img,el("p",photo.caption));
  if(mine)card.append(btn("Șterge",async()=>{
   if(!confirm("Ștergi definitiv fotografia publică?"))return;
   try{const path=await rpc("bc_social_barber_portfolio_delete",{p_id:photo.id});
    if(path){const {error:removeError}=await sb.storage.from("bc-barber-portfolio").remove([path]);if(removeError)throw removeError}
    await loadBarberDetails(id,true);
    await refreshGalleryStatus();
   }catch(e){msgErr(e)}
  }));photos.append(card);
 }
}
$("socialJobForm").onsubmit=async e=>{
 e.preventDefault();const f=e.currentTarget,b=f.querySelector("button");b.disabled=true;
 try{await rpc("bc_social_barber_job_add",{p_name:f.elements.salon.value.trim(),p_title:f.elements.title.value.trim(),
 p_start:Number(f.elements.start.value),p_end:f.elements.end.value?Number(f.elements.end.value):null});
 f.reset();await loadBarberDetails(user.id,true);line("Experiență declarată salvată.")}
 catch(e){msgErr(e)}finally{b.disabled=false}
};
function portfolioNotice(message,isError=false){
 const note=$("socialPortfolioStatus");
 if(note){note.textContent=message;note.dataset.error=isError?"true":"false"}
 line(message);
}
$("socialPortfolioForm").onsubmit=async e=>{
 e.preventDefault();
 const f=e.currentTarget,b=f.querySelector("button"),file=f.elements.namedItem("photo")?.files?.[0];
 const types={"image/jpeg":"jpg","image/png":"png","image/webp":"webp"};
 if(!file||file.size>5*1024*1024||!types[file.type]){
  portfolioNotice("Alege o fotografie JPG, PNG sau WebP de maximum 5 MB.",true);return;
 }
 if(!user){portfolioNotice("Conectează-te în contul PRO pentru a publica fotografii.",true);return}
 if(!confirm("Fotografia va avea un link public chiar dacă profilul tău este privat. Confirmi că ai acordul persoanelor fotografiate?"))return;
 b.disabled=true;
 const oldLabel=b.textContent;
 b.textContent="Se publică…";
 portfolioNotice("Se încarcă fotografia…");
 const path=user.id+"/"+crypto.randomUUID()+"."+types[file.type];
 try{
  const {error:uploadErr}=await sb.storage.from("bc-barber-portfolio").upload(path,file,{contentType:file.type,upsert:false});
  if(uploadErr)throw uploadErr;
  try{await rpc("bc_social_barber_portfolio_add",{p_path:path,p_caption:f.elements.caption.value.trim()})}
  catch(err){await sb.storage.from("bc-barber-portfolio").remove([path]);throw err}
  f.reset();
  try{
   await loadBarberDetails(user.id,true);
   await refreshGalleryStatus();
   portfolioNotice("Fotografia a fost încărcată. În comunitate apare după publicarea profilului social; fișierul are un link public.");
  }catch(err){
   portfolioNotice("Fotografia a fost publicată, dar galeria nu s-a reîmprospătat. Reîncarcă pagina.",true);
  }
 }catch(err){
  const reason=String(err?.message||err||"");
  portfolioNotice(reason.includes("DAILY_PORTFOLIO_LIMIT")
   ?"Ai atins limita de fotografii pentru astăzi. Revino mâine.":"Nu am putut încărca fotografia: "+reason,true);
  await refreshGalleryStatus().catch(()=>{});
 }finally{b.disabled=false;b.textContent=oldLabel}
};
async function loadIdeas(){
 if(!user)return;
 try{
 const eligible=await rpc("bc_my_idea_eligibility"),root=$("socialEligibility"),sel=$("socialIdeaSalon");
 root.replaceChildren();sel.replaceChildren();
 if(!eligible.length)root.append(el("p","Nu ai vizite finalizate cu verificare dublă. Check-in-ul singur nu deblochează propunerile."));
 for(const s of eligible){
  const row=el("div",undefined,"socialIdeaStat"),info=el("div");
  info.append(el("strong",s.salon),el("small",s.visits+" vizite verificate · "+(s.eligible?"Poți propune idei":"Ai nevoie de încă "+(5-s.visits))));
  row.append(info);root.append(row);
  if(s.eligible)sel.append(new Option(s.salon,s.salon_id));
 }
 $("socialIdeaForm").hidden=!sel.options.length;
 if(eligible.some(x=>x.eligible))await listIdeas(sel.value,$("socialMyIdeas"),false);
 if(staff.length){
  const pro=$("socialProIdeas"),proSel=$("socialProIdeaSalon");pro.hidden=false;
  proSel.replaceChildren();for(const sh of staff)proSel.append(new Option(sh.salon_name,sh.salon_id));
  await listIdeas(proSel.value,$("socialProIdeasList"),true);
 }
 }catch(e){msgErr(e)}
}
async function listIdeas(salon,box,asPro){
 box.replaceChildren();if(!salon)return;
 try{const items=await rpc("bc_salon_ideas_list",{p_salon:salon});
 if(!items.length){box.append(el("p","Nicio propunere înregistrată."));return}
 for(const item of items){
  const row=el("div",undefined,"socialIdea");
  row.append(el("strong",item.title),el("small",item.status+" · "+new Date(item.at).toLocaleDateString("ro-RO")),el("p",item.detail));
  if(asPro&&staff.some(x=>x.salon_id===salon&&["owner","manager"].includes(x.member_role))){
   const sel=el("select");sel.className="socialField";
   for(const value of ["proposed","considering","planned","done","declined"])sel.append(new Option(value,value));
   sel.value=item.status;sel.onchange=async()=>{try{await rpc("bc_salon_idea_status",{p_idea:item.id,p_status:sel.value});
    line("Starea propunerii a fost actualizată.");await listIdeas(salon,box,true)}catch(e){msgErr(e)}};
   row.append(sel);
  }box.append(row);
 }
 }catch(e){msgErr(e)}
}
$("socialIdeaSalon").onchange=()=>listIdeas($("socialIdeaSalon").value,$("socialMyIdeas"),false);
$("socialProIdeaSalon").onchange=()=>listIdeas($("socialProIdeaSalon").value,$("socialProIdeasList"),true);
$("socialIdeaForm").onsubmit=async e=>{
 e.preventDefault();const f=e.currentTarget,b=f.querySelector("button");b.disabled=true;
 try{await rpc("bc_salon_idea_submit",{p_salon:f.elements.salon.value,
 p_title:f.elements.title.value.trim(),p_detail:f.elements.detail.value.trim()});
 f.elements.title.value="";f.elements.detail.value="";
 await listIdeas(f.elements.salon.value,$("socialMyIdeas"),false);
 line("Propunerea a ajuns în inboxul salonului.");}
 catch(e){msgErr(e)}finally{b.disabled=false}
};
window.addEventListener("pagehide",()=>{if(chatTimer)clearInterval(chatTimer)});
async function init(){
 if(!user){
  line("Poți descoperi profilurile publice. Pentru follow, mesaje și postări este necesar un cont.");
  $("socialProfileForm").hidden=true;openTab("discover");await discover();return;
 }
 me=user.id;
 try{
  const {data:membership}=await sb.rpc("bc_my_professional_access");
  staff=membership||[];
  await loadMyProfile();
  await startPresence();
  await discover();
  const search=new URLSearchParams(location.search),id=search.get("u");
  if(uuid(id))await showPerson(id);
  const dest=(location.hash||"").replace("#","");
  if(["profile","messages","discover"].includes(dest))openTab(dest);
  line("Comunitatea este disponibilă. Datele tale private rămân separate de profilul social.");
 }catch(e){msgErr(e)}
}
init();
})();