/* BARBERCRAFT demonstration directory.
  External MERO listings are source-referenced and NOT bookable BARBERCRAFT salons.
  Salon-specific images are deliberately NOT copied or fabricated. */
(()=>{"use strict";
const $=id=>document.getElementById(id),home=$("home");
if(!home)return;
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const n=(tag,text,cls)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=String(text);if(cls)el.className=cls;return el};
const section=n("section",undefined,"bcSampleArea"),title=n("h3","Saloane de explorat · București"),
 description=n("p","20 de profiluri demonstrative cu date publice și sursa indicată. Nu sunt parteneri BARBERCRAFT, iar fotografiile reale sunt disponibile la sursă. Prețurile se pot modifica."),
 grid=n("div",undefined,"bcSampleGrid");
section.append(title,description,grid);
const salonGrid=$("salongrid");salonGrid?.insertAdjacentElement("afterend",section);
const dialog=n("dialog",undefined,"bcSampleDialog");
dialog.innerHTML='<img class="bcSampleModalCover" src="./assets/salon-placeholder.svg" alt="Ilustrație generică, nu fotografia salonului"><div class="bcSampleBody" id="bcSampleDialogBody"></div>';
document.body.append(dialog);
const filters=[$("search"),$("countyFilter"),$("cityFilter"),$("sectorFilter")];
let data=[],token=0;
const city=$("cityFilter"),county=$("countyFilter"),sector=$("sectorFilter");
const norm=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
function ensureOptions(){
 for(const [select,value,label] of [[city,"București","București"],[county,"București","București"],...Array.from({length:6},(_,i)=>[sector,"Sector "+(i+1),"Sector "+(i+1)])]){
  if(select&&![...select.options].some(o=>o.value===value))select.add(new Option(label,value));
 }
}
function draw(){
 const query=norm($("search")?.value);
 const c=city?.value||"",s=sector?.value||"",q=county?.value||"";
 const shown=data.filter(x=>(!c||x.city===c)&&(!q||x.county===q)&&(!s||x.sector===s)
 &&(!query||norm([x.name,x.address,x.sector,...(x.services||[]).map(i=>i.name)].join(" ")).includes(query)));
 grid.replaceChildren();
 if(!shown.length){grid.append(n("p","Nu există saloane demonstrative pentru filtrele selectate."));return}
 for(const salon of shown){
  const b=n("button",undefined,"bcSampleCard");b.type="button";
  const img=n("img");img.src="./assets/salon-placeholder.svg";img.alt="Grafică generică BARBERCRAFT, nu fotografia "+salon.name;
  const body=n("span",undefined,"bcSampleText"),badge=n("span","SURSĂ EXTERNĂ · "+salon.sector,"bcSampleBadge");
  body.append(badge,n("strong",salon.name),n("small",salon.address),n("small",salon.services.length+" servicii în extras · Vezi detalii →"));
  b.append(img,body);b.onclick=()=>detail(salon);grid.append(b);
 }
}
function detail(s){
 const root=dialog.querySelector("#bcSampleDialogBody");root.replaceChildren();
 const eyebrow=n("span","SURSĂ EXTERNĂ · "+s.sector,"bcSampleBadge"),h=n("h2",s.name),addr=n("p",s.address);
 const notice=n("p","Profil pentru explorare și testare. Informații preluate din listări publice, care se pot modifica. Salonul nu este înscris ca partener BARBERCRAFT și nu se pot face rezervări aici. Ilustrația nu reprezintă interiorul acestui salon.");
 root.append(eyebrow,h,addr,notice,n("h3","Servicii și prețuri afișate public"));
 if(!s.services?.length)root.append(n("p","Serviciile nu au fost confirmate. Vezi sursa."));
 for(const item of s.services||[]){
  const row=n("div",undefined,"bcSampleService"),info=n("div");
  info.append(n("strong",item.name),n("small",item.duration));
  row.append(info,n("b",item.price));root.append(row);
 }
 root.append(n("h3","Specialiști menționați în lista publică"));
 const names=s.publicly_listed_team||[];
 root.append(n("p",names.length?names.join(" · "):"Nu există nume de specialiști verificate în extrasul consultat. Consultă pagina originală."));
 const actions=n("div",undefined,"bcSampleCtas"),source=n("a","Deschide profilul MERO ↗");
 if(!/^https:\/\/mero\.ro\/p\/[a-z0-9-]+$/i.test(s.source_url))return;
 source.href=s.source_url;source.target="_blank";source.rel="noopener noreferrer";
 const close=n("button","Închide");close.type="button";close.onclick=()=>dialog.close();
 actions.append(source,close);root.append(actions);dialog.showModal();
}
async function load(){
 const t=++token;
 try{
  const sb=window.supabase.createClient(window.BARBERCRAFT_SUPABASE_URL,window.BARBERCRAFT_SUPABASE_PUBLISHABLE_KEY);
  const {data:items,error}=await sb.from("bc_discovery_salon_samples").select("id,name,address,city,county,sector,source_url,services,publicly_listed_team").limit(100);
  if(error)throw error;if(t!==token)return;
  data=items||[];window.BCDemoCatalog=data;
  ensureOptions();
  // Main catalog reload replaces select options. Synchronize after that fetch completes.
  const observer=new MutationObserver(()=>ensureOptions());
  for(const sel of [city,county,sector])if(sel)observer.observe(sel,{childList:true});
  title.textContent="Saloane de explorat · "+data.length+" profiluri";
  draw();window.BCLocationMap?.updatePins();
 }catch(e){description.textContent="Lista demonstrativă nu poate fi încărcată momentan.";console.warn("External sample directory",e)}
}
for(const f of filters)f?.addEventListener("input",draw);
for(const f of [county,city,sector])f?.addEventListener("change",draw);
load();
})();
