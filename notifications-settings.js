(()=>{"use strict";
const $=id=>document.getElementById(id),status=$("bcPushStatus");
const KEY=window.BARBERCRAFT_VAPID_PUBLIC_KEY||null;
const supported=("serviceWorker" in navigator)&&("Notification" in window);
function encodedKey(base64){
 const padded=base64.replace(/-/g,"+").replace(/_/g,"/");
 const raw=atob(padded+"=".repeat((4-padded.length%4)%4));
 return Uint8Array.from(raw,ch=>ch.charCodeAt(0));
}
async function register(){
 if(!supported)throw new Error("Browserul nu acceptă notificări Web Push.");
 return await navigator.serviceWorker.register("./bc-service-worker.js",{scope:"./"});
}
$("bcPushEnable").onclick=async()=>{
 try{
  if(!supported)throw new Error("Chrome nu permite Web Push în acest mod.");
  const state=await Notification.requestPermission();
  if(state!=="granted")throw new Error("Permisiunea nu a fost acordată. O poți schimba din setările browserului.");
  const registration=await register();
  if(!KEY){status.textContent="Permisiunea pentru notificări este activă. Pentru alerte reale din fundal mai trebuie conectată cheia serverului Web Push.";return;}
  const subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:encodedKey(KEY)});
  const sb=window.BCAuthClient?.("client")||window.BCAuthClient?.("pro");
  if(!sb){status.textContent="Permisiune activă. Conectează-te în cont pentru a lega telefonul de notificări.";return}
  const {data:{user}}=await sb.auth.getUser();
  if(!user){status.textContent="Permisiune activă. Conectează-te pentru salvarea abonării.";return}
  const {error}=await sb.rpc("bc_push_save_subscription",{p_subscription:subscription.toJSON()});
  if(error)throw error;
  status.textContent="Telefonul este înregistrat pentru notificări. Trimiterea serverului trebuie să fie configurată.";
 }catch(e){status.textContent="Nu am putut activa: "+e.message}
};
$("bcPushTest").onclick=async()=>{
 try{
  if(!supported||Notification.permission!=="granted")throw new Error("Activează mai întâi permisiunea din browser.");
  const registration=await register();
  await registration.showNotification("BARBERCRAFT · Test",{body:"Telefonul poate afișa notificări web.",tag:"bc-test"});
  status.textContent="Notificarea de test a fost afișată.";
 }catch(e){status.textContent=e.message}
};
status.textContent=!supported?"Acest browser nu suportă Web Push.":"Stare permisiune: "+Notification.permission;
})();