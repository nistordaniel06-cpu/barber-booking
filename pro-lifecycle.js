/* Salon lifecycle: deletion is an owner-only archival request.
   Existing bookings, invoices, reviews and historical records are preserved. */
(async()=>{"use strict";
const $=id=>document.getElementById(id),root=$("proLifecycle");if(!root)return;
const node=(tag,txt)=>{const n=document.createElement(tag);if(txt!==undefined)n.textContent=txt;return n};
const sb=window.supabase.createClient(window.BARBERCRAFT_SUPABASE_URL,window.BARBERCRAFT_SUPABASE_PUBLISHABLE_KEY,
 {auth:{storageKey:"barbercraft-pro-session",persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const select=$("lifecycleSalon"),state=$("lifecycleStatus"),input=$("lifecycleConfirm"),archive=$("lifecycleArchive"),restore=$("lifecycleRestore");
let map=new Map();
async function reload(){
 const {data:{user}}=await sb.auth.getUser();if(!user){state.textContent="Autentifică-te în PRO pentru a gestiona saloanele.";return}
 const {data,error}=await sb.rpc("bc_my_professional_access");
 if(error){state.textContent=error.message;return}
 const owners=(data||[]).filter(x=>x.member_role==="owner");
 select.replaceChildren();for(const r of owners){select.append(new Option(r.salon_name,r.salon_id))}
 if(!owners.length){state.textContent="Numai proprietarul unui salon poate solicita eliminarea acestuia.";archive.disabled=true;restore.hidden=true;return}
 await changed();
}
async function changed(){
 const id=select.value;if(!id)return;
 const {data,error}=await sb.rpc("bc_pro_salon_lifecycle",{p_salon:id});
 if(error){state.textContent=error.message;return}
 map.set(id,data);
 input.value="";input.placeholder=data?.salon_name||"Numele exact al salonului";
 archive.hidden=!!data.archived;restore.hidden=!data.archived;
 archive.disabled=!!data.archived;
 state.textContent=data.archived?
 "Salon eliminat din listări. Datele și istoricul au fost păstrate, iar rezervările sunt dezactivate.":
 data.upcoming>0?"Există "+data.upcoming+" programări viitoare. Rezolvă-le înainte să elimini salonul.":
 "Poți elimina salonul din căutări și rezervări. Istoricul legal, programările și recenziile NU vor fi șterse.";
}
select.onchange=changed;
archive.onclick=async()=>{
 const cfg=map.get(select.value);if(!cfg||cfg.archived)return;
 if(input.value.trim()!==cfg.salon_name){state.textContent="Scrie numele exact al salonului pentru confirmare.";return}
 if(!confirm("Elimini «"+cfg.salon_name+"» din BARBERCRAFT? Va dispărea din listări și nu va accepta rezervări. Istoricul rămâne stocat și poate fi reactivat numai de proprietar."))return;
 archive.disabled=true;
 const {error}=await sb.rpc("bc_pro_archive_salon",{p_salon:select.value,p_confirmation:input.value.trim()});
 state.textContent=error?"Nu s-a putut elimina salonul: "+error.message:"Salonul a fost eliminat din listări.";
 await changed();
};
restore.onclick=async()=>{
 if(!confirm("Restaurezi salonul? Listarea și rezervările NU se activează automat."))return;
 const {error}=await sb.rpc("bc_pro_restore_salon",{p_salon:select.value});
 state.textContent=error?"Restaurarea a eșuat: "+error.message:"Salon restaurat. Activează separat pagina publică și rezervările.";
 await changed();
};
document.addEventListener("bc-pro-reload-lifecycle",reload);
$("proLifecycleRefresh").onclick=reload;
await reload();
})();