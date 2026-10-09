/* BARBERCRAFT: public reviews only after independent QR and staff service completion. */
(async()=>{"use strict";
const $=id=>document.getElementById(id),el=(tag,text,klass)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=String(text);if(klass)n.className=klass;return n};
const root=$("verifiedReviewsForm"),list=$("verifiedReviewsMine");
if(!root||!list||!window.supabase)return;
const sb=window.supabase.createClient(window.BARBERCRAFT_SUPABASE_URL,window.BARBERCRAFT_SUPABASE_PUBLISHABLE_KEY);
const {data:{user}}=await sb.auth.getUser();if(!user)return;
const status=$("verifiedReviewStatus"),sel=root.elements.visit;
async function load(){
 const [vis,rev]=await Promise.all([sb.rpc("bc_my_reviewable_visits"),sb.rpc("bc_social_my_verified_reviews")]);
 sel.replaceChildren();list.replaceChildren();
 if(vis.error){status.textContent="Nu se pot verifica vizitele: "+vis.error.message;root.querySelector("button").disabled=true;return}
 const pending=(vis.data||[]).filter(v=>!v.reviewed);
 if(!pending.length){root.hidden=true;status.textContent="Nu ai încă vizite confirmate disponibile pentru recenzie. O recenzie necesită check-in QR și confirmarea serviciului de către salon."; }
 else{root.hidden=false;for(const v of pending)sel.append(new Option(v.salon+" · "+new Date(v.at).toLocaleDateString("ro-RO"),v.id))}
 if(rev.error){list.append(el("p","Recenziile nu pot fi încărcate: "+rev.error.message,"muted"));return}
 if(!rev.data?.length){list.append(el("p","Nu ai încă recenzii publicate cu vizită verificată.","muted"));return}
 for(const r of rev.data){const row=el("article",undefined,"item"),info=el("div");
 info.append(el("strong",r.salon+" · "+"★".repeat(r.stars)+" ✓ Vizită verificată"),
 el("p",r.body,"muted"),el("small",new Date(r.at).toLocaleDateString("ro-RO")));row.append(info);list.append(row)}
}
root.onsubmit=async e=>{
 e.preventDefault();const b=root.querySelector("button");b.disabled=true;
 const {error}=await sb.rpc("bc_verified_review_submit",{p_visit:sel.value,
  p_stars:Number(root.elements.stars.value),p_body:root.elements.body.value.trim()});
 if(error)status.textContent="Recenzia nu s-a publicat: "+error.message;
 else{root.reset();status.textContent="Recenzie publicată — vizita a fost verificată de salon.";await load()}
 b.disabled=false;
};
await load();
})();