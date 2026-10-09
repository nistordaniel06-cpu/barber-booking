/* BARBERCRAFT admin: multi-city/zone directory; no scoring activation. */
(function(){"use strict";
const el=(tag,label,cls)=>{const n=document.createElement(tag);if(label!==undefined)n.textContent=String(label);if(cls)n.className=cls;return n};
async function render(sb,root){
 root.replaceChildren(el("h2","Orașe și zone"),el("p","Configurează orașe, cartiere sau sectoare. Publicarea unei zone o afișează în director, dar NU activează competiția, scoringul sau premiile.","sub"));
 const msg=el("p","Se încarcă directorul…","status"),cities=el("div");
 root.append(msg,cities);
 async function refresh(){
  const {data,error}=await sb.rpc("bc_admin_zone_directory");
  if(error){msg.textContent="Nu s-a putut încărca: "+error.message;return}
  msg.textContent="Director sincronizat. Orașele și cartierele sunt editabile numai de administrator.";
  cities.replaceChildren();
  const add=el("form",undefined,"panel");add.innerHTML='<h2>Adaugă oraș</h2><label class="field">Numele orașului<input class="input" name="name" minlength="2" maxlength="100" required></label><label class="field">Județ<input class="input" name="county" maxlength="100" required></label><label class="field"><span><input name="listed" type="checkbox"> Afișează în director ca „în pregătire”</span></label><button type="submit" class="btn gold">Adaugă oraș</button>';
  add.onsubmit=async e=>{e.preventDefault();const b=add.querySelector("button");b.disabled=true;
   const {error}=await sb.rpc("bc_admin_city_save",{p_id:null,p_name:add.elements.name.value.trim(),p_county:add.elements.county.value.trim(),p_listed:add.elements.listed.checked});
   msg.textContent=error?"Eroare: "+error.message:"Oraș adăugat.";b.disabled=false;if(!error)await refresh();
  };cities.append(add);
  for(const city of data||[]){
   const panel=el("section",undefined,"panel"),head=el("div",undefined,"actions"),title=el("h2",city.name+" · "+city.county);
   const visibility=el("button",city.is_listed?"Ascunde orașul":"Publică orașul","btn");
   visibility.type="button";visibility.onclick=async()=>{visibility.disabled=true;
    const {error}=await sb.rpc("bc_admin_city_save",{p_id:city.id,p_name:city.name,p_county:city.county,p_listed:!city.is_listed});
    msg.textContent=error?"Eroare: "+error.message:"Vizibilitatea orașului a fost salvată.";if(!error)await refresh();else visibility.disabled=false;
   };
   const rename=el("button","Redenumește","btn");rename.onclick=async()=>{
    const name=prompt("Numele orașului",city.name);if(name===null)return;
    const county=prompt("Județ",city.county);if(county===null)return;
    const {error}=await sb.rpc("bc_admin_city_save",{p_id:city.id,p_name:name.trim(),p_county:county.trim(),p_listed:city.is_listed});
    msg.textContent=error?"Eroare: "+error.message:"Oraș actualizat.";if(!error)await refresh();
   };
   head.append(title,visibility,rename);panel.append(head,el("p","Zonele sunt afișate doar după publicare. Clasamentele rămân indisponibile până la lansarea motorului pentru oraș.","sub"));
   for(const zone of city.zones||[]){
    const row=el("div",undefined,"item"),name=el("strong",zone.name+(zone.is_listed?" · PUBLICATĂ":" · DRAFT")),actions=el("div",undefined,"actions");
    const toggle=el("button",zone.is_listed?"Ascunde":"Publică","btn"+(zone.is_listed?"":" gold"));toggle.onclick=async()=>{
     toggle.disabled=true;const {error}=await sb.rpc("bc_admin_zone_save",{p_id:zone.id,p_city:city.id,p_name:zone.name,p_listed:!zone.is_listed});
     msg.textContent=error?"Eroare: "+error.message:"Zona a fost actualizată.";if(!error)await refresh();else toggle.disabled=false;
    };
    const edit=el("button","Editează","btn");edit.onclick=async()=>{
      const newName=prompt("Numele zonei",zone.name);if(newName===null)return;
      const {error}=await sb.rpc("bc_admin_zone_save",{p_id:zone.id,p_city:city.id,p_name:newName.trim(),p_listed:zone.is_listed});
      msg.textContent=error?"Eroare: "+error.message:"Zona a fost redenumită.";if(!error)await refresh();
    };actions.append(toggle,edit);row.append(name,actions);panel.append(row);
   }
   const form=el("form",undefined,"actions");
   form.innerHTML='<label class="field" style="flex:1">Cartier / sector nou<input class="input" name="name" placeholder="Ex. Mănăștur" minlength="2" maxlength="100" required></label><button class="btn gold" type="submit" style="align-self:end;margin-bottom:10px">Adaugă zonă</button>';
   form.onsubmit=async e=>{e.preventDefault();const b=form.querySelector("button");b.disabled=true;
    const {error}=await sb.rpc("bc_admin_zone_save",{p_id:null,p_city:city.id,p_name:form.elements.name.value.trim(),p_listed:false});
    msg.textContent=error?"Eroare: "+error.message:"Zona a fost creată ca draft.";if(!error)await refresh();else b.disabled=false;
   };panel.append(form);cities.append(panel);
  }
 }
 await refresh();
}
window.BCZonesAdmin={render};
})();