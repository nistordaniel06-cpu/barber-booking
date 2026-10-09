/* Same BARBERCRAFT identity from Client or PRO; session never exposed to other users. */
(()=>{
 "use strict";
 let pending=null;
 window.BCPassportSession=()=>pending||(pending=(async()=>{
  const api=window.supabase;
  if(!api||!window.BARBERCRAFT_SUPABASE_URL||!window.BARBERCRAFT_SUPABASE_PUBLISHABLE_KEY)return null;
  const url=window.BARBERCRAFT_SUPABASE_URL,key=window.BARBERCRAFT_SUPABASE_PUBLISHABLE_KEY;
  const client=api.createClient(url,key);
  const pro=api.createClient(url,key,{auth:{storageKey:"barbercraft-pro-session",persistSession:true,
    autoRefreshToken:true,detectSessionInUrl:false}});
  const requestedPro=new URLSearchParams(location.search).get("from")==="pro";
  for(const candidate of requestedPro?[pro,client]:[client,pro]){
   const result=await candidate.auth.getUser();
   if(!result.error&&result.data?.user)return candidate;
  }
  return requestedPro?pro:client;
 })()));
})();
