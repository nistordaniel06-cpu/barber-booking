// WhatsApp Cloud API webhook, intended to be deployed only after setting secrets.
// Required: META_APP_SECRET, META_VERIFY_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
// Do not disable JWT until both signature verification and Meta configuration are tested.
import { createClient } from "npm:@supabase/supabase-js@2";
const encoder=new TextEncoder();
const toHex=(buf:ArrayBuffer)=>Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,"0")).join("");
const equal=(a:string,b:string)=>{if(a.length!==b.length)return false;let v=0;for(let i=0;i<a.length;i++)v|=a.charCodeAt(i)^b.charCodeAt(i);return v===0};
async function validSignature(raw:string, header:string|null, secret:string){
 if(!header||!header.startsWith("sha256="))return false;
 const key=await crypto.subtle.importKey("raw",encoder.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 const mac=toHex(await crypto.subtle.sign("HMAC",key,encoder.encode(raw)));
 return equal(header.slice(7).toLowerCase(),mac);
}
Deno.serve(async req=>{
 const secret=Deno.env.get("META_APP_SECRET");
 const token=Deno.env.get("META_VERIFY_TOKEN");
 if(!secret||!token)return new Response("Not configured",{status:503});
 if(req.method==="GET"){
  const u=new URL(req.url);
  if(u.searchParams.get("hub.mode")==="subscribe"&&u.searchParams.get("hub.verify_token")===token){
    return new Response(u.searchParams.get("hub.challenge")||"",{status:200,headers:{"Content-Type":"text/plain"}});
  }
  return new Response("Forbidden",{status:403});
 }
 if(req.method!=="POST")return new Response("Method not allowed",{status:405});
 const raw=await req.text();
 if(raw.length>1024*256)return new Response("Too large",{status:413});
 if(!(await validSignature(raw,req.headers.get("x-hub-signature-256"),secret)))return new Response("Unauthorized",{status:401});
 let body:unknown;try{body=JSON.parse(raw)}catch{return new Response("Bad request",{status:400})}
 const payload=body as {entry?:Array<{changes?:Array<{value?:{metadata?:{phone_number_id?:string},messages?:Array<{id?:string,from?:string,type?:string,text?:{body?:string}}>} }>}>};
 const rows: {meta_phone_number_id:string;message_id:string;sender_phone:string;message_type:string;text_body:string|null}[]=[];
 for(const entry of payload.entry||[])for(const change of entry.changes||[]){
  const id=change.value?.metadata?.phone_number_id;
  if(!id)continue;
  for(const m of change.value?.messages||[])if(m.id&&m.from){
   rows.push({meta_phone_number_id:id,message_id:m.id,sender_phone:m.from,message_type:m.type||"unknown",text_body:m.type==="text"?(m.text?.body||"").slice(0,2000):null});
  }
 }
 const db=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false}});
 for(const row of rows){
  const {data:channel,error:findError}=await db.from("bc_whatsapp_channels").select("id,enabled").eq("meta_phone_number_id",row.meta_phone_number_id).maybeSingle();
  if(findError)return new Response("Retry",{status:503});
  if(!channel?.enabled)continue; // personal phone or unknown number never auto-routed
  const {error}=await db.from("bc_whatsapp_webhook_events").upsert({channel_id:channel.id,meta_message_id:row.message_id,sender_phone:row.sender_phone,message_type:row.message_type,text_body:row.text_body},{onConflict:"meta_message_id",ignoreDuplicates:true});
  if(error)return new Response("Retry",{status:503});
 }
 // Deliberately no outgoing messages or AI decisions in sandbox receiver.
 return new Response("EVENT_RECEIVED",{status:200});
});
