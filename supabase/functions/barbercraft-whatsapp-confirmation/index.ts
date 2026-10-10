// Scheduled outbox sender. No public browser access or credentials in client code.
// Configure META_WHATSAPP_TOKEN, META_CONFIRMATION_TEMPLATE, META_GRAPH_VERSION,
// WHATSAPP_DISPATCH_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY before enabling a schedule.
const equal = (a: string, b: string) => {
 if (a.length !== b.length) return false;
 let different = 0; for (let i = 0; i < a.length; i++) different |= a.charCodeAt(i) ^ b.charCodeAt(i);
 return different === 0;
};
Deno.serve(async (req: Request) => {
 if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
 const dispatch = Deno.env.get("WHATSAPP_DISPATCH_SECRET");
 if (!dispatch || !equal(req.headers.get("x-dispatch-secret") || "", dispatch)) return new Response("Unauthorized", { status: 401 });
 const token = Deno.env.get("META_WHATSAPP_TOKEN"), template = Deno.env.get("META_CONFIRMATION_TEMPLATE"),
 graph = Deno.env.get("META_GRAPH_VERSION"), url = Deno.env.get("SUPABASE_URL"), key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if (!token || !template || !graph || !/^v\d+\.\d+$/.test(graph) || !url || !key) return new Response("Not configured", { status: 503 });
 const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
 const claim = await fetch(`${url}/rest/v1/rpc/bc_whatsapp_claim`, { method: "POST", headers, body: "{}" });
 if (!claim.ok) return new Response("Queue unavailable", { status: 503 });
 const jobs = await claim.json() as Array<{ id: string; phone: string; salon: string; location: string; start: string; service: string; channel: string }>;
 let sent = 0;
 for (const job of jobs) {
  const when = new Date(job.start);
  const date = when.toLocaleDateString("ro-RO", { timeZone: "Europe/Bucharest" });
  const time = when.toLocaleTimeString("ro-RO", { timeZone: "Europe/Bucharest", hour: "2-digit", minute: "2-digit" });
  let status = "unknown", messageId: string | null = null;
  try {
   const reply = await fetch(`https://graph.facebook.com/${graph}/${encodeURIComponent(job.channel)}/messages`, {
    method: "POST", signal: AbortSignal.timeout(15000),
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to: job.phone.replace(/^\+/, ""), type: "template",
     template: { name: template, language: { code: "ro" }, components: [{ type: "body", parameters:
      [job.salon, date, time, job.location, job.service].map(text => ({ type: "text", text })) }] } })
   });
   // Never automatically retry an ambiguous send: Meta could have accepted it already.
   if (reply.ok) { const body = await reply.json(); messageId = body.messages?.[0]?.id || null; status = messageId ? "sent" : "unknown"; }
   else status = reply.status >= 500 ? "unknown" : "failed";
  } catch { status = "unknown"; }
  const saved = await fetch(`${url}/rest/v1/bc_booking_whatsapp_outbox?booking_id=eq.${encodeURIComponent(job.id)}&status=eq.sending`, {
   method: "PATCH", headers, body: JSON.stringify({ status, meta_message_id: messageId, updated_at: new Date().toISOString() })
  });
  if (!saved.ok) return new Response("Dispatch state unavailable", { status: 503 });
  if (status === "sent") sent++;
 }
 return Response.json({ processed: jobs.length, sent });
});
