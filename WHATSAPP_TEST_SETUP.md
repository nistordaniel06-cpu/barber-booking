# WhatsApp Business — test mode (BARBERCRAFT)

## Current state (2026-10-09)
- Supabase Domn contains `bc_whatsapp_channels` and `bc_whatsapp_webhook_events`, protected with tenant-scoped RLS.
- Function `barbercraft-whatsapp-webhook` deployed with **JWT verification enabled** as a safety lock; not yet linked to Meta.
- Endpoint path: `https://zqdsrgamoqcvbmazbwcq.supabase.co/functions/v1/barbercraft-whatsapp-webhook`
- No phone number configured, no outgoing messages, no AI conversation handling.
- This implementation will never access your private WhatsApp account unless you explicitly register and authorize that number.

## Connect a Meta test number
1. Set up a Meta Developers app with the WhatsApp product and get the **Meta-provided test phone number ID** and temporary access token. Never commit the token.
2. Configure `META_APP_SECRET` and a random `META_VERIFY_TOKEN` as Supabase secrets. Keep your Meta app secret private.
3. Test GET challenge, POST signature validation, replay handling, and database insertion. Only then adjust deployment's JWT gating to allow Meta verification calls; POST requests are still cryptographically verified.
4. Provision the test phone number ID in `bc_whatsapp_channels`, linked to a salon you own. Verify ownership before enabling a production channel.
5. Add an authenticated, authorized owner settings flow to provision/change channels, with audit logs and encrypted credentials.
6. Register webhook URL in Meta Developers. Subscribe to messages only after the security tests pass.
7. For outbound messages, use Meta's Cloud API with server-side tokens, compliant message templates, user opt-in, delivery status webhooks and rate limits. Reuse confirmed booking IDs to prevent duplicate notifications.
8. Only add AI booking after confirming available slots on the server and safely handling escalation to a human.

**Security:** Browser code must never contain access tokens, app secrets, service-role keys or webhook verify tokens. Personal WhatsApp messages are outside BARBERCRAFT's scope.

## Remaining work
- Authentication + salon ownership verification.
- Meta test number, credentials and webhook handshake; end-to-end tests.
- Outbound sandbox messaging, message templates and conversation workflow.
- Turnstile/rate limits and abuse protections for public booking.
- Owner UI for channel connections and status.
