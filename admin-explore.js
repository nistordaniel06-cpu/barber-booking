/* BARBERCRAFT · administrator-only Explore editor.
   Opt-in public listings only. No partner account / booking activation here. */
(function(){"use strict";
const el=(tag,text,cls)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=String(text);if(cls)node.className=cls;return node;};
const field=(name,type="text",value="")=>{
 const label=el("label",undefined,"bcExploreField"),caption=el("span",name,"bcExploreLabel");
 const control=el(type==="textarea"?"textarea":"input");
 if(type!=="textarea")control.type=type;
 if(type!=="file")control.value=value==null?"":String(value);
 if(type==="textarea")control.rows=3;
 label.append(caption,control);
 return {wrap:label,input:control};
};
const button=(label,callback,style="")=>{
 const b=el("button",label,"bcExploreButton "+style);b.type="button";b.onclick=callback;return b;
};
const bucket="bc-explore-images";
const validFile=f=>f&&["image/jpeg","image/png","image/webp"].includes(f.type)&&f.size<=5*1024*1024;
const validPath=(id,path)=>!!id&&typeof path==="string"&&path.startsWith(id+"/")&&/^[a-f0-9-]{36}\/[a-f0-9-]{36}\.(jpg|png|webp)$/i.test(path);
let rows=[],query="",activeFilter="all";
window.BCExploreAdmin={async render(sb,root){
 root.replaceChildren();root.classList.add("bcExploreApp");
 const intro=el("section",undefined,"bcExploreHero");
 const header=el("div",undefined,"bcExploreHeroText");
 header.append(el("span","BARBERCRAFT / ADMINISTRATOR","bcExploreKicker"),
  el("h2","Saloane de explorat"),el("p","Administrează prezentările saloanelor într-un singur loc. Modifică date, fotografii, servicii și vizibilitatea."));
 const artwork=el("div","✂","bcExploreHeroArt");artwork.setAttribute("aria-hidden","true");
 intro.append(header,artwork);root.append(intro);
 const stats=el("div",undefined,"bcExploreStats");root.append(stats);
 const note=el("p","Profilurile de explorat nu sunt conturi PRO și nu acceptă rezervări.","bcExploreNotice");root.append(note);
 const status=el("p","Se încarcă saloanele…","bcExploreStatus");status.setAttribute("role","status");root.append(status);
 const browser=el("section",undefined,"bcExploreBrowser");
 const tools=el("div",undefined,"bcExploreToolbar");
 const search=field("Caută un salon");search.input.placeholder="Nume, oraș sau adresă";search.input.setAttribute("aria-label","Caută în saloanele de explorat");search.input.value=query;
 const filters=el("label",undefined,"bcExploreField bcExploreFilter");filters.append(el("span","Afișează","bcExploreLabel"));
 const select=el("select");
 for(const [value,label] of [["all","Toate saloanele"],["visible","Publicate"],["hidden","Ascunse"],["updated","Editate în Admin"]])select.append(new Option(label,value));
 select.value=activeFilter;filters.append(select);
 const add=button("＋ Salon nou",()=>openEditor(null),"bcExplorePrimary");
 tools.append(search.wrap,filters,add);
 const list=el("div",undefined,"bcExploreList");
 browser.append(tools,list);
 const editor=el("section",undefined,"bcExploreEditor");editor.hidden=true;
 root.append(browser,editor);
 const inform=(message,kind="")=>{status.textContent=message;status.dataset.kind=kind;};
 async function load(){
  const {data,error}=await sb.rpc("bc_admin_explore_list");
  if(error){inform("Nu pot încărca saloanele: "+error.message,"error");return false;}
  rows=Array.isArray(data)?data:[];
  stats.replaceChildren();
  const visible=rows.filter(x=>x.is_visible!==false).length;
  for(const [value,label] of [[rows.length,"Total profiluri"],[visible,"Publicate"],[rows.length-visible,"Ascunse"]]){
   const tile=el("div",undefined,"bcExploreStat");
   tile.append(el("strong",value),el("span",label));stats.append(tile);
  }
  inform(rows.length+" profiluri disponibile pentru administrare.");
  paint();return true;
 }
 const mediaUrl=(r,path)=>validPath(r.id,path)&&r.photo_permission?
  sb.storage.from(bucket).getPublicUrl(path).data.publicUrl:null;
 function summaryImage(r){
  const src=mediaUrl(r,r.cover_path);
  if(src){const img=el("img");img.loading="lazy";img.alt="Coperta salonului "+r.name;img.src=src;return img;}
  const fallback=el("div",undefined,"bcExploreNoPhoto");
  fallback.append(el("span","✂"),el("small","Adaugă copertă"));return fallback;
 }
 function paint(){
  list.replaceChildren();
  const filtered=rows.filter(x=>{
   const matches=[x.name,x.city,x.address,x.sector].join(" ").toLocaleLowerCase("ro").includes(query.toLocaleLowerCase("ro").trim());
   return matches&&(activeFilter==="all"||(activeFilter==="visible"&&x.is_visible!==false)||
    (activeFilter==="hidden"&&x.is_visible===false)||
    (activeFilter==="updated"&&x.data_status==="admin_updated"));
  });
  if(!filtered.length){list.append(el("p","Niciun salon nu corespunde filtrelor alese.","bcExploreEmpty"));return;}
  for(const salon of filtered){
   const card=el("article",undefined,"bcExploreCard"),visual=el("div",undefined,"bcExploreCardMedia");
   visual.append(summaryImage(salon));
   const content=el("div",undefined,"bcExploreCardContent");
   const heading=el("div",undefined,"bcExploreCardHeading");
   heading.append(el("strong",salon.name),el("small",salon.city+" · "+salon.sector+" · "+salon.address));
   const flags=el("div",undefined,"bcExploreBadges");
   flags.append(el("span",salon.is_visible===false?"Ascuns":"Publicat",salon.is_visible===false?"bcExploreBadge is-hidden":"bcExploreBadge is-visible"));
   flags.append(el("span",salon.data_status==="admin_updated"?"Actualizat":"Demonstrativ","bcExploreBadge"));
   if(salon.catalog_id)flags.append(el("span",salon.catalog_pro_salon?"Asociat salon PRO":"În Catalog","bcExploreBadge is-visible"));
   const actions=el("div",undefined,"bcExploreCardActions");
   actions.append(
    button("✎ Editează",()=>openEditor(salon),"bcExplorePrimary"),
    button(salon.catalog_id?(salon.catalog_pro_salon?"Vezi în catalog":"↻ Sincronizează catalogul"):"⇧ Importă în Catalog",
     ()=>promote(salon),"bcExploreSecondary"),
    button(salon.is_visible===false?"Publică":"Ascunde",()=>toggleVisibility(salon),"bcExploreSecondary"),
    button("Șterge",()=>remove(salon),"bcExploreDanger")
   );
   content.append(heading,flags,actions);card.append(visual,content);list.append(card);
  }
 }
 async function promote(item){
  if(item.catalog_pro_salon){
   inform("Profilul este deja asociat unui salon PRO. Editează tarifele și calendarul din contul PRO, nu prin import.","error");return;
  }
  const first=!!item.catalog_id;
  const message=first?
   "Actualizezi profilul din Catalog saloane cu datele de explorat și îl republici? Acțiunea nu activează rezervările.":
   "Ai verificat numele, adresa, serviciile, prețurile, drepturile asupra imaginilor și proveniența datelor? Importul va publica un profil în Catalog saloane, fără să accepte automat rezervări.";
  if(!confirm(message))return;
  inform(first?"Sincronizăm datele în Catalog…":"Importăm salonul în Catalog…");
  const {data,error}=await sb.rpc("bc_admin_explore_promote",{p_sample:item.id,p_confirmed:true});
  if(error){inform("Importul nu a reușit: "+error.message,"error");return;}
  await load();
  inform("Salonul este în Catalog. Pentru programări, mergi la «Catalog saloane», asociază contul PRO al salonului și cere proprietarului activarea rezervărilor.","success");
 }
  function payload(item,visible){
  const services=Array.isArray(item.services)?item.services.map(s=>({
   name:String(s.name??""),price:String(s.price??""),duration:String(s.duration??"")
  })):[];
  const team=Array.isArray(item.publicly_listed_team)?item.publicly_listed_team.map(String):[];
  return {p_id:item.id,p_name:item.name,p_address:item.address,p_city:item.city,p_county:item.county,
   p_sector:item.sector,p_services:services,p_team:team,p_cover:item.cover_path||null,
   p_gallery:Array.isArray(item.gallery_paths)?item.gallery_paths:[],
   p_photos_authorized:!!item.photo_permission,p_visible:visible};
 }
 async function toggleVisibility(item){
  inform((item.is_visible===false?"Publicăm":"Ascundem")+" salonul…");
  const {error}=await sb.rpc("bc_admin_explore_save",payload(item,item.is_visible===false));
  if(error){inform("Vizibilitatea nu a putut fi schimbată: "+error.message,"error");return;}
  await load();inform("Vizibilitatea a fost actualizată. Înregistrarea rămâne fără programări BARBERCRAFT.","success");
 }
 async function remove(item){
  const name=prompt("Pentru ștergerea definitivă a profilului demonstrativ, scrie exact: "+item.name);
  if(name!==item.name)return;
  if(!confirm("Confirmi ștergerea profilului de explorat? Nu afectează conturile PRO."))return;
  const {data,error}=await sb.rpc("bc_admin_explore_delete",{p_id:item.id});
  if(error){inform("Ștergerea a fost refuzată: "+error.message,"error");return;}
  const photos=[data?.cover,...(Array.isArray(data?.gallery)?data.gallery:[])].filter(Boolean);
  let warning="";
  if(photos.length){
   const res=await sb.storage.from(bucket).remove(photos);
   if(res.error)warning=" Unele fișiere trebuie eliminate manual: "+res.error.message;
  }
  showList();await load();inform("Profilul «"+item.name+"» a fost șters."+warning,"success");
 }
 function showList(){
  editor.hidden=true;editor.replaceChildren();browser.hidden=false;
  intro.scrollIntoView({behavior:"smooth",block:"start"});
 }
 function section(title,desc,icon){
  const box=el("section",undefined,"bcExploreSection");
  const heading=el("div",undefined,"bcExploreSectionHeading");
  heading.append(el("span",icon,"bcExploreSectionIcon"));
  const texts=el("div");texts.append(el("h3",title),el("p",desc));heading.append(texts);
  box.append(heading);return box;
 }
 function openEditor(item){
  browser.hidden=true;editor.hidden=false;editor.replaceChildren();
  const top=el("div",undefined,"bcExploreEditorHead"),back=button("← Înapoi la saloane",showList,"bcExploreBack");
  top.append(back,el("span",item?"MODIFICARE PROFIL":"PROFIL NOU","bcExploreKicker"));editor.append(top);
  editor.append(el("h2",item?"Editează · "+item.name:"Adaugă salon de explorat","bcExploreEditTitle"));
  const form=el("form",undefined,"bcExploreForm");
  form.noValidate=false;
  const details=section("Informații salon","Actualizează detaliile afișate clienților în Descoperă.","▣");
  const detailGrid=el("div",undefined,"bcExploreFieldGrid");
  const name=field("Nume salon","text",item?.name),address=field("Adresă completă","text",item?.address),
   city=field("Oraș","text",item?.city||"București"),county=field("Județ","text",item?.county||"București"),
   sector=field("Sector / zonă","text",item?.sector||"Sector 6"),
   team=field("Specialiști · un nume pe linie","textarea",(item?.publicly_listed_team||[]).join("\n"));
  for(const [f,max] of [[name,120],[address,240],[city,90],[county,90],[sector,90]]){
   f.input.maxLength=max;f.input.required=true;
  }
  name.wrap.classList.add("bcExploreWide");address.wrap.classList.add("bcExploreWide");team.wrap.classList.add("bcExploreWide");
  for(const f of [name,address,city,county,sector,team])detailGrid.append(f.wrap);
  details.append(detailGrid);form.append(details);
  const servicesArea=section("Servicii & prețuri","Editează denumirile, tarifele și durata; prețurile pot include intervale.","✂");
  const servicesBox=el("div",undefined,"bcExploreServiceList");
  let services=Array.isArray(item?.services)?item.services.map(s=>({...s})):[];
  function showServices(){
   servicesBox.replaceChildren();
   services.forEach((s,i)=>{
    const card=el("div",undefined,"bcExploreServiceCard");
    const serviceHead=el("div",undefined,"bcExploreServiceHeader");
    serviceHead.append(el("strong","Serviciul "+(i+1)),button("✕ Elimină",()=>{services.splice(i,1);showServices()},"bcExploreDanger bcExploreRemoveService"));
    const grid=el("div",undefined,"bcExploreServiceFields");
    const title=field("Serviciu","text",s.name),price=field("Preț","text",s.price),duration=field("Durată","text",s.duration);
    title.wrap.classList.add("bcExploreWide");title.input.maxLength=110;price.input.maxLength=65;duration.input.maxLength=65;
    title.input.required=true;price.input.required=true;
    title.input.oninput=()=>s.name=title.input.value;
    price.input.oninput=()=>s.price=price.input.value;
    duration.input.oninput=()=>s.duration=duration.input.value;
    grid.append(title.wrap,price.wrap,duration.wrap);card.append(serviceHead,grid);servicesBox.append(card);
   });
  }
  showServices();
  servicesArea.append(servicesBox,button("＋ Adaugă un serviciu",()=>{
   if(services.length>=40){inform("Limita este de 40 servicii.","error");return;}
   services.push({name:"",price:"",duration:""});showServices();
   servicesBox.lastElementChild?.scrollIntoView({behavior:"smooth",block:"nearest"});
  },"bcExploreAddService"));
  form.append(servicesArea);
  const media=section("Fotografii & copertă","Fotografiile trebuie să fie ale salonului și să ai drepturi pentru publicarea lor.","▧");
  let keepCover=item?.cover_path||null,keepGallery=Array.isArray(item?.gallery_paths)?[...item.gallery_paths]:[];
  const uploadGrid=el("div",undefined,"bcExploreUploadGrid");
  const cover=field("Copertă · JPG / PNG / WebP","file"),gallery=field("Galerie · până la 12 fotografii","file");
  cover.input.accept="image/jpeg,image/png,image/webp";gallery.input.accept=cover.input.accept;gallery.input.multiple=true;
  uploadGrid.append(cover.wrap,gallery.wrap);
  const previews=el("div",undefined,"bcExplorePhotoList");
  function photoPreview(){
   previews.replaceChildren();
   for(const [path,isCover] of [...(keepCover?[[keepCover,true]]:[]),...keepGallery.map(p=>[p,false])]){
    const box=el("div",undefined,"bcExplorePhoto");
    const img=el("img");img.alt=isCover?"Coperta salonului":"Imagine galerie";
    img.loading="lazy";img.src=sb.storage.from(bucket).getPublicUrl(path).data.publicUrl;
    const removePhoto=button("Elimină",()=>{
     if(isCover)keepCover=null;else keepGallery=keepGallery.filter(p=>p!==path);
     photoPreview();
    },"bcExploreDanger");
    box.append(img,el("small",isCover?"Copertă":"Galerie"),removePhoto);previews.append(box);
   }
  }
  photoPreview();
  const rights=el("label",undefined,"bcExploreSwitch");
  const rightsBox=el("input");rightsBox.type="checkbox";rightsBox.checked=!!item?.photo_permission;
  rights.append(rightsBox,el("span","Confirm că am dreptul de a publica fotografiile atașate."));
  media.append(uploadGrid,previews,rights);
  form.append(media);
  const publication=section("Vizibilitate","Controlezi separat dacă profilul apare în aplicație; nu activezi rezervări reale.","◉");
  const visible=el("label",undefined,"bcExploreSwitch bcExplorePublish");
  const visibleBox=el("input");visibleBox.type="checkbox";visibleBox.checked=item?.is_visible!==false;
  const hint=el("span");
  hint.append(el("strong","Publică în Descoperă"),el("small","Oprit = profil ascuns din explorare"));
  visible.append(visibleBox,hint);publication.append(visible);
  form.append(publication);
  const actions=el("div",undefined,"bcExploreEditorActions");
  const save=el("button","Salvează modificările","bcExploreButton bcExplorePrimary");save.type="submit";
  actions.append(button("Renunță",showList,"bcExploreSecondary"),save);
  form.append(actions);
  if(item){
   if(item.catalog_id){
   const link=el("div",undefined,"bcExploreCatalogLink");
   link.append(el("strong","✓ Profil importat în Catalog saloane"),
    el("small",item.catalog_pro_salon?"Asociat unui salon PRO. Modificările comerciale sunt gestionate de proprietar.":"Pentru rezervări trebuie asociat un salon PRO verificat și activat calendarul de către proprietar."));
   link.append(button("Mergi la Catalog saloane ↗",()=>{window.location.hash="catalog";window.location.reload();},"bcExploreSecondary"));
   form.append(link);
  }
   const danger=el("div",undefined,"bcExploreDeleteFooter");
   danger.append(el("small","Ștergerea definitivă afectează numai această fișă demonstrativă."),
    button("Șterge profilul",()=>remove(item),"bcExploreDanger"));
   form.append(danger);
  }
  form.onsubmit=async event=>{
   event.preventDefault();
   if(!form.reportValidity())return;
   const files=[...gallery.input.files||[]],front=cover.input.files?.[0];
   if((front||files.length||keepCover||keepGallery.length)&&!rightsBox.checked){
    inform("Confirmă drepturile pentru toate fotografiile atașate.","error");return;
   }
   if((front&&!validFile(front))||files.some(file=>!validFile(file))){
    inform("Sunt acceptate numai JPG, PNG sau WebP de maximum 5 MB fiecare.","error");return;
   }
   if(files.length+keepGallery.length>12){
    inform("Galeria poate avea maximum 12 fotografii.","error");return;
   }
   if(services.some(s=>!String(s.name||"").trim()||!String(s.price||"").trim())){
    inform("Completează denumirile și prețurile tuturor serviciilor.","error");return;
   }
   const data={
    p_name:name.input.value.trim(),p_address:address.input.value.trim(),
    p_city:city.input.value.trim(),p_county:county.input.value.trim(),p_sector:sector.input.value.trim(),
    p_services:services.map(s=>({name:String(s.name||"").trim(),price:String(s.price||"").trim(),duration:String(s.duration||"").trim()})),
    p_team:team.input.value.split(/\n/).map(x=>x.trim()).filter(Boolean),
    p_visible:visibleBox.checked,p_photos_authorized:rightsBox.checked
   };
   save.disabled=true;save.textContent="Se salvează…";inform("Se salvează profilul și imaginile…");
   let id=item?.id||null;
   const uploaded=[];
   try{
    const initial=await sb.rpc("bc_admin_explore_save",{p_id:id,...data,p_cover:keepCover,p_gallery:keepGallery});
    if(initial.error)throw initial.error;
    id=initial.data;
    for(const file of [...(front?[front]:[]),...files]){
     const ext={"image/jpeg":"jpg","image/png":"png","image/webp":"webp"}[file.type];
     const path=id+"/"+crypto.randomUUID()+"."+ext;
     const uploadedFile=await sb.storage.from(bucket).upload(path,file,{contentType:file.type,upsert:false});
     if(uploadedFile.error)throw uploadedFile.error;
     uploaded.push(path);
     if(file===front)keepCover=path;else keepGallery.push(path);
    }
    if(uploaded.length){
     const result=await sb.rpc("bc_admin_explore_save",{p_id:id,...data,p_cover:keepCover,p_gallery:keepGallery});
     if(result.error)throw result.error;
    }
    const success=await load();
    if(success){showList();inform("Profilul «"+data.p_name+"» a fost actualizat cu succes.","success");}
   }catch(e){
    if(uploaded.length)await sb.storage.from(bucket).remove(uploaded);
    inform("Nu s-a putut salva: "+e.message,"error");
   }finally{save.disabled=false;save.textContent="Salvează modificările";}
  };
  editor.append(form);
  editor.scrollIntoView({behavior:"smooth",block:"start"});
 }
 search.input.oninput=()=>{query=search.input.value;paint();};
 select.onchange=()=>{activeFilter=select.value;paint();};
 await load();
}};
})();