/* Salon @mentions: no untrusted HTML injection, links only verified public catalog entries. */
(()=>{"use strict";
const sb=window.BCAuthClient?.("client",{detectSessionInUrl:false});
if(!sb)return;
let catalog=[],ready=false;
const normalize=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("ro-RO").trim();
async function load(){
 if(ready)return;ready=true;
 try{const {data,error}=await sb.from("bc_public_salon_catalog")
 .select("id,name").eq("visibility","listed").limit(300);
 if(!error)catalog=(data||[]).filter(v=>v.id&&v.name);
 }catch(_){}
}
function salonFor(name){
 const matching=catalog.filter(s=>normalize(s.name)===normalize(name));
 return matching.length===1?matching[0]:null;
}
function attachText(node,text){
 node.replaceChildren();
 const src=String(text||"");const rex=/@\[([^\]]{1,70})\]|@([a-zA-Z0-9_-]{2,60})/g;
 let idx=0,m;
 while((m=rex.exec(src))){
  if(m.index>idx)node.append(document.createTextNode(src.slice(idx,m.index)));
  const name=m[1]||m[2],salon=salonFor(name);
  if(salon){
   const link=document.createElement("a");link.className="bcSalonMention";
   link.textContent="@"+salon.name;
   link.href=new URL("./client/?salon="+encodeURIComponent(salon.id),document.baseURI).href;
   link.title="Vezi salonul "+salon.name+" în BARBERCRAFT";
   node.append(link);
  }else node.append(document.createTextNode(m[0]));
  idx=m.index+m[0].length;
 }
 if(idx<src.length)node.append(document.createTextNode(src.slice(idx)));
}
window.BCSalonMentions={load,render:attachText};
void load();
const observeForms=()=>{
 for(const field of document.querySelectorAll('#socialPostForm textarea[name="body"],#socialPortfolioForm input[name="caption"],#socialClientGalleryForm input[name="caption"]')){
  if(field.dataset.bcMentionHook)return;field.dataset.bcMentionHook="1";
  const box=document.createElement("div");box.className="bcMentionsSuggest";box.hidden=true;
  field.after(box);
  field.addEventListener("input",()=>{
   box.replaceChildren();
   const cursor=field.selectionStart||field.value.length,part=field.value.slice(0,cursor);
   const m=part.match(/(?:^|\s)@([\w-]{0,35})$/);
   if(!m||!catalog.length){box.hidden=true;return}
   const matches=catalog.filter(s=>normalize(s.name).startsWith(normalize(m[1]))).slice(0,5);
   if(!matches.length){box.hidden=true;return}
   box.hidden=false;
   for(const salon of matches){
    const b=document.createElement("button");b.type="button";b.textContent="@"+salon.name;
    b.onclick=()=>{
     const at=cursor-m[1].length-1;
     field.value=field.value.slice(0,at)+"@["+salon.name+"] "+field.value.slice(cursor);
     box.hidden=true;field.focus();field.dispatchEvent(new Event("input",{bubbles:true}));
    };box.append(b);
   }
  });
  field.addEventListener("blur",()=>setTimeout(()=>box.hidden=true,190));
 }
};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",observeForms,{once:true});else observeForms();
})();