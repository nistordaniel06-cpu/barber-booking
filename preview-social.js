(async()=>{"use strict";
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=String(text);if(cls)n.className=cls;return n};
const box=document.getElementById("previewSocialSummary"),reviews=document.getElementById("profileVerifiedReviews");
if(!box||!reviews||!window.supabase)return;
const sb=await window.BCPassportSession();
const {data:{user}}=await sb.auth.getUser();if(!user)return;
const [profile,revs]=await Promise.all([
 sb.rpc("bc_social_profile_read",{p_user:user.id}),
 sb.rpc("bc_social_my_verified_reviews")
]);
box.replaceChildren();
if(profile.error){box.textContent="Profilul social nu poate fi încărcat momentan."}
else if(!profile.data){box.textContent="Profilul tău social nu este configurat încă. Îl poți activa separat, fără să publici datele private din Barber Passport."}
else {
 const p=profile.data;
 box.append(el("strong",p.followers+" urmăritori · "+p.following+" urmăriți"),
 el("p",p.is_public?"@"+p.handle+" · Profil public"+(p.kind==="barber"?" · Frizer":""):"@"+p.handle+" · Profil privat"));
 const a=el("a",p.is_public?"Vezi profilul în comunitate →":"Activează profilul public →");
 a.href=p.is_public?"./social.html?u="+encodeURIComponent(user.id):"./social.html#profile";
 box.append(a);
}
reviews.replaceChildren();
if(revs.error)reviews.append(el("p","Recenziile verificate nu sunt disponibile.","muted"));
else if(!revs.data?.length)reviews.append(el("p","Nu ai încă recenzii legate de vizite finalizate și confirmate de salon.","muted"));
else for(const r of revs.data){
 const row=el("div",undefined,"bc-profile-note");
 row.append(el("strong",r.salon+" · "+"★".repeat(r.stars)+" · ✓ Vizită confirmată"),
 el("p",r.body),el("small",new Date(r.at).toLocaleDateString("ro-RO")));
 reviews.append(row);
}
})();