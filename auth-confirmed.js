/* Landing page for Supabase signup confirmation on the GitHub Pages origin. */
(async()=>{"use strict";
const status=document.getElementById("confirmationState");
const title=document.getElementById("confirmationTitle");
const icon=document.getElementById("confirmationIcon");
const query=new URLSearchParams(location.search);
const fragment=new URLSearchParams(location.hash.replace(/^#/,""));
const error=query.get("error_description")||fragment.get("error_description")||query.get("error")||fragment.get("error");
if(error){
 title.textContent="Confirmarea nu a reușit";
 icon.textContent="!";
 status.textContent="Linkul nu a putut fi folosit: "+error+". Revino la autentificare și solicită un nou e-mail.";
 return;
}
if(!window.supabase||!window.BARBERCRAFT_SUPABASE_URL||!window.BARBERCRAFT_SUPABASE_PUBLISHABLE_KEY){
 title.textContent="Nu putem verifica sesiunea";
 status.textContent="Reîncarcă pagina sau conectează-te din aplicație.";
 return;
}
const client=window.supabase.createClient(window.BARBERCRAFT_SUPABASE_URL,window.BARBERCRAFT_SUPABASE_PUBLISHABLE_KEY);
try{
 const {data,error:sessionError}=await client.auth.getSession();
 if(sessionError)throw sessionError;
 const session=data?.session;
 if(!session){
  title.textContent="Verifică autentificarea";
  icon.textContent="✉";
  status.textContent="Linkul te-a adus pe BARBERCRAFT, dar nu avem încă o sesiune activă în acest browser. Dacă ai confirmat e-mailul, autentifică-te din aplicație. Dacă nu, solicită un nou link.";
  return;
 }
 const {data:identity,error:userError}=await client.auth.getUser();
 if(userError||!identity?.user)throw userError||new Error("Sesiunea nu este verificată.");
 const pro=identity.user.user_metadata?.barbercraft_account_type==="professional";
 title.textContent="E-mail confirmat!";
 icon.textContent="✓";
 status.textContent="Contul tău este confirmat. Poți continua în "+(pro?"Portalul PRO":"aplicația BARBERCRAFT")+
  ". Pentru rezervări publice, conturile noi trebuie aprobate și de administrator.";
 // Remove transient auth credentials from visible browser history after Supabase has processed them.
 if(location.hash&&/access_token|refresh_token|error_description/.test(location.hash))
   history.replaceState(null,"",location.pathname);
}catch(e){
 title.textContent="Mai este necesară autentificarea";
 icon.textContent="!";
 status.textContent="Nu am putut finaliza sesiunea: "+e.message+". Deschide aplicația și încearcă să te conectezi.";
}
})();