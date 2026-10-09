// BARBERCRAFT browser-side Supabase configuration.
// This is a PUBLIC publishable key, never a service_role key.
window.BARBERCRAFT_SUPABASE_URL = "https://zqdsrgamoqcvbmazbwcq.supabase.co";
window.BARBERCRAFT_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_qZs-11TUAf8pn2PUQyudTw_TvyVAL5G";

// Each BARBERCRAFT portal uses independent Supabase Auth storage.
// This prevents a Client sign-in/out from replacing PRO or Admin browser sessions.
window.BARBERCRAFT_SESSION_KEYS = Object.freeze({
 client: "barbercraft-client-session",
 pro: "barbercraft-pro-session",
 admin: "barbercraft-admin-session"
});
const barbercraftClients = new Map();
window.BCAuthClient = function(scope, authOverrides = {}) {
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
 barbercraftClients.set(scope,instance);
 return instance;
};
