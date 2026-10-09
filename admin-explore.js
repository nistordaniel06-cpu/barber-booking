/* Admin-only discovery catalog editor: source records stay non-partner and non-bookable. */
(function(){"use strict";
const el=(tag,text,cls)=>{const x=document.createElement(tag);if(text!==undefined)x.textContent=String(text);if(cls)x.className=cls;return x};
const field=(label,type="text",value="")=>{
 const wrap=el("label",undefined,"bcExploreField"),title=el("span",label),input=el(type==="textarea"?"textarea":"input");
 if(type!=="textarea")input.type=type;
 input.value=value??"";wrap.append(title,input);return {wrap,input};
};
const btn=(label,fn,cls="")=>{const b=el("button",label,"btn "+cls);b.type="button";b.onclick=fn;return b};
const bucket="bc-explore-images",validFile=file=>file&&["image/jpeg","image/png","image/webp"].includes(file.type)&&file.size<=5242880;
let rows=[],filterTerm="";
window.BCExploreAdmin={async render(sb,root){
 root.replaceChildren(el("h2","Saloane de explorat · Administrare"));
 root.append(el("p","Aici poți corecta date, încărca fotografii pentru care ai drepturi, ascunde sau elimina profilurile demonstrative. Acestea rămân separate de saloanele PRO și nu acceptă programări.","sub"));
 const status=el("p","Se încarcă saloanele…","status");status.setAttribute("role","status");root.append(status);
 const tools=el("div",undefined,"bcExploreTools");
 const search=field("Caută salon");search.input.placeholder="Nume, oraș, adresă";search.input.value=filterTerm;
 const list=el("div",undefined,"bcExploreList"),editor=el("div",undefined,"bcExploreEditor");
 tools.append(search.wrap,btn("＋ Salon nou",()=>openEditor(null),"gold"));
 root.append(tools,list,editor);
 let current=null;
 async function load(){
  const {data,error}=await sb.rpc("bc_admin_explore_list");
  if(error){status.textContent="Nu am putut încărca: "+error.message;return}
  rows=Array.isArray(data)?data:[];status.textContent=rows.length+" profiluri administrabile";paint();
 }
 function paint(){
  list.replaceChildren();
  const filtered=rows.filter(x=>[x.name,x.city,x.address].join(" ").toLocaleLowerCase("ro").includes(filterTerm.toLocaleLowerCase("ro")));
  for(const item of filtered){
   const row=el("div",undefined,"bcExploreRow"),info=el("div",undefined,"bcExploreRowInfo");
   info.append(el("strong",item.name),el("small",item.city+" · "+item.sector+" · "+(item.is_visible?"Vizibil":"Ascuns")+" · "+(item.data_status==="admin_updated"?"Editat în Admin":"Date demonstrative")));
   row.append(info,btn("Editează",()=>openEditor(item)));list.append(row);
  }
  if(!filtered.length)list.append(el("p","Nu s-au găsit saloane.","sub"));
 }
 search.input.oninput=()=>{filterTerm=search.input.value;paint()};
 function openEditor(item){
  current=item;editor.replaceChildren();editor.scrollIntoView({behavior:"smooth",block:"nearest"});
  const heading=el("div",undefined,"bcExploreEditorHead");heading.append(el("h3",item?"Editează · "+item.name:"Creează profil de explorat"),btn("✕ Închide",()=>editor.replaceChildren()));
  editor.append(heading);
  const form=el("form",undefined,"bcExploreForm");
  const name=field("Nume salon", "text",item?.name),address=field("Adresă", "text",item?.address),
   city=field("Oraș","text",item?.city||"București"),county=field("Județ","text",item?.county||"București"),
   sector=field("Sector / Zonă","text",item?.sector||"Sector 6"),
   team=field("Specialiști (câte un nume pe linie)","textarea",(item?.publicly_listed_team||[]).join("\n"));
  for(const [f,max] of [[name,120],[address,240],[city,90],[county,90],[sector,90]]){f.input.maxLength=max;f.input.required=true}
  const fields=el("div",undefined,"bcExploreFieldGrid");
  for(const f of [name,address,city,county,sector,team])fields.append(f.wrap);form.append(fields);
  form.append(el("h4","Servicii și prețuri"));
  const serviceList=el("div",undefined,"bcExploreServiceList");
  let services=(item?.services||[]).map(x=>({...x}));
  function servicePaint(){
   serviceList.replaceChildren();
   services.forEach((s,i)=>{
    const row=el("div",undefined,"bcExploreServiceRow");
    const title=field("Serviciu","text",s.name),price=field("Preț","text",s.price),duration=field("Durată","text",s.duration);
    for(const f of [title,price,duration])f.input.maxLength=110;
    title.input.oninput=()=>s.name=title.input.value;
    price.input.oninput=()=>s.price=price.input.value;
    duration.input.oninput=()=>s.duration=duration.input.value;
    row.append(title.wrap,price.wrap,duration.wrap,btn("Șterge serviciul",()=>{services.splice(i,1);servicePaint()},"danger"));
    serviceList.append(row);
   });
  }
  servicePaint();form.append(serviceList,btn("＋ Adaugă serviciu",()=>{
    if(services.length>=40){status.textContent="Maximum 40 de servicii.";return}
    services.push({name:"",price:"",duration:""});servicePaint();
  }));
  form.append(el("h4","Fotografii și copertă"));
  const tips=el("p","Încarcă numai imagini pentru care ai dreptul de publicare. Fotografiile devin publice după salvare; vechile imagini din alte platforme nu sunt importate automat.","sub");
  const cover=field("Copertă nouă","file"),gallery=field("Galerie nouă (maximum 12 fotografii)","file");
  cover.input.accept="image/jpeg,image/png,image/webp";gallery.input.accept=cover.input.accept;gallery.input.multiple=true;
  const permission=el("label",undefined,"bcExploreCheck"),check=el("input");check.type="checkbox";check.checked=!!item?.photo_permission;
  permission.append(check,el("span","Confirm că am dreptul de a publica toate fotografiile atașate."));
  let keepCover=item?.cover_path||null,keepGallery=Array.isArray(item?.gallery_paths)?[...item.gallery_paths]:[];
  const previews=el("div",undefined,"bcExplorePhotoList");
  function renderPhotoList(){
   previews.replaceChildren();
   function row(path,isCover){
    const box=el("div",undefined,"bcExplorePhoto");
    const img=el("img");img.src=sb.storage.from(bucket).getPublicUrl(path).data.publicUrl;
    img.alt=isCover?"Copertă curentă":"Fotografie de galerie";img.loading="lazy";
    box.append(img,btn("Elimină din profil",()=>{if(isCover)keepCover=null;else keepGallery=keepGallery.filter(p=>p!==path);renderPhotoList()},"danger"));
    previews.append(box);
   }
   if(keepCover)row(keepCover,true);keepGallery.forEach(p=>row(p,false));
  }
  renderPhotoList();
  form.append(tips,cover.wrap,gallery.wrap,permission,previews);
  const visible=el("label",undefined,"bcExploreCheck"),visibleCheck=el("input");
  visibleCheck.type="checkbox";visibleCheck.checked=item?.is_visible!==false;
  visible.append(visibleCheck,el("span","Afișează profilul în Descoperă"));
  const warn=el("p","Datele editate rămân într-un profil de explorat, fără cont PRO și fără rezervări BARBERCRAFT.","sub");
  const actions=el("div",undefined,"bcExploreActions"),save=el("button","Salvează profilul","btn gold");
  save.type="submit";actions.append(save);
  if(item){
   actions.append(btn(item.is_visible?"Ascunde rapid":"Afișează rapid",async()=>{
    visibleCheck.checked=!item.is_visible;form.requestSubmit();
   }));
   actions.append(btn("Șterge profilul definitiv",async()=>{
    if(prompt("Tastează numele exact al salonului pentru a-l șterge definitiv:", "")!==item.name)return;
    if(!confirm("Ștergi definitiv doar această înregistrare demonstrativă? Nu afectează conturile PRO."))return;
    const {data,error}=await sb.rpc("bc_admin_explore_delete",{p_id:item.id});
    if(error){status.textContent="Ștergerea a eșuat: "+error.message;return}
    const media=[data?.cover,...(data?.gallery||[])].filter(Boolean);
    if(media.length){
     const {error:delError}=await sb.storage.from(bucket).remove(media);
     if(delError)status.textContent="Profil șters; unele imagini necesită curățare manuală: "+delError.message;
    }
    editor.replaceChildren();await load();status.textContent="Profilul a fost eliminat din catalog.";
   },"danger"));
  }
  form.append(visible,warn,actions);
  form.onsubmit=async e=>{
   e.preventDefault();save.disabled=true;status.textContent="Salvăm datele și imaginile…";
   const pics=[...gallery.input.files||[]],front=cover.input.files?.[0];
   if((front||pics.length||keepCover||keepGallery.length)&&!check.checked){
    status.textContent="Confirmă drepturile pentru toate imaginile folosite.";save.disabled=false;return
   }
   if((front&&!validFile(front))||pics.some(f=>!validFile(f))){
    status.textContent="Pozele trebuie să fie JPG, PNG sau WebP, maxim 5 MB fiecare.";save.disabled=false;return
   }
   if(keepGallery.length+pics.length>12){
    status.textContent="Maximum 12 fotografii de galerie.";save.disabled=false;return
   }
   if(services.some(s=>!s.name.trim()||!s.price.trim())){
    status.textContent="Completează denumirea și prețul tuturor serviciilor.";save.disabled=false;return
   }
   const data={p_name:name.input.value.trim(),p_address:address.input.value.trim(),
    p_city:city.input.value.trim(),p_county:county.input.value.trim(),
    p_sector:sector.input.value.trim(),p_services:services.map(s=>({name:s.name.trim(),price:s.price.trim(),duration:(s.duration||"").trim()})),
    p_team:team.input.value.split(/\n/).map(s=>s.trim()).filter(Boolean),
    p_visible:visibleCheck.checked,p_photos_authorized:check.checked};
   let id=item?.id||null;const created=[];
   try{
    const {data:newId,error}=await sb.rpc("bc_admin_explore_save",{
     p_id:id,...data,p_cover:keepCover,p_gallery:keepGallery
    });
    if(error)throw error;
    id=newId;
    const files=[...(front?[front]:[]),...pics];
    for(const file of files){
     const ext={"image/jpeg":"jpg","image/png":"png","image/webp":"webp"}[file.type];
     const path=id+"/"+crypto.randomUUID()+"."+ext;
     const {error:uploadError}=await sb.storage.from(bucket).upload(path,file,{contentType:file.type,upsert:false});
     if(uploadError)throw uploadError;
     created.push(path);
     if(file===front)keepCover=path;else keepGallery.push(path);
    }
    if(created.length){
     const {error:saveError}=await sb.rpc("bc_admin_explore_save",{
      p_id:id,...data,p_cover:keepCover,p_gallery:keepGallery
     });
     if(saveError)throw saveError;
    }
    status.textContent="Salvat. Profilul rămâne demonstrativ, fără rezervări. Încarcă homepage pentru verificare.";
    await load();
    const updated=rows.find(x=>x.id===id);
    if(updated)openEditor(updated);
   }catch(err){
    if(created.length)await sb.storage.from(bucket).remove(created);
    status.textContent="Eroare la salvare: "+err.message;
   }finally{save.disabled=false}
  };
  editor.append(form);
 }
 await load();
}};
})();
