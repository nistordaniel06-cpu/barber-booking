// Supabase Edge Function: public booking endpoints. Never expose service-role key in browser.
import { createClient } from "npm:@supabase/supabase-js@2";
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const origin = Deno.env.get("BOOKING_ORIGIN") || "https://nistordaniel06-cpu.github.io";
const cors = { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "GET,POST,OPTIONS", "Access-Control-Allow-Headers": "Content-Type, apikey, authorization", "Vary": "Origin", "Content-Type": "application/json" };
function response(payload: unknown,status=200) { return new Response(JSON.stringify(payload),{status,headers:cors}); }
function clock(t:string) { const m=/^([01]\d|2[0-3]):([0-5]\d)$/.exec(t); return m?Number(m[1])*60+Number(m[2]):NaN; }
function hm(x:number) { return String(Math.floor(x/60)).padStart(2,"0")+":"+String(x%60).padStart(2,"0"); }
const slotTimes=["09:00","09:45","10:30","11:15","12:00","13:00","13:45","14:30","15:15","16:00","16:45","17:30","18:15","19:00","19:45"];
Deno.serve(async req=>{
 if(req.method==="OPTIONS") return new Response(null,{headers:cors});
 if(req.headers.get("origin") && req.headers.get("origin")!==origin) return response({status:"error",message:"Origin not allowed"},403);
 try {
 const url=new URL(req.url);
 if(req.method==="GET" && url.searchParams.get("resource")==="services"){
  const {data,error}=await db.from("bc_services").select("id,category,name,duration_min,price,badge,is_active").eq("is_active",true).order("id");
  if(error) throw error; return response({status:"success",data});
 }
 if(req.method==="GET" && url.searchParams.get("resource")==="barbers"){
  const {data,error}=await db.from("bc_barbers").select("id,name,title,avatar_url,rating,experience_years,is_active").eq("is_active",true).order("id");
  if(error) throw error; return response({status:"success",data});
 }
 if(req.method==="GET" && url.searchParams.get("resource")==="slots"){
  const date=url.searchParams.get("date")||"", serviceId=Number(url.searchParams.get("service_id")), barberId=Number(url.searchParams.get("barber_id")||0);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isInteger(serviceId)||!Number.isInteger(barberId)) return response({status:"error",message:"Invalid query"},400);
  const [s,b,a]=await Promise.all([
   db.from("bc_services").select("duration_min").eq("id",serviceId).eq("is_active",true).single(),
   db.from("bc_barbers").select("id").eq("is_active",true).order("id"),
   db.from("bc_appointments").select("barber_id,start_time,end_time").eq("appointment_date",date).eq("status","confirmed")
  ]);
  if(s.error||b.error||a.error||!s.data) return response({status:"error",message:"Unable to load availability"},503);
  const duration=s.data.duration_min, workers=(b.data||[]).filter(x=>barberId===0||x.id===barberId);
  const now=new Date();
  const localNow=new Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/Bucharest",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(now).replace(" ","T");
  const data=slotTimes.map(time=>{
   const start=clock(time),end=start+duration;
   const available=end<=1230 && date+"T"+time>localNow && workers.some(w=>!(a.data||[]).some(x=>x.barber_id===w.id&&start<clock(x.end_time.slice(0,5))&&end>clock(x.start_time.slice(0,5))));
   return {start_time:time,end_time:hm(end),period:start<720?"morning":start<1020?"afternoon":"evening",available};
  });
  return response({status:"success",data});
 }
 if(req.method==="POST" && url.searchParams.get("resource")==="appointments"){
  const raw=await req.text();
  if(raw.length>4000) return response({status:"error",message:"Payload too large"},413);
  let x;try{x=JSON.parse(raw);}catch{return response({status:"error",message:"Invalid JSON"},400);}
  const phone=String(x.client_phone||"").replace(/[\s()-]/g,"");
  const e164=phone.startsWith("0")?"+40"+phone.slice(1):phone.startsWith("40")?"+"+phone:phone;
  if(!/^\+[1-9]\d{7,14}$/.test(e164)||!/^\d{4}-\d{2}-\d{2}$/.test(String(x.appointment_date||""))||!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(x.start_time||""))||
     typeof x.client_name!=="string"||x.client_name.trim().length<2||x.client_name.length>120||
     (x.client_email && (typeof x.client_email!=="string"||x.client_email.length>180))||
     (x.notes && (typeof x.notes!=="string"||x.notes.length>500)))
    return response({status:"error",message:"Verifică datele rezervării."},400);
  const {data,error}=await db.rpc("bc_create_booking",{
   p_name:x.client_name,p_phone:e164,p_email:x.client_email||null,p_barber:Number(x.barber_id)||0,
   p_service:Number(x.service_id),p_date:x.appointment_date,p_start:x.start_time,p_notes:x.notes||""
  });
  if(error){
   const taken=String(error.message).includes("SLOT_TAKEN")||error.code==="23P01";
   const invalid=error.code==="22023";
   return response({status:"error",code:taken?"SLOT_TAKEN":"BOOKING_FAILED",message:taken?"Ora tocmai a fost rezervată. Alege alt interval.":invalid?"Date invalide sau interval indisponibil.":"Rezervarea nu a putut fi procesată."},taken?409:invalid?400:503);
  }
  return response({status:"success",data},201);
 }
 return response({status:"error",message:"Not found"},404);
 }catch(err){console.error("booking endpoint error",err);return response({status:"error",message:"Serviciul de rezervări este indisponibil."},503);}
});
