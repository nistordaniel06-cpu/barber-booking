/* Salon-scoped address book; the database enforces staff and tenant access. */
(()=>{"use strict";
const panel=document.querySelector("#proClientsPanel .pane");if(!panel)return;
const sb=window.BCAuthClient?.("pro",{detectSessionInUrl:false});if(!sb)return;
const make=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=String(text);return n};
const root=make("section");root.className="bcClientDirectory";
const label=make("label","Caută în agenda salonului"),search=make("input");search.type="search";search.placeholder="Nume, telefon sau @utilizator";label.append(search);
const salon=make("select");salon.setAttribute("aria-label","Salonul agendei");
const status=make("p"),list=make("div");status.setAttribute("role","status");
root.append(salon,label,status,list);panel.querySelector(".proPlaceholder")?.remove();panel.append(root);
let records=[],sequence=0;
function draw(){list.replaceChildren();const q=search.value.toLocaleLowerCase("ro-RO").trim();const matches=records.filter(p=>[p.name,p.phone,p.handle].join(" ").toLocaleLowerCase("ro-RO").includes(q));if(!matches.length)list.append(make("p","Niciun client găsit. Clienții cu rezervări în aplicație apar automat aici."));for(const p of matches){const card=make("article");card.append(make("strong",p.name||"Client"));if(p.phone){const a=make("a",p.phone);a.href="tel:"+p.phone.replace(/[^+0-9]/g,"");card.append(a)}if(p.handle)card.append(make("small","@"+p.handle));if(p.user_id&&p.handle){const a=make("a","Vizualizează profilul →");a.href="./social.html?from=pro&u="+encodeURIComponent(p.user_id);card.append(a)}else card.append(make("small","Profilul social nu este public"));list.append(card)}}
async function load(){const request=++sequence;status.textContent="Se încarcă agenda…";records=[];list.replaceChildren();if(!salon.value){status.textContent="Asociază un salon pentru a vedea agenda.";return}const {data,error}=await sb.rpc("bc_pro_client_directory",{p_salon:salon.value});if(request!==sequence)return;if(error){status.textContent="Agenda nu poate fi încărcată: "+error.message;return}records=Array.isArray(data)?data:[];status.textContent=records.length+" clienți în agenda salonului";draw()}
async function access(){const {data,error}=await sb.rpc("bc_my_professional_access");if(error){status.textContent="Conectează-te în contul profesional.";return}const old=salon.value;salon.replaceChildren();for(const s of data||[])salon.append(new Option(s.salon_name,s.salon_id));if([...salon.options].some(x=>x.value===old))salon.value=old;await load()}
search.oninput=draw;salon.onchange=load;
document.addEventListener("click",e=>{if(e.target.closest('[data-pro-route="clients"]'))void access()});
sb.auth.onAuthStateChange(()=>{setTimeout(()=>void access(),0)});
void access();
})();
