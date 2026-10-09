# BARBERCRAFT — Supabase Auth Email Confirmation URL (production)

The client's screenshot shows a default Supabase email that sends them to `localhost`.
This can occur when **Authentication → URL Configuration → Site URL** remains `http://localhost:3000`, or the requested `emailRedirectTo` is missing from the Redirect URLs allowlist.

## Exact dashboard changes (required; cannot be changed from the connected Supabase database tools)

1. Open: https://supabase.com/dashboard/project/zqdsrgamoqcvbmazbwcq/auth/url-configuration
2. Under **Site URL**, replace any `localhost` address with:
   `https://nistordaniel06-cpu.github.io/barber-booking/`
3. In **Redirect URLs**, add the following **exact** URLs (one per entry):
   - `https://nistordaniel06-cpu.github.io/barber-booking/`
   - `https://nistordaniel06-cpu.github.io/barber-booking/professionals.html`
4. Save, then test a freshly issued confirmation message. Do not remove legitimate development redirect URLs if they are still needed locally.

## Code changes in this repository

- `auth-config.js` defines `BARBERCRAFT_AUTH_REDIRECT_CLIENT` and `BARBERCRAFT_AUTH_REDIRECT_PRO` as explicit GitHub Pages HTTPS URLs.
- `index.html` and `professionals.html` reuse these constants instead of embedding alternative values.
- `catalog-booking.js` now passes `options.emailRedirectTo` in sign-up instead of silently falling back to Supabase's Site URL.
- **Retrimite confirmarea e-mailului** uses `supabase.auth.resend({type:"signup",email,options:{emailRedirectTo:...}})`, so an older message with localhost can be replaced **after dashboard changes**. Rate limits still apply.

## Troubleshooting and validation

- Confirmation links already sent **do not change** when Site URL / Redirect URLs are updated. Issue a new signup confirmation using the resend control, after configuring the dashboard.
- Confirmation callbacks normally route to the BARBERCRAFT homepage. Professional registrations route to `professionals.html`.
- New clients will still await **Admin approval** after their email is verified. Email verification and administrative approval are distinct.
- Test with a new client email, open confirmation on phone, ensure the browser reaches `https://nistordaniel06-cpu.github.io/barber-booking/`, and verify account status in **Admin → Clienți**.
- Do not put confirmation tokens, access tokens or passwords in screenshots or chat.
- Optionally customize **Authentication → Email Templates → Confirm signup** later if you want branded copy; changing the template alone does not fix localhost URLs.

References:
- https://supabase.com/docs/guides/auth/redirect-urls
- https://supabase.com/docs/guides/troubleshooting/why-am-i-being-redirected-to-the-wrong-url-when-using-auth-redirectto-option-_vqIeO
