// BARBERCRAFT browser-side Supabase configuration.
// This is a PUBLIC publishable key, never a service_role key.
window.BARBERCRAFT_SUPABASE_URL = "https://zqdsrgamoqcvbmazbwcq.supabase.co";
window.BARBERCRAFT_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_qZs-11TUAf8pn2PUQyudTw_TvyVAL5G";

// Three distinct applications on GitHub Pages. Sessions are deliberately
// namespaced and rotated away from earlier shared-browser logins.
window.BARBERCRAFT_PORTAL_PATHS=Object.freeze({
 client:"./client/",
 pro:"./pro/",
 admin:"./admin/"
});
window.BARBERCRAFT_SESSION_KEYS=Object.freeze({
 client:"barbercraft-client-isolated-v3",
 pro:"barbercraft-pro-isolated-v3",
 admin:"barbercraft-admin-isolated-v3"
});
const legacySessionKeys=[
 "barbercraft-client-session","barbercraft-pro-session","barbercraft-admin-session"
];
for(const key of legacySessionKeys){
 try{window.localStorage.removeItem(key);window.sessionStorage.removeItem(key);}catch(_){}
}
window.BCCommitPortalLogin=function(scope){
 if(!window.BARBERCRAFT_SESSION_KEYS[scope])throw new Error("Invalid portal");
 // A new explicit login makes all other portal sessions log out, including
 // earlier accounts left open on the same Android browser.
 for(const [portal,key] of Object.entries(window.BARBERCRAFT_SESSION_KEYS)){
  if(portal===scope)continue;
  try{window.localStorage.removeItem(key);window.sessionStorage.removeItem(key);}catch(_){}
 }
 try{window.localStorage.setItem("barbercraft-active-portal",scope+":"+Date.now());}catch(_){}
};
const barbercraftClients=new Map();
window.BCAuthClient=function(scope,authOverrides={}){
 const storageKey=window.BARBERCRAFT_SESSION_KEYS[scope];
 if(!storageKey)throw new Error("Invalid BARBERCRAFT portal");
 if(!window.supabase||!window.BARBERCRAFT_SUPABASE_URL||!window.BARBERCRAFT_SUPABASE_PUBLISHABLE_KEY)return null;
 if(barbercraftClients.has(scope))return barbercraftClients.get(scope);
 const instance=window.supabase.createClient(
  window.BARBERCRAFT_SUPABASE_URL,window.BARBERCRAFT_SUPABASE_PUBLISHABLE_KEY,
  {auth:{
   storageKey,
   persistSession:true,
   autoRefreshToken:true,
   detectSessionInUrl:scope!=="admin",
   ...authOverrides
  }}
 );
 window.addEventListener("storage",event=>{
  if(event.key!=="barbercraft-active-portal"||!event.newValue)return;
  const active=event.newValue.split(":")[0];
  if(active!==scope&&window.BARBERCRAFT_SESSION_KEYS[active]){
   void instance.auth.signOut({scope:"local"});
  }
 });
 barbercraftClients.set(scope,instance);
 return instance;
};
