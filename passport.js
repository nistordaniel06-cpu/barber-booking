(async function(){"use strict";
const $=id=>document.getElementById(id),status=$("status");
const el=(tag,txt,cls)=>{const x=document.createElement(tag);if(txt!==undefined)x.textContent=String(txt);if(cls)x.className=cls;return x};
if(!window.supabase||!window.BARBERCRAFT_SUPABASE_URL){status.textContent="Serviciul de autentificare nu este disponibil.";return}
const sb=await window.BCPassportSession();
const {data:{user},error:userError}=await sb.auth.getUser();
if(userError||!user){status.replaceChildren(document.createTextNode("Autentifică-te pentru a vedea pașaportul. "),Object.assign(el("a","Intră în cont →"),{href:new URLSearchParams(location.search).get("from")==="pro"?"./professionals.html":"./#account"}));return}
$("signedIn").hidden=false;status.textContent="Informațiile din pașaport sunt private și sincronizate între dispozitive.";
const fmt=n=>new Intl.NumberFormat("ro-RO").format(Number(n)||0);
try{
 const [{data:profile},{data:rewards,error:rewardsError},{data:summary,error:summaryError},{data:history,error:historyError}]=await Promise.all([
 sb.from("bc_profiles").select("display_name").eq("user_id",user.id).maybeSingle(),
 sb.from("bc_reward_templates").select("title,description,points_cost,category,stock").eq("is_active",true).order("points_cost").limit(25),
 sb.rpc("bc_client_rewards_summary"),sb.rpc("bc_passport_verified_visits")]);
 const name=profile?.display_name||user.email?.split("@")[0]||"Client";$("name").textContent=name;$("avatar").textContent=name.trim().charAt(0).toUpperCase();
 if(summaryError)throw summaryError;
 const xp=Number(summary?.xp)||0,points=Number(summary?.loyalty_points)||0;
 const ranks=[["Bronze",0],["Silver",500],["Gold",1500],["Platinum",3500],["Legend",7000]];
 const current=[...ranks].reverse().find(x=>xp>=x[1])||ranks[0];const next=ranks.find(x=>x[1]>xp);
 $("rank").textContent=current[0]+" · BARBERCRAFT";$("xp").textContent=fmt(xp);$("points").textContent=fmt(points);
 $("xpProgress").style.width=next?Math.min(100,Math.max(0,(xp-current[1])/(next[1]-current[1])*100))+"%":"100%";
 $("xpNext").textContent=next?fmt(next[1]-xp)+" XP până la "+next[0]:"Ai ajuns la rangul Legend.";
 $("visits").textContent=historyError?"—":fmt(history?.total_visits);
 const h=$("history");h.replaceChildren();
 if(historyError)h.append(el("p","Istoricul verificat nu a putut fi încărcat: "+historyError.message,"muted"));
 else if(!(history?.recent||[]).length)h.append(el("p","Nu există încă vizite validate. Programările viitoare nu generează automat XP.","muted"));
 else for(const visit of history.recent){const row=el("div",undefined,"item"),date=el("span",new Date(visit.date).toLocaleDateString("ro-RO",{day:"numeric",month:"long",year:"numeric"}));row.append(date,el("strong","+"+fmt(visit.xp)+" XP · +"+fmt(visit.points)+" puncte"));h.append(row)}
 const o=$("offers");o.replaceChildren();
 if(rewardsError)o.append(el("p","Recompensele nu sunt momentan disponibile.","muted"));
 else if(!(rewards||[]).length)o.append(el("p","Primele recompense sunt în curs de pregătire. Le vei vedea aici când sunt activate de administrator.","muted"));
 else for(const offer of rewards){const box=el("article",undefined,"offer");box.append(el("b",offer.category.toUpperCase()+" · "+fmt(offer.points_cost)+" puncte"),el("strong",offer.title),el("p",offer.description),el("p",offer.stock===0?"Stoc indisponibil":"Disponibilitatea și eligibilitatea se confirmă cu salonul."));o.append(box)}
 if(summary?.pending_prizes?.length)$("pendingAwards").textContent="Premii în așteptarea verificării: "+summary.pending_prizes.map(x=>x.kind).join(", ");
}catch(e){status.textContent="Nu am putut încărca toate datele: "+e.message}
const notes=$("notes"),photos=$("photos");
async function loadNotes(){
 const {data,error}=await sb.from("bc_passport_notes").select("id,salon_name,rating,note,created_at").order("created_at",{ascending:false}).limit(40);notes.replaceChildren();
 if(error){notes.append(el("p","Jurnal indisponibil: "+error.message,"muted"));return}
 if(!data?.length){notes.append(el("p","Încă nu ai adăugat notițe personale.","muted"));return}
 for(const n of data){const row=el("div",undefined,"item"),info=el("div");info.append(el("strong",n.salon_name+" · "+"★".repeat(n.rating)),el("p",n.note||"Fără notiță","muted"),el("small",new Date(n.created_at).toLocaleDateString("ro-RO")));const del=el("button","Șterge","btn");del.onclick=async()=>{if(!confirm("Ștergi această notiță privată?"))return;const {error}=await sb.from("bc_passport_notes").delete().eq("id",n.id);if(error)status.textContent=error.message;else await loadNotes()};row.append(info,del);notes.append(row)}
}
async function loadPhotos(){
 const {data,error}=await sb.from("bc_passport_photos").select("id,object_path,caption,created_at").order("created_at",{ascending:false}).limit(30);photos.replaceChildren();
 if(error){photos.append(el("p","Galeria nu este disponibilă: "+error.message,"muted"));return}
 if(!data?.length){photos.append(el("p","Nu ai adăugat fotografii.","muted"));return}
 for(const p of data){const box=el("div",undefined,"photo"),wrap=el("div");const {data:signed}=await sb.storage.from("bc-passport").createSignedUrl(p.object_path,120);
 if(signed?.signedUrl){const img=el("img");img.src=signed.signedUrl;img.alt=p.caption||"Fotografie privată";img.loading="lazy";box.append(img)}
 wrap.append(el("div",p.caption||new Date(p.created_at).toLocaleDateString("ro-RO")));const del=el("button","Șterge","btn");del.onclick=async()=>{if(!confirm("Ștergi fotografia?"))return;const {error}=await sb.storage.from("bc-passport").remove([p.object_path]);if(error){status.textContent=error.message;return}const db=await sb.from("bc_passport_photos").delete().eq("id",p.id);if(db.error)status.textContent=db.error.message;await loadPhotos()};wrap.append(del);box.append(wrap);photos.append(box)}
}
$("noteForm").onsubmit=async e=>{e.preventDefault();const form=e.currentTarget,b=form.querySelector("button");b.disabled=true;
 const {error}=await sb.from("bc_passport_notes").insert({user_id:user.id,salon_name:form.elements.salon.value.trim(),rating:Number(form.elements.rating.value),note:form.elements.note.value.trim()});b.disabled=false;
 if(error)status.textContent="Notița nu a fost salvată: "+error.message;else{form.reset();status.textContent="Notiță privată salvată.";await loadNotes()}};
$("photoForm").onsubmit=async e=>{e.preventDefault();const form=e.currentTarget,file=form.elements.photo.files?.[0],b=form.querySelector("button");
 if(!file||file.size>5*1024*1024||!["image/jpeg","image/png","image/webp"].includes(file.type)){status.textContent="Alege JPG, PNG sau WebP de maximum 5 MB.";return}
 b.disabled=true;const ext={"image/jpeg":"jpg","image/png":"png","image/webp":"webp"}[file.type],path=user.id+"/"+crypto.randomUUID()+"."+ext;
 try{const result=await sb.storage.from("bc-passport").upload(path,file,{contentType:file.type,upsert:false});if(result.error)throw result.error;
 const {error}=await sb.from("bc_passport_photos").insert({user_id:user.id,object_path:path,caption:form.elements.caption.value.trim()});if(error){await sb.storage.from("bc-passport").remove([path]);throw error}
 form.reset();status.textContent="Fotografia a fost salvată privat.";await loadPhotos();
 }catch(err){status.textContent="Încărcarea a eșuat: "+err.message}finally{b.disabled=false}};
await Promise.all([loadNotes(),loadPhotos()]);
})();