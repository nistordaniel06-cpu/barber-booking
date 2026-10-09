(function(){
const textNode=(tag,value)=>{const n=document.createElement(tag);n.textContent=String(value||"");return n};
window.BCAdminCommunity={render:async(sb,root)=>{
 root.replaceChildren(textNode("h2","Comunitate · raportări"));
 const {data,error}=await sb.rpc("bc_admin_social_reports");
 if(error){root.append(textNode("p","Indisponibil: "+error.message));return}
 root.append(textNode("p",(data||[]).length+" raportări"));
 for(const item of data||[]){
  const box=document.createElement("article");box.className="item";
  const desc=document.createElement("div");
  desc.append(textNode("strong",(item.kind==="post"?"Postare raportată · ":"Profil raportat · ")+item.reported),
  ...(item.post_id?[textNode("small","ID postare: "+item.post_id)]:[]),
  textNode("p",item.reason),textNode("small",new Date(item.date).toLocaleString("ro-RO")));
  box.append(desc);root.append(box);
 }
}};
})();