/* BARBERCRAFT Explore: non-bookable preview cards edited directly in Admin.
   No third-party booking links. Real photos only if rights are explicitly confirmed. */
(()=>{"use strict";
const $=id=>document.getElementById(id),home=$("home");if(!home)return;
const n=(tag,text,cls)=>{const x=document.createElement(tag);if(text!==undefined)x.textContent=String(text);if(cls)x.className=cls;return x};
const section=n("section",undefined,"bcSampleArea"),title=n("h3","Saloane de explorat"),
 description=n("p","Descoperă profiluri demonstrative. Prețurile și serviciile se pot modifica; rezervările sunt disponibile numai la saloanele partenere."),
 grid=n("div",undefined,"bcSampleGrid");
section.append(title,description,grid);$("salongrid")?.insertAdjacentElement("afterend",section);
const dialog=n("dialog",undefined,"bcSampleDialog");
dialog.innerHTML='<div class="bcSamplePopupHeader"><span>Profilul salonului</span><div class="bcSamplePopupActions"><a id="bcSampleNewTab" target="_blank" rel="noopener noreferrer" href="./client/" aria-label="Deschide profilul în tab nou" title="Deschide în tab nou">↗</a><button id="bcSampleClose" type="button" aria-label="Închide" title="Închide">✕</button></div></div><img class="bcSampleModalCover" src="./assets/salon-placeholder.svg" alt="Copertă salon"><div class="bcSampleBody" id="bcSampleDialogBody"></div>';
dialog.querySelector("#bcSampleClose").onclick=()=>dialog.close();
document.body.append(dialog);
const norm=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
const city=$("cityFilter"),county=$("countyFilter"),sector=$("sectorFilter");
const sb=window.supabase.createClient(window.BARBERCRAFT_SUPABASE_URL,window.BARBERCRAFT_SUPABASE_PUBLISHABLE_KEY);
const placeholder="./assets/salon-placeholder.svg";
const photo=(item,path)=>{
 if(!item.photo_permission||!path||!path.startsWith(item.id+"/")||
 !/^[a-f0-9-]{36}\/[a-f0-9-]{36}\.(jpg|png|webp)$/i.test(path))return placeholder;
 return sb.storage.from("bc-explore-images").getPublicUrl(path).data.publicUrl;
};
let data=[],token=0;
function ensureOptions(){
 for(const [select,value,label] of [[city,"București","București"],[county,"București","București"],
 ...Array.from({length:6},(_,i)=>[sector,"Sector "+(i+1),"Sector "+(i+1)])]){
  if(select&&![...select.options].some(o=>o.value===value))select.add(new Option(label,value));
 }
}
function draw(){
 const query=norm($("search")?.value),c=city?.value||"",s=sector?.value||"",q=county?.value||"";
 const shown=data.filter(x=>(!c||x.city===c)&&(!q||x.county===q)&&(!s||x.sector===s)&&
 (!query||norm([x.name,x.address,x.sector,...(x.services||[]).map(i=>i.name)].join(" ")).includes(query)));
 grid.replaceChildren();
 if(!shown.length){grid.append(n("p","Nu există saloane de explorat pentru filtrele selectate."));return}
 for(const salon of shown){
  const b=n("button",undefined,"bcSampleCard");b.type="button";
  const img=n("img");img.src=photo(salon,salon.cover_path);img.loading="lazy";
  img.alt=salon.photo_permission&&salon.cover_path?"Copertă "+salon.name:"Ilustrație BARBERCRAFT";
  const body=n("span",undefined,"bcSampleText");
  body.append(n("span","DE EXPLORAT · "+salon.sector,"bcSampleBadge"),
   n("strong",salon.name),n("small",salon.address),
   n("small",(salon.services?.length||0)+" servicii · Vezi prezentarea →"));
  b.append(img,body);b.onclick=()=>detail(salon);grid.append(b);
 }
}
function detail(s){
 const url=new URL("./client/",document.baseURI);
 url.searchParams.set("previewSalon",s.id);
 dialog.querySelector("#bcSampleNewTab").href=url.href;
 const root=dialog.querySelector("#bcSampleDialogBody");root.replaceChildren();
 const cover=dialog.querySelector(".bcSampleModalCover");cover.src=photo(s,s.cover_path);
 cover.alt=s.photo_permission&&s.cover_path?"Copertă "+s.name:"Ilustrație generică BARBERCRAFT";
 root.append(n("span","DE EXPLORAT · "+s.sector,"bcSampleBadge"),n("h2",s.name),n("p",s.address));
 const p=s.data_status==="admin_updated"?
 "Datele au fost actualizate în BARBERCRAFT. Profilul nu acceptă încă rezervări și nu reprezintă un cont PRO activ.":
 "Profil demonstrativ. Informațiile pot necesita confirmare; nu poți face rezervări prin BARBERCRAFT la acest salon.";
 root.append(n("p",p),n("h3","Servicii și prețuri"));
 for(const item of s.services||[]){
  const row=n("div",undefined,"bcSampleService"),info=n("div");
  info.append(n("strong",item.name),n("small",item.duration||"Durată neprecizată"));
  row.append(info,n("b",item.price));root.append(row);
 }
 if(!s.services?.length)root.append(n("p","Lista serviciilor urmează să fie actualizată."));
 root.append(n("h3","Echipă"));
 root.append(n("p",s.publicly_listed_team?.length?s.publicly_listed_team.join(" · "):"Lista specialiștilor nu este încă actualizată."));
 const pics=Array.isArray(s.gallery_paths)?s.gallery_paths:[];
 if(s.photo_permission&&pics.length){
  root.append(n("h3","Galerie"));const gallery=n("div",undefined,"bcExplorePublicGallery");
  for(const path of pics){const img=n("img");img.src=photo(s,path);img.loading="lazy";img.alt="Fotografie pentru "+s.name;gallery.append(img)}
  root.append(gallery);
 }
 const close=n("button","Închide");close.type="button";close.onclick=()=>dialog.close();
 const actions=n("div",undefined,"bcSampleCtas");actions.append(close);root.append(actions);dialog.showModal();
}
async function load(){
 const t=++token;
 try{
  const {data:items,error}=await sb.from("bc_discovery_salon_samples")
   .select("id,name,address,city,county,sector,services,publicly_listed_team,photo_permission,cover_path,gallery_paths,data_status")
   .limit(150);
  if(error)throw error;if(t!==token)return;
  data=items||[];window.BCDemoCatalog=data;ensureOptions();
  const wanted=new URL(window.location.href).searchParams.get("previewSalon");
  if(wanted){
   const match=data.find(s=>String(s.id)===wanted);
   if(match)detail(match);
  }
  for(const sel of [city,county,sector])if(sel)new MutationObserver(ensureOptions).observe(sel,{childList:true});
  title.textContent="Saloane de explorat · "+data.length+" profiluri";
  draw();window.BCLocationMap?.updatePins();
 }catch(e){description.textContent="Catalogul demonstrativ nu este disponibil momentan.";console.warn(e)}
}
for(const x of [$("search"),city,county,sector]){x?.addEventListener("input",draw);x?.addEventListener("change",draw)}
load();
})();