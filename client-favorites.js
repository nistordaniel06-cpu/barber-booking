/* Client two-shelf favorites: only verified public salons and real PRO profiles. */
(()=>{"use strict";
const $=id=>document.getElementById(id);
const sb=window.BCAuthClient?.("client",{detectSessionInUrl:false});
const app=$("favoritesView"),grid=$("salongrid"),profile=$("catalogProfile");
if(!sb||!app||!grid)return;
let active="salon",currentSalon=null,busy=false,mutationTimer=null;
const create=(tag,txt,cls)=>{const n=document.createElement(tag);if(txt!=null)n.textContent=txt;if(cls)n.className=cls;return n};
const note=$("bcFavoriteStatus"),list=$("bcFavoriteList");
const pretty=n=>new Intl.NumberFormat("ro-RO").format(Number(n)||0);
async function signedIn(){const {data:{user}}=await sb.auth.getUser();return user}
async function toggle(kind,id,button){
 if(busy)return;
 if(!await signedIn()){
  note.textContent="Conectează-te în contul Client pentru a salva favorite.";
  if(!app.classList.contains("active"))alert("Intră în contul Client ca să salvezi saloane și frizeri.");
  return;
 }
 busy=true;button.disabled=true;
 try{
  const {data,error}=await sb.rpc("bc_favorite_toggle",{p_kind:kind,p_target:id});
  if(error)throw error;
  button.classList.toggle("isSaved",!!data.saved);
  button.setAttribute("aria-pressed",String(!!data.saved));
  const count=button.querySelector(".bcFavCount");if(count)count.textContent=pretty(data.count);
  const symbol=button.querySelector(".bcFavSymbol");if(symbol)symbol.textContent=data.saved?"♥":"♡";
  note.textContent=data.saved?"Adăugat în favorite.":"Eliminat din favorite.";
  window.dispatchEvent(new Event("bc-favorites-updated"));
 }catch(error){note.textContent="Nu am putut salva: "+error.message}
 finally{button.disabled=false;busy=false}
}
const makeHeart=(kind,id,label)=>{
 const b=create("button",null,"bcFavHeart");b.type="button";
 b.title="Adaugă "+label+" la favorite";
 b.setAttribute("aria-label",b.title);b.setAttribute("aria-pressed","false");
 b.append(create("span","♡","bcFavSymbol"),create("span","0","bcFavCount"));
 b.onclick=e=>{e.preventDefault();e.stopPropagation();void toggle(kind,id,b)};
 return b;
};
async function paintHearts(kind,pairs){
 const unique=[...new Set(pairs.map(x=>x.id).filter(Boolean))].slice(0,100);
 if(!unique.length)return;
 const {data,error}=await sb.rpc("bc_favorite_summary",{p_kind:kind,p_targets:unique});if(error)return;
 const lookup=new Map((data||[]).map(x=>[x.id,x]));
 for(const item of pairs){const val=lookup.get(item.id);if(!val)continue;
  const heart=item.heart;heart.classList.toggle("isSaved",!!val.saved);
  heart.setAttribute("aria-pressed",String(!!val.saved));
  heart.querySelector(".bcFavSymbol").textContent=val.saved?"♥":"♡";
  heart.querySelector(".bcFavCount").textContent=pretty(val.count);
 }
}
function decorateSalonCards(){
 const pairs=[];
 for(const card of grid.querySelectorAll(".saloncard[data-catalog-id]")){
  if(card.closest(".bcFavoriteCardWrap"))continue;
  const id=card.dataset.catalogId;
  const wrap=create("div",null,"bcFavoriteCardWrap");
  card.replaceWith(wrap);wrap.append(card);
  const heart=makeHeart("salon",id,"salonul");wrap.append(heart);
  pairs.push({id,heart});
 }
 if(pairs.length)void paintHearts("salon",pairs);
}
const observer=new MutationObserver(()=>{clearTimeout(mutationTimer);mutationTimer=setTimeout(decorateSalonCards,65)});
observer.observe(grid,{childList:true,subtree:false});
setTimeout(decorateSalonCards,300);
async function showSalonHeart(id){
 currentSalon=id;
 const row=profile.querySelector(".catalogProfileActions");if(!row)return;
 row.querySelector(".bcFavHeart")?.remove();
 const heart=makeHeart("salon",id,"salonul");heart.classList.add("bcFavProfileHeart");row.append(heart);
 await paintHearts("salon",[{id,heart}]);
}
document.addEventListener("click",event=>{
 const card=event.target.closest(".saloncard[data-catalog-id]");
 if(card)void showSalonHeart(card.dataset.catalogId);
});
const openOriginal=window.BCOpenCatalogSalon;
window.BCOpenCatalogSalon=function(id){openOriginal?.(id);void showSalonHeart(id)};
function renderRows(data){
 list.replaceChildren();
 const filtered=(data||[]).filter(x=>x.kind===active);
 if(!filtered.length){
  list.append(create("p",active==="salon"?"Nu ai saloane salvate. Apasă inimioara de pe pagina unui salon.":"Nu ai frizeri salvați. Apasă inimioara pe profilul unui frizer.","bcFavEmpty"));return;
 }
 for(const item of filtered){
  const row=create("article",null,"bcFavRow");
  const info=create("div");
  info.append(create("strong",item.title||"Profil"),create("small",(item.subtitle||"")+" · ♥ "+pretty(item.count)));
  const b=create("button","Vezi profilul →","bcFavOpen");
  b.type="button";b.onclick=()=>{
   if(item.kind==="barber")location.href=new URL("./social.html?u="+encodeURIComponent(item.id),document.baseURI).href;
   else if(window.BCOpenCatalogSalon)window.BCOpenCatalogSalon(item.id);
  };
  row.append(info,b);list.append(row);
 }
}
let cache=[];
async function refresh(){
 note.textContent="Se încarcă favoritele tale…";
 if(!await signedIn()){
  list.replaceChildren(create("p","Intră în contul Client pentru a vedea saloanele și frizerii salvați.","bcFavEmpty"));
  note.textContent="Favoritele sunt private și sincronizate cu contul tău.";
  return;
 }
 const {data,error}=await sb.rpc("bc_favorites_mine");
 if(error){note.textContent="Favorite indisponibile: "+error.message;return}
 cache=data||[];renderRows(cache);
 note.textContent=cache.length+" profiluri salvate.";
}
for(const b of app.querySelectorAll("[data-favorite-kind]")){
 b.onclick=()=>{active=b.dataset.favoriteKind;
  app.querySelectorAll("[data-favorite-kind]").forEach(x=>x.classList.toggle("active",x===b));
  renderRows(cache)};
}
window.BCRefreshFavorites=refresh;
window.addEventListener("bc-client-auth-changed",()=>{if(app.classList.contains("active"))void refresh();});
window.addEventListener("bc-favorites-updated",()=>{if(app.classList.contains("active"))void refresh();});
})();