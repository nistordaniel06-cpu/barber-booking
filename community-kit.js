/* Shared favorites, verified visit ranks, presence and salon mentions. */
(()=>{"use strict";
const make=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=String(text);if(cls)n.className=cls;return n};
const pro=new URLSearchParams(location.search).get("from")==="pro"||document.body.classList.contains("bc-pro")||location.pathname.includes("/pro/");
const session=()=>window.BCPassportSession?window.BCPassportSession():Promise.resolve(window.BCAuthClient?.(pro?"pro":"client",{detectSessionInUrl:false}));
const rpc=async(name,args={})=>{const sb=await session();if(!sb)throw Error("Conexiune indisponibilă");const {data,error}=await sb.rpc(name,args);if(error)throw Error(error.message);return data};
const profileURL=id=>"./social.html?u="+encodeURIComponent(id)+(pro?"&from=pro":"");
let presenceBusy=false,timer=null,online=new Set();
async function refreshPresence(){
 if(presenceBusy)return;presenceBusy=true;
 try{
  const sb=await session();if(!sb)return;const {data:{user}}=await sb.auth.getUser();
  if(user)await rpc("bc_presence_ping",{p_active:!document.hidden});
  if(!document.hidden){
   const ids=[...new Set([...document.querySelectorAll("[data-presence-user]")].map(n=>n.dataset.presenceUser))].slice(0,100);
   online=new Set(await rpc("bc_presence_read",{p_users:ids}));
   document.querySelectorAll("[data-presence-user]").forEach(n=>{const active=online.has(n.dataset.presenceUser);n.classList.toggle("isOnline",active);n.title=active?"Online acum":"Offline";n.setAttribute("aria-label",active?"Online acum":"Offline")});
  }
 }catch(_){document.querySelectorAll(".bcOnlineDot").forEach(n=>n.classList.remove("isOnline"))}
 finally{presenceBusy=false}
}
window.BCPresence={mount(parent,id){const dot=make("span",undefined,"bcOnlineDot");dot.dataset.presenceUser=id;dot.setAttribute("aria-label","Verificăm prezența");parent.append(dot);void refreshPresence();return dot}};
window.addEventListener("bc-client-auth-changed",()=>void refreshPresence());
document.addEventListener("visibilitychange",()=>void refreshPresence());
const levels=[{name:"Membru",badge:"✂",visits:0},{name:"Bronz 1",badge:"🥉",visits:3},{name:"Bronz 2",badge:"🥉",visits:6},{name:"Bronz 3",badge:"🥉",visits:9},{name:"Silver 1",badge:"🥈",visits:12},{name:"Silver 2",badge:"🥈",visits:18},{name:"Silver 3",badge:"🥈",visits:24},{name:"Gold 1",badge:"🥇",visits:30},{name:"Gold 2",badge:"🥇",visits:40},{name:"Gold 3",badge:"🥇",visits:50},{name:"Premium",badge:"♛",visits:65},{name:"Platinum",badge:"💎",visits:80}];
function rank(visits){visits=Math.max(0,Math.floor(Number(visits)||0));const index=levels.findLastIndex(r=>visits>=r.visits),current=levels[index],next=levels[index+1];return{visits,current,next,done:visits-current.visits,total:next?next.visits-current.visits:0}}
function rankNode(visits){const r=rank(visits),box=make("section",undefined,"bcVisitRank");box.append(make("strong",r.current.badge+" "+r.current.name));if(r.next){const p=make("progress");p.max=r.total;p.value=r.done;p.setAttribute("aria-label","Progres până la "+r.next.name);box.append(p,make("small",r.done+"/"+r.total+" până la "+r.next.name+" · "+(r.total-r.done)+" vizite rămase"))}else box.append(make("small","Ai atins Platinum · "+r.visits+" vizite confirmate"));const badges=make("div",undefined,"bcRankBadges");for(const level of levels.slice(1)){const badge=make("span",level.badge+" "+level.name,visits>=level.visits?"unlocked":"locked");badge.title=level.visits+" vizite confirmate";badges.append(badge)}box.append(badges);return box}
window.BCVisitRank={rank,render:rankNode,async mount(parent,id){try{const data=await rpc("bc_profile_visit_rank",{p_user:id});if(data!==null)parent.append(rankNode(data.visits))}catch(_){}}};
let favoritesKind="salon",favoritesSequence=0;
async function mountHeart(parent,kind,id){
 if(!id||!["barber","salon"].includes(kind))return;
 const heart=make("button","♡", "bcHeart");heart.type="button";heart.setAttribute("aria-label","Salvează la favorite");heart.disabled=true;parent.append(heart);
 let saved=false;
 function paint(data){saved=!!data.saved;heart.textContent=(saved?"♥ ":"♡ ")+data.count;heart.setAttribute("aria-pressed",String(saved));heart.setAttribute("aria-label",(saved?"Elimină din favorite":"Salvează la favorite")+" · "+data.count+" aprecieri");heart.classList.toggle("isSaved",saved)}
 try{paint(await rpc("bc_favorite_state",{p_kind:kind,p_target:id}));heart.disabled=false}catch(_){heart.textContent="♡";heart.title="Favoritele nu sunt disponibile momentan";heart.disabled=false}
 heart.onclick=async()=>{heart.disabled=true;try{paint(await rpc("bc_favorite_set",{p_kind:kind,p_target:id,p_saved:heart.getAttribute("aria-pressed")!=="true"}));document.querySelectorAll(`[data-heart-key="${kind}:${id}"]`).forEach(other=>{other.textContent=heart.textContent;other.setAttribute("aria-pressed",String(saved));other.classList.toggle("isSaved",saved)});await loadFavorites()}catch(e){heart.title=e.message.includes("LOGIN")?"Conectează-te pentru favorite":e.message;if(e.message.includes("LOGIN")){const a=make("a","Autentifică-te pentru a salva","bcFavoriteLogin");a.href="./client/#account";if(!parent.querySelector(".bcFavoriteLogin"))parent.append(a)}}finally{heart.disabled=false}};
 heart.dataset.heartKey=kind+":"+id;return heart;
}
async function loadFavorites(){
 const box=document.getElementById("bcFavoritesList");if(!box)return;const sequence=++favoritesSequence;
 box.textContent="Se încarcă favoritele…";
 try{const list=await rpc("bc_favorites_list",{p_kind:favoritesKind});if(sequence!==favoritesSequence)return;box.replaceChildren();if(!list.length)box.append(make("p",favoritesKind==="salon"?"Salvează saloanele preferate apăsând pe inimă.":"Salvează frizerii preferați apăsând pe inimă."));for(const item of list){const row=make("article",undefined,"bcFavoriteRow"),a=make("a",item.name);a.href=item.kind==="salon"?"./client/?catalog="+encodeURIComponent(item.id):profileURL(item.id);row.append(a);box.append(row);void mountHeart(row,item.kind,item.id)}}catch(e){if(sequence===favoritesSequence){box.replaceChildren(make("p",e.message.includes("LOGIN")?"Conectează-te pentru a vedea favoritele tale.":"Favoritele nu pot fi încărcate momentan."));const a=make("a","Intră în cont");a.href="./client/#account";box.append(a)}}
}
window.BCFavorites={mount:mountHeart,load:loadFavorites};
window.addEventListener("bc-salon-profile",e=>{const actions=document.querySelector(".catalogProfileActions");actions?.querySelectorAll(".bcHeart,.bcFavoriteLogin").forEach(n=>n.remove());if(actions)void mountHeart(actions,"salon",e.detail.id)});
document.addEventListener("click",e=>{const b=e.target.closest("[data-favorites-kind]");if(b){favoritesKind=b.dataset.favoritesKind;document.querySelectorAll("[data-favorites-kind]").forEach(n=>n.classList.toggle("active",n===b));void loadFavorites()}if(e.target.closest('[data-go="favorites"]'))void loadFavorites()});
let mentionsPromise;
async function mentions(){if(!mentionsPromise)mentionsPromise=rpc("bc_salon_mentions").catch(()=>[]);return mentionsPromise}
async function renderMentions(node,text){
 const list=await mentions(),lookup=new Map(list.map(x=>[x.handle,x]));node.replaceChildren();const pattern=/@([a-z0-9_]{3,60})/gi;let offset=0;
 for(const match of text.matchAll(pattern)){node.append(document.createTextNode(text.slice(offset,match.index)));const found=lookup.get(match[1].toLowerCase());if(found){const a=make("a",match[0],"bcSalonMention");a.href="./client/?catalog="+encodeURIComponent(found.id);a.title=found.name;node.append(a)}else node.append(document.createTextNode(match[0]));offset=match.index+match[0].length}node.append(document.createTextNode(text.slice(offset)));
}
function attachMentions(input){
 const suggestions=make("div",undefined,"bcMentionSuggestions");suggestions.hidden=true;input.after(suggestions);
 input.addEventListener("input",async()=>{const pos=input.selectionStart??input.value.length,match=input.value.slice(0,pos).match(/@([a-z0-9_]*)$/i);if(!match){suggestions.hidden=true;return}const query=match[1].toLowerCase(),items=(await mentions()).filter(x=>x.handle.startsWith(query)||x.name.toLocaleLowerCase("ro").includes(query)).slice(0,6);if(input.value.slice(0,input.selectionStart??input.value.length).match(/@([a-z0-9_]*)$/i)?.[1]!==match[1])return;suggestions.replaceChildren();for(const item of items){const b=make("button","@"+item.handle+" · "+item.name);b.type="button";b.onclick=()=>{input.setRangeText("@"+item.handle+" ",pos-match[0].length,pos,"end");suggestions.hidden=true;input.focus()};suggestions.append(b)}suggestions.hidden=!items.length});
}
window.BCSalonMentions={render:renderMentions};
async function boot(){
 document.querySelectorAll('#socialPostForm textarea,#socialClientGalleryForm input[name="caption"],#socialPortfolioForm input[name="caption"],#photoForm input[name="caption"]').forEach(attachMentions);
 if(document.getElementById("bcFavoritesList"))void loadFavorites();
 const hero=document.querySelector(".bc-passport .hero,.bc-preview-header");if(hero){try{const sb=await session(),{data:{user}}=await sb.auth.getUser();if(user)await window.BCVisitRank.mount(hero,user.id)}catch(_){}}
 timer=setInterval(()=>void refreshPresence(),30000);void refreshPresence();
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>void boot(),{once:true});else void boot();
})();
