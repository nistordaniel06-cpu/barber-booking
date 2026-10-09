/* BARBERCRAFT Social: client/barber profiles, mutual follows, safe text chat,
   haircut polls, verified visits/reviews and feedback from 5-visit customers. */
(async()=>{"use strict";
const $=id=>document.getElementById(id);
const el=(tag,txt,cls)=>{const n=document.createElement(tag);if(txt!==undefined)n.textContent=String(txt);if(cls)n.className=cls;return n};
const btn=(label,fn,cls="")=>{const b=el("button",label,"socialButton "+cls);b.type="button";b.onclick=fn;return b};
const line=(msg)=>$("socialStatus").textContent=String(msg);
const rpc=async(name,args={})=>{const {data,error}=await sb.rpc(name,args);if(error)throw new Error(error.message);return data};
const api=window.supabase;
if(!api||!window.BARBERCRAFT_SUPABASE_URL){line("Comunitatea nu este disponibilă.");return}
const sb=await window.BCPassportSession();
const {data:{user},error}=await sb.auth.getUser();
const profileForm=$("socialProfileForm"),self=$("socialMyProfile"),barber=$("socialBarber");
let me=null,own=null,selected=null,chatWith=null,staff=[],mutuals=[],chatTimer=null;
const uuid=x=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x||"");
function openTab(name){
 document.querySelectorAll(".socialPanel").forEach(x=>x.hidden=x.id!=="panel"+name[0].toUpperCase()+name.slice(1));
 document.querySelectorAll(".socialTabs button").forEach(x=>x.classList.toggle("selected",x.dataset.panel===name));
 if(name==="messages")loadMutuals();
 if(name==="ideas")loadIdeas();
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
 }
 self.replaceChildren();
 self.append(el("strong",own?"@"+own.handle:"Profil nepublicat"),el("p",own?(own.is_public?"Vizibil în comunitate":"Privat — nu apari la căutare"):"Publicarea este opțională."));
 if(own){
  self.append(el("p",own.followers+" urmăritori · "+own.following+" urmăriți · "+(own.kind==="barber"?"Profesionist verificat":"Client")));
  const share=el("a","Deschide profilul public →","socialButton");share.href="./social.html?u="+encodeURIComponent(user.id);self.append(share);
 }
 const pro=await rpc("bc_social_is_barber",{p_user:user.id});
 barber.hidden=!pro;
 const ideasTab=$("socialClientIdeasTab");if(ideasTab)ideasTab.hidden=!!pro;
 if(pro){await loadBarberDetails(user.id,true);
  if(location.hash==="#ideas")openTab("profile");
 }
}
profileForm.onsubmit=async e=>{
 e.preventDefault();const b=profileForm.querySelector("button");b.disabled=true;
 try{
  await rpc("bc_social_profile_save",{p_handle:profileForm.elements.handle.value.trim(),
   p_name:profileForm.elements.name.value.trim(),p_bio:profileForm.elements.bio.value.trim(),
   p_public:profileForm.elements.public.checked,p_messages:profileForm.elements.messages.checked});
  line("Profilul a fost actualizat.");await loadMyProfile();await discover();window.dispatchEvent(new Event("bc-social-profile-updated"));
 }catch(e){msgErr(e)}finally{b.disabled=false}
};
async function discover(){
 const list=$("socialDiscover");list.replaceChildren(el("p","Se caută membri…"));
 try{
  const records=await rpc("bc_social_discover",{p_search:$("socialSearch").value.trim()});list.replaceChildren();
  if(!records?.length){list.append(el("p","Nu există încă profiluri publice pentru această căutare."));return}
  for(const item of records){
   const row=el("div",undefined,"socialPerson"),info=el("div");info.append(el("strong",item.display_name),el("small","@"+item.handle+" · "+(item.kind==="barber"?"Frizer":"Membru")+" · "+item.followers+" urmăritori"));
   row.append(info,btn("Vezi profilul",()=>showPerson(item.user_id)));list.append(row);
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
  const hero=el("div",undefined,"socialProfileView"),identity=el("div",undefined,"socialSelectedRow"),
  avatar=el("div",p.display_name.slice(0,1).toUpperCase(),"socialAvatar"),info=el("div");
  info.append(el("h2",p.display_name),el("small","@"+p.handle+" · "+p.followers+" urmăritori · "+p.following+" urmăriți"));
  if(p.kind==="barber")info.append(el("span","✂ Frizer verificat","socialVerified"));
  identity.append(avatar,info);hero.append(identity);box.append(hero,el("p",p.bio||"Fără descriere publică."));
  const actions=el("div",undefined,"socialActions");
  if(user&&!p.is_me){
   const follow=btn(p.is_following?"✓ Urmărești · Renunță":"＋ Urmărește",async()=>{
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
  }else if(p.is_me)actions.append(btn("Editează profilul",()=>openTab("profile"),"primary"));
  else actions.append(el("p","Autentifică-te pentru a urmări și a trimite mesaje."));
  box.append(actions);
  if(p.kind==="barber"){
   const title=el("h3","Barber Passport · Portofoliu");box.append(title);
   await loadBarberDetails(id,false,box);
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
async function loadBarberDetails(id,mine,target){
 const info=await rpc("bc_social_barber_details",{p_user:id});
 if(!info)return;
 const jobs=mine?$("socialMyJobs"):el("div"),photos=mine?$("socialMyPortfolio"):el("div",undefined,"socialPortfolio");
 jobs.replaceChildren();photos.replaceChildren();
 if(!mine)target.append(el("h3","Experiență declarată")); 
 if(!info.jobs?.length)jobs.append(el("p","Istoric profesional necompletat."));
 for(const job of info.jobs||[]){
  const row=el("div",undefined,"socialIdea"),desc=el("div");
  desc.append(el("strong",job.role_title+" · "+job.salon),el("small",job.start+" – "+(job.end||"prezent")+" · Istoric declarat, neverificat"));
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
$("socialPortfolioForm").onsubmit=async e=>{
 e.preventDefault();const f=e.currentTarget,b=f.querySelector("button"),file=f.elements.photo.files?.[0];
 if(!file||file.size>5*1024*1024||!["image/jpeg","image/png","image/webp"].includes(file.type)){
 line("Alege o fotografie JPG, PNG sau WebP de maximum 5 MB.");return}
 if(!confirm("Fotografia va fi publică. Confirmi că ai acordul persoanelor fotografiate?"))return;
 b.disabled=true;
 const ext={"image/jpeg":"jpg","image/png":"png","image/webp":"webp"}[file.type];
 const path=user.id+"/"+crypto.randomUUID()+"."+ext;
 try{
  const {error:uploadErr}=await sb.storage.from("bc-barber-portfolio").upload(path,file,{contentType:file.type,upsert:false});
  if(uploadErr)throw uploadErr;
  try{await rpc("bc_social_barber_portfolio_add",{p_path:path,p_caption:f.elements.caption.value.trim()})}
  catch(err){await sb.storage.from("bc-barber-portfolio").remove([path]);throw err}
  f.reset();await loadBarberDetails(user.id,true);line("Tunsoarea a fost adăugată public în portofoliul tău.");
 }catch(e){msgErr(e)}finally{b.disabled=false}
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
  await discover();
  const search=new URLSearchParams(location.search),id=search.get("u");
  if(uuid(id))await showPerson(id);
  const dest=(location.hash||"").replace("#","");
  if(["profile","messages","ideas","discover"].includes(dest))openTab(dest==="ideas"&&barber.hidden===false?"profile":dest);
  line("Comunitatea este disponibilă. Datele tale private rămân separate de profilul social.");
 }catch(e){msgErr(e)}
}
init();
})();