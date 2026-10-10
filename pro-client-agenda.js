/* Private PRO phonebook from verified salon bookings; never guesses client identities. */
(()=>{"use strict";
const panel=document.getElementById("proClientsPanel");
if(!panel)return;
const sb=window.BCAuthClient?.("pro",{detectSessionInUrl:false});
if(!sb)return;
const ui=document.createElement("section");ui.className="bcProAgenda";ui.innerHTML=
 '<div class="bcAgendaTitle"><div><div class="eyebrow">BARBERCRAFT PRO</div><h3>Agenda salonului</h3><p>Clienții cu programări înregistrate în salon. Doar echipa salonului poate vedea numerele de telefon.</p></div><span>♙</span></div>'+
 '<label class="bcAgendaLabel">Salon<select id="bcAgendaSalon" aria-label="Salon pentru agendă"><option value="">Se încarcă…</option></select></label>'+
 '<label class="bcAgendaLabel">Caută client<input id="bcAgendaSearch" type="search" maxlength="80" placeholder="Nume sau telefon"></label>'+
 '<p id="bcAgendaStatus" role="status">Se verifică accesul…</p><div id="bcAgendaList" class="bcAgendaList"></div>';
panel.querySelector(".pane")?.prepend(ui);
const $=id=>document.getElementById(id);
const label=$("bcAgendaStatus"),salon=$("bcAgendaSalon"),search=$("bcAgendaSearch"),list=$("bcAgendaList");
const n=(tag,txt,cls)=>{const x=document.createElement(tag);if(txt!=null)x.textContent=txt;if(cls)x.className=cls;return x};
const fmtDate=date=>new Date(date).toLocaleDateString("ro-RO",{timeZone:"Europe/Bucharest",day:"numeric",month:"short",year:"numeric"});
let loaded=false,busy=false;
async function loadSalons(){
 const {data:{user}}=await sb.auth.getUser();
 if(!user){label.textContent="Conectează-te în contul PRO pentru agendă.";return}
 const {data,error}=await sb.rpc("bc_my_professional_access");
 salon.replaceChildren(new Option("Alege salonul",""));
 if(error){label.textContent="Nu am putut verifica saloanele: "+error.message;return}
 for(const item of data||[])salon.append(new Option(item.name||item.salon_name||"Salon",item.salon_id));
 if((data||[]).length){salon.value=data[0].salon_id;await refresh()}
 else label.textContent="Nu există un salon asociat acestui cont PRO.";
}
async function refresh(){
 if(busy||!salon.value)return;busy=true;
 label.textContent="Se caută clienți în programările confirmate…";
 const {data,error}=await sb.rpc("bc_pro_client_agenda",{p_salon:salon.value,p_search:search.value.trim()});
 busy=false;list.replaceChildren();
 if(error){label.textContent="Agenda nu poate fi încărcată: "+error.message;return}
 const clients=data||[];label.textContent=clients.length+" clienți în agendă";
 if(!clients.length){list.append(n("p","Niciun client cu programări pentru criteriul ales.","bcAgendaEmpty"));return}
 for(const person of clients){
  const item=n("article",null,"bcAgendaRow");
  const avatar=n("div",person.name?.trim()?.charAt(0)?.toUpperCase()||"C","bcAgendaAvatar");
  const content=n("div",null,"bcAgendaPerson");
  content.append(n("strong",person.name||"Client"),n("small",(person.username?"@"+person.username+" · ":"")+person.visits+" programări · ultima: "+fmtDate(person.last_booking)));
  const actions=n("div",null,"bcAgendaActions"),phone=n("a","☎ Sună");
  if(/^\+[1-9]\d{7,14}$/.test(person.phone||"")){phone.href="tel:"+person.phone;phone.title=person.phone;actions.append(phone)}
  if(person.profile_user){
   const profile=n("a","Vizualizează profil");
   profile.href="./social.html?u="+encodeURIComponent(person.profile_user);
   profile.target="_blank";profile.rel="noopener noreferrer";actions.append(profile);
  }else{actions.append(n("small","Profilul nu este legat încă de cont","bcAgendaUnlinked"))}
  item.append(avatar,content,actions);list.append(item);
 }
}
salon.addEventListener("change",()=>void refresh());
let debouncer;search.addEventListener("input",()=>{clearTimeout(debouncer);debouncer=setTimeout(()=>void refresh(),280)});
document.addEventListener("click",event=>{
 if(event.target.closest('[data-pro-route="clients"]'))setTimeout(()=>{
  if(!loaded){loaded=true;void loadSalons()}else void refresh();
 },85)
});
})();