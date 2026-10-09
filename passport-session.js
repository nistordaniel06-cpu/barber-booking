/* Shared client/PRO session for BARBERCRAFT Passports and social profiles. */
(()=>{
"use strict";
let pending=null;
async function resolveSession(){
 const api=window.supabase;
 if(!api||!window.BARBERCRAFT_SUPABASE_URL||!window.BARBERCRAFT_SUPABASE_PUBLISHABLE_KEY)return null;
 const url=window.BARBERCRAFT_SUPABASE_URL,key=window.BARBERCRAFT_SUPABASE_PUBLISHABLE_KEY;
 const client=api.createClient(url,key);
 const pro=api.createClient(url,key,{auth:{
  storageKey:"barbercraft-pro-session",persistSession:true,autoRefreshToken:true,detectSessionInUrl:false
 }});
 const preferPro=new URLSearchParams(location.search).get("from")==="pro";
 for(const current of preferPro?[pro,client]:[client,pro]){
  const {data,error}=await current.auth.getUser();
  if(!error&&data?.user)return current;
 }
 return preferPro?pro:client;
}
window.BCPassportSession=()=>pending||(pending=resolveSession());
})();