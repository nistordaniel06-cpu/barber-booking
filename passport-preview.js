(async()=>{"use strict";
const $=id=>document.getElementById(id),el=(tag,text,klass)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=String(text);if(klass)n.className=klass;return n};
if(!window.supabase||!window.BARBERCRAFT_SUPABASE_URL){$("profileStatus").textContent="Conexiunea la cont este indisponibilă.";return}
const sb=await window.BCPassportSession();
const {data:{user},error:authError}=await sb.auth.getUser();
if(authError||!user){$("profileStatus").replaceChildren(el("span","Profilul este privat. "),Object.assign(el("a","Autentifică-te →"),{href:new URLSearchParams(location.search).get("from")==="pro"?"./professionals.html":"./#account"}));return}
$("previewPublicProfile").href="./social.html?u="+encodeURIComponent(user.id)+(new URLSearchParams(location.search).get("from")==="pro"?"&from=pro":"");
const fmt=n=>new Intl.NumberFormat("ro-RO").format(Number(n)||0);
const results=await Promise.all([
 sb.from("bc_profiles").select("display_name").eq("user_id",user.id).maybeSingle(),
 sb.rpc("bc_client_rewards_summary"),
 sb.rpc("bc_reward_wallet"),
 sb.rpc("bc_passport_verified_visits"),
 sb.from("bc_passport_photos").select("object_path,caption,created_at").eq("user_id",user.id).order("created_at",{ascending:false}).limit(60),
 sb.from("bc_passport_notes").select("salon_name,rating,note,created_at").eq("user_id",user.id).order("created_at",{ascending:false}).limit(40)
]);
const [profile,summary,wallet,history,photos,notes]=results;
const name=profile.data?.display_name||user.email?.split("@")[0]||"Client BARBERCRAFT";
$("profileName").textContent=name;$("profileAvatar").textContent=name.trim().slice(0,1).toUpperCase();
$("profileHandle").textContent="@"+name.toLocaleLowerCase("ro-RO").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,"").slice(0,32);
const xp=Number(summary.data?.xp)||0;
const rankInfo=window.BCVisitRank?.rank(history.data?.total_visits||0);
$("profileRank").textContent=rankInfo?rankInfo.current.badge+" "+rankInfo.current.name:"Membru";
$("profileXp").textContent=summary.error?"—":fmt(xp);
$("profilePoints").textContent=wallet.error?"—":fmt(wallet.data?.available);
$("profileVisits").textContent=history.error?"—":fmt(history.data?.total_visits);
const gallery=$("profilePhotos"),journal=$("profileNotes"),visits=$("profileHistory");
gallery.replaceChildren();journal.replaceChildren();visits.replaceChildren();
if(photos.error)gallery.append(el("p","Fotografiile nu s-au încărcat: "+photos.error.message,"bc-gallery-empty"));
else if(!photos.data?.length)gallery.append(el("p","Nu ai fotografii încă. Folosește „Adaugă o poză” pentru a începe galeria ta.","bc-gallery-empty"));
else for(const photo of photos.data){
 const {data:signed,error}=await sb.storage.from("bc-passport").createSignedUrl(photo.object_path,120);
 if(error||!signed?.signedUrl)continue;
 const btn=el("button",undefined,"bc-gallery-photo");btn.type="button";btn.setAttribute("aria-label","Deschide fotografia "+(photo.caption||"din galerie"));
 const img=el("img");img.loading="lazy";img.src=signed.signedUrl;img.alt=photo.caption||"Fotografie privată din Barber Passport";
 btn.append(img);btn.onclick=()=>{const box=$("profileLightbox");$("lightboxImage").src=signed.signedUrl;$("lightboxNewTab").href=signed.signedUrl;$("lightboxText").textContent=photo.caption||"Din galeria mea";box.hidden=false;$("lightboxClose").focus()};
 gallery.append(btn);
}
$("lightboxClose").onclick=()=>$("profileLightbox").hidden=true;
$("profileLightbox").onclick=e=>{if(e.target===$("profileLightbox"))$("profileLightbox").hidden=true};
document.addEventListener("keydown",e=>{if(e.key==="Escape")$("profileLightbox").hidden=true});
if(notes.error)journal.append(el("p","Jurnalul nu poate fi încărcat: "+notes.error.message));
else if(!notes.data?.length)journal.append(el("p","Nu ai încă recenzii sau notițe private. Poți scrie despre vizitele tale din Barber Passport.","muted"));
else for(const note of notes.data){const card=el("article",undefined,"bc-profile-note");
card.append(el("strong",note.salon_name+" · "+"★".repeat(note.rating)),el("p",note.note||"Fără notiță"),el("small",new Date(note.created_at).toLocaleDateString("ro-RO")));
journal.append(card);}
if(history.error)visits.append(el("p","Vizitele nu pot fi încărcate: "+history.error.message,"muted"));
else if(!history.data?.recent?.length)visits.append(el("p","Deocamdată nu ai vizite finalizate și validate în sistem.","muted"));
else for(const v of history.data.recent){const row=el("div",undefined,"item");
row.append(el("span",new Date(v.date).toLocaleDateString("ro-RO")),el("strong","+"+fmt(v.xp)+" XP · +"+fmt(v.points)+" pct"));
visits.append(row);}
$("profileStatus").textContent=[profile.error,summary.error,wallet.error,history.error,photos.error,notes.error].some(Boolean)?"Unele informații nu sunt disponibile momentan. Reîncarcă pagina pentru a încerca din nou.":"Profilul tău privat este actualizat.";
})();
