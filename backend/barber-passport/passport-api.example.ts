/**
 * BARBERCRAFT / Barber Passport — authenticated Node + Express route.
 * All XP is assigned by a Postgres AFTER INSERT trigger, not by the browser.
 */
import type { Request, Response } from "express";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const bodySchema = z.object({checkinId:z.string().uuid()}).strict();
function userClient(token: string) {
 return createClient(process.env.SUPABASE_URL!,process.env.SUPABASE_ANON_KEY!,{
  global:{headers:{Authorization:"Bearer "+token}},
  auth:{persistSession:false,autoRefreshToken:false}
 });
}
export async function barberPassportCompleteVisit(req: Request,res: Response) {
 const parsed=bodySchema.safeParse(req.body);
 if(!parsed.success)return res.status(400).json({error:"INVALID_CHECKIN"});
 const token=req.headers.authorization?.match(/^Bearer ([^. ]+\.[^. ]+\.[^. ]+)$/)?.[1];
 if(!token)return res.status(401).json({error:"AUTH_REQUIRED"});
 const sb=userClient(token);
 const {data:{user},error:authError}=await sb.auth.getUser(token);
 if(authError||!user)return res.status(401).json({error:"AUTH_REQUIRED"});
 // Existing SQL RPC checks current JWT user is an authorized salon member,
 // locks the check-in, and rejects duplicate or expired service completion.
 const {data,error}=await sb.rpc("bc_service_visit_complete",{p_checkin:parsed.data.checkinId});
 if(error){
  const rejected=/NOT_SALON_STAFF|CHECKIN_EXPIRED|ALREADY_COMPLETED|ALREADY_VERIFIED_TODAY/.test(error.message);
  return res.status(rejected?409:500).json({
    error:rejected?"CHECKIN_NOT_COMPLETABLE":"VISIT_COMPLETION_FAILED"
  });
 }
 return res.status(200).json({ok:true,visitId:data.visit_id,
    passportProgress:"updated_transactionally"});
}
export async function barberPassportMyProgress(req: Request,res: Response){
 const token=req.headers.authorization?.match(/^Bearer ([^. ]+\.[^. ]+\.[^. ]+)$/)?.[1];
 if(!token)return res.status(401).json({error:"AUTH_REQUIRED"});
 const sb=userClient(token);
 const {data,error}=await sb.rpc("bc_passport_my_progress");
 if(error)return res.status(403).json({error:"PASSPORT_ACCESS_DENIED"});
 return res.json(data);
}
