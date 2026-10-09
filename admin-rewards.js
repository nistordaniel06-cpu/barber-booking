/* BARBERCRAFT Rewards Admin — platform-admin RPCs only. */
(function(){
"use strict";
const create=(tag,txt,cls)=>{const n=document.createElement(tag);if(txt!==undefined)n.textContent=String(txt);if(cls)n.className=cls;return n;};
const categories=["beneficiu","reducere","serviciu","produs","vip"];
async function render(sb,root){
 root.replaceChildren(create("h2","Recompense & catalog de beneficii"),create("p","Poți crea, edita și activa oferte. Activarea le afișează în catalog, dar NU acordă automat vouchere, reduceri sau puncte. Pentru revendicări este necesar fluxul de validare.","sub"));
 const message=create("p","","status");message.setAttribute("role","status");
 const form=create("form");form.id="rewardForm";
 form.innerHTML='<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(190px,1fr));margin:9px 0"><label class="field">Nume<input class="input" name="title" required minlength="3" maxlength="90"></label><label class="field">Puncte necesare<input class="input" type="number" min="0" max="100000" name="points" required value="250"></label><label class="field">Categorie<select class="input" name="category"><option>beneficiu</option><option>reducere</option><option>serviciu</option><option>produs</option><option>vip</option></select></label><label class="field">Stoc (gol = nelimitat)<input class="input" type="number" min="0" max="100000" name="stock"></label></div><label class="field">Descriere și condiții<textarea class="input" name="description" maxlength="600" rows="3"></textarea></label><label class="field" style="display:flex;align-items:center;gap:8px"><input type="checkbox" name="active"> Afișează drept recompensă disponibilă (fără acordare automată)</label><div class="actions"><button class="btn gold" type="submit">Salvează recompensa</button><button class="btn" type="reset">Recompensă nouă</button></div>';
 root.append(form,message);
 const list=create("div");root.append(list);
 let editing=null;let items=[];
 form.addEventListener("reset",()=>{editing=null;message.textContent="Completează o recompensă nouă."});
 const paint=()=>{
  list.replaceChildren(create("h2","Recompense configurate ("+items.length+")"));
  for(const reward of items){
   const el=create("article",undefined,"item"),info=create("div"),actions=create("div",undefined,"actions");
   info.append(create("strong",reward.title+(reward.is_active?" · ACTIVĂ":" · DRAFT")),create("small",reward.category+" · "+reward.points_cost+" XP/puncte · "+(reward.stock===null?"fără limită de stoc":"stoc "+reward.stock)+" · "+reward.description));
   const edit=create("button","Editează","btn");edit.type="button";edit.onclick=()=>{
    editing=reward.id;form.elements.title.value=reward.title;form.elements.description.value=reward.description;
    form.elements.points.value=reward.points_cost;form.elements.category.value=reward.category;
    form.elements.stock.value=reward.stock??"";form.elements.active.checked=reward.is_active;
    form.scrollIntoView({behavior:"smooth",block:"start"});message.textContent="Editezi: "+reward.title;
   };
   const toggle=create("button",reward.is_active?"Dezactivează":"Activează","btn"+(reward.is_active?"":" gold"));
   toggle.type="button";toggle.onclick=async()=>{
    if(!confirm((reward.is_active?"Dezactivezi ":"Publici ")+reward.title+"?"))return;
    toggle.disabled=true;message.textContent="Se salvează...";
    const {error}=await sb.rpc("bc_admin_reward_save",{p_id:reward.id,p_title:reward.title,p_description:reward.description,p_points_cost:reward.points_cost,p_category:reward.category,p_stock:reward.stock,p_is_active:!reward.is_active});
    if(error){message.textContent="Eroare: "+error.message;toggle.disabled=false;return;}await load();
   };
   actions.append(edit,toggle);el.append(info,actions);list.append(el);
  }
 };
 async function load(){
  message.textContent="Se încarcă recompensele...";
  const {data,error}=await sb.rpc("bc_admin_reward_list");
  if(error){message.textContent="Catalog indisponibil: "+error.message;return;}
  items=data||[];message.textContent="Schimbările sunt salvate în Supabase.";paint();
 }
 form.onsubmit=async event=>{
  event.preventDefault();const b=form.querySelector('[type="submit"]');b.disabled=true;
  const stock=form.elements.stock.value.trim();
  const payload={p_id:editing,p_title:form.elements.title.value.trim(),p_description:form.elements.description.value.trim(),p_points_cost:Number(form.elements.points.value),p_category:form.elements.category.value,p_stock:stock===""?null:Number(stock),p_is_active:form.elements.active.checked};
  message.textContent="Se salvează...";
  try{const {error}=await sb.rpc("bc_admin_reward_save",payload);if(error)throw error;form.reset();editing=null;await load();}
  catch(e){message.textContent="Eroare: "+e.message}finally{b.disabled=false}
 };
 await load();
}
window.BCRewardAdmin={render};
})();