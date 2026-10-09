(async()=>{"use strict";
const $=id=>document.getElementById(id),root=$("socialFeed"),form=$("socialPostForm");
if(!root||!form||!window.BCPassportSession)return;
const node=(t,txt,cls)=>{const e=document.createElement(t);if(txt!==undefined)e.textContent=String(txt);if(cls)e.className=cls;return e};
const sb=await window.BCPassportSession(),{data:{user}}=await sb.auth.getUser();
const rpc=async(fn,args={})=>{const {data,error}=await sb.rpc(fn,args);if(error)throw Error(error.message);return data};
const feedback=s=>$("socialStatus").textContent=s;
const composer=$("socialFeedComposer"),more=$("socialFeedMore");
let cursor=null,loading=false,hasMore=true,clientCooldown=null;
const composerButton=form.querySelector('button[type="submit"]');
async function refreshClientCooldown(){
 if(!user)return;
 try{
  const state=await rpc("bc_social_post_cooldown");
  clientCooldown=state;
  const hint=$("socialFeedCooldown");
  if(state.pro){if(hint)hint.textContent="PRO · maximum 5 postări pe oră.";return;}
  const seconds=Number(state.wait_seconds)||0;
  if(hint)hint.textContent=state.allowed
    ?"Poți publica acum · "+state.used_today+"/6 postări în ultimele 24 de ore. Următoarea postare va putea fi publicată după 15 minute."
    :"Pauză anti-spam: "+(seconds?Math.max(1,Math.ceil(seconds/60))+" min până la următoarea postare. ":"")+"Maximum 6 postări în 24 de ore.";
  if(composerButton)composerButton.disabled=!state.allowed;
 }catch(error){
  if(composerButton)composerButton.disabled=true;
  const hint=$("socialFeedCooldown");
  if(hint)hint.textContent="Limita postărilor nu poate fi verificată momentan. Încearcă din nou.";
 }
}
async function visibility(){
 if(!user){composer.hidden=true;return}
 try{const p=await rpc("bc_social_profile_read",{p_user:user.id});composer.hidden=!p?.is_public;if(!composer.hidden)await refreshClientCooldown()}
 catch{composer.hidden=true}
}
function action(text,fn){const b=node("button",text,"socialButton");b.type="button";b.onclick=fn;return b}
function card(p){
 const art=node("article",undefined,"socialPost"),head=node("div",undefined,"socialPostTop");
 const author=node("a",p.author,"socialPostAuthor"),link=new URL("./social.html",location.href);
 link.searchParams.set("u",p.author_id);
 if(new URLSearchParams(location.search).get("from")==="pro")link.searchParams.set("from","pro");
 author.href=link.pathname+link.search;
 const meta=node("small","@"+p.handle+" · "+(p.kind==="barber"?"Frizer":"Client")+" · "+new Date(p.created_at).toLocaleString("ro-RO"));
 const info=node("div");info.append(author,meta);head.append(info);
 if(user&&p.author_id!==user.id){
  const follow=action(p.followed?"✓ Urmărești":"＋ Urmărește",async()=>{
   follow.disabled=true;
   try{await rpc("bc_social_follow_set",{p_target:p.author_id,p_follow:!p.followed});
    p.followed=!p.followed;follow.textContent=p.followed?"✓ Urmărești":"＋ Urmărește"}
   catch(e){feedback("Follow indisponibil: "+e.message)}
   finally{follow.disabled=false}
  });head.append(follow);
 }
 art.append(head,node("p",p.body,"socialPostBody"));
 if(typeof p.media_path==="string"&&p.media_path.startsWith(p.author_id+"/")&&
 /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/.test(p.media_path)){
  const img=node("img");img.className="socialPostImage";img.loading="lazy";
  img.alt="Fotografie publicată de "+p.author;
  img.src=sb.storage.from("bc-social-feed").getPublicUrl(p.media_path).data.publicUrl;
  art.append(img);
 }
 const foot=node("div",undefined,"socialPostFooter");
 foot.append(node("small","Postare publică · Toată comunitatea"));
 if(user&&p.mine)foot.append(action("Șterge",async()=>{
  if(!confirm("Ștergi această postare?"))return;
  try{const path=await rpc("bc_social_post_delete",{p_post:p.id});
   if(path){const {error}=await sb.storage.from("bc-social-feed").remove([path]);
    if(error)feedback("Postarea a fost eliminată, dar fișierul necesită ștergere manuală.")}
   art.remove();
  }catch(e){feedback(e.message)}
 }));
 else if(user)foot.append(action("Raportează",async()=>{
  const reason=prompt("Motivul raportării (10–350 caractere):");if(reason===null)return;
  try{await rpc("bc_social_post_report",{p_post:p.id,p_reason:reason.trim()});feedback("Raportare înregistrată.")}
  catch(e){feedback(e.message)}
 }));
 art.append(foot);return art;
}
async function feed(reset=false){
 if(loading)return;loading=true;more.disabled=true;
 if(reset){cursor=null;root.replaceChildren(node("p","Se încarcă…"))}
 try{const items=await rpc("bc_social_feed",{p_before:cursor,p_limit:15});
  if(reset)root.replaceChildren();
  for(const item of items||[])root.append(card(item));
  if(reset&&!items?.length)root.append(node("p","Încă nu există postări. Poți fi primul care publică!","socialFeedEmpty"));
  hasMore=items?.length===15;more.hidden=!hasMore;
  if(items?.length)cursor=items.at(-1).created_at;
 }catch(e){feedback("Feed indisponibil: "+e.message)}
 finally{loading=false;more.disabled=false}
}
form.onsubmit=async e=>{
 e.preventDefault();const b=form.querySelector("button"),file=form.elements.photo.files?.[0],
 body=form.elements.body.value.trim();let path=null;
 if(body.length<3){feedback("Scrie minimum 3 caractere.");return}
 if(clientCooldown&&!clientCooldown.pro&&!clientCooldown.allowed){
  feedback("Ai publicat recent. Așteaptă pauza anti-spam afișată deasupra formularului.");
  await refreshClientCooldown();return;
 }
 if(file&&(!["image/jpeg","image/png","image/webp"].includes(file.type)||file.size>5242880)){
  feedback("Fotografia trebuie să fie JPG, PNG sau WebP, maximum 5 MB.");return}
 if(file&&!confirm("Confirmi că fotografia este publică și ai acordul persoanelor din imagine?"))return;
 b.disabled=true;
 try{
  if(file){const ext={"image/jpeg":"jpg","image/png":"png","image/webp":"webp"}[file.type];
   path=user.id+"/"+crypto.randomUUID()+"."+ext;
   const {error}=await sb.storage.from("bc-social-feed").upload(path,file,{contentType:file.type,upsert:false});
   if(error)throw error;
  }
  try{await rpc("bc_social_post_create",{p_body:body,p_path:path})}
  catch(e){if(path)await sb.storage.from("bc-social-feed").remove([path]);throw e}
  form.reset();feedback("Postare publicată pentru întreaga comunitate.");await feed(true);await refreshClientCooldown();
 }catch(e){
  const msg=String(e.message||e);
  feedback(msg.includes("CLIENT_POST_COOLDOWN")?"Mai ai de așteptat 15 minute între postări.":msg.includes("CLIENT_DAILY_POST_LIMIT")?"Ai atins limita de 6 postări în 24 de ore.":"Eroare la publicare: "+msg);
  await refreshClientCooldown();
 }
 finally{b.disabled=!!(clientCooldown&&!clientCooldown.pro&&!clientCooldown.allowed)}
};
$("socialFeedRefresh").onclick=async()=>{await feed(true);await refreshClientCooldown()};
more.onclick=()=>feed(false);
window.addEventListener("bc-social-profile-updated",visibility);
await Promise.all([visibility(),feed(true)]);
})();