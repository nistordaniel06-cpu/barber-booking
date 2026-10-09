# Supabase Auth → URL Configuration pentru BARBERCRAFT

## Acțiune necesară în dashboard (necesită acces la configurația Auth)

Deschide: https://supabase.com/dashboard/project/zqdsrgamoqcvbmazbwcq/auth/url-configuration

1. **Site URL**: `https://nistordaniel06-cpu.github.io/barber-booking/` (înlocuiește `http://localhost:3000` sau orice alt localhost).
2. **Redirect URLs**: adaugă, separat:
   - `https://nistordaniel06-cpu.github.io/barber-booking/`
   - `https://nistordaniel06-cpu.github.io/barber-booking/professionals.html`
   - `https://nistordaniel06-cpu.github.io/barber-booking/catalog-booking.html**`

Ultima regulă permite și parametrii `?salon=<id>` folosiți de formularul de rezervare.
Salvează setările. Modificarea acestor configurări nu este disponibilă în instrumentele Supabase conectate în această conversație și **nu poate fi făcută printr-o migrare SQL obișnuită**.

## Ce este implementat în cod

- Homepage-ul folosește emailRedirectTo spre `https://nistordaniel06-cpu.github.io/barber-booking/`.
- Pagina PRO folosește emailRedirectTo spre `https://nistordaniel06-cpu.github.io/barber-booking/professionals.html`.
- Înscrierea din Catalog folosește emailRedirectTo spre pagina `catalog-booking.html?salon=...` pentru întoarcerea la salon.
- **Retrimite e-mailul de confirmare** în Catalog cere un nou mesaj Supabase cu aceeași destinație GitHub. E-mailurile deja trimise nu își schimbă linkul.

## Test pe telefon

1. Actualizează URL Configuration în Supabase mai întâi.
2. Intră pe GitHub Pages, deschide profilul unui salon activ și înregistrează un cont de client nou.
3. Deschide e-mailul nou, apasă **Confirm email address** și verifică adresa din browser: trebuie să înceapă cu `https://nistordaniel06-cpu.github.io/barber-booking/`, nu `http://localhost`.
4. Clientul confirmat va rămâne „În așteptare” până când administratorul îi aprobă contul în **Admin → Clienți**.
5. Pentru e-mailurile vechi, după actualizarea dashboard-ului, în formularul de rezervare introdu adresa și apasă **Retrimite e-mailul de confirmare**. Respectă limitarea de frecvență Supabase.

Nu trimite în mesaje/chat URL-uri de confirmare ce conțin tokenuri sau coduri.

Documentație oficială:
- https://supabase.com/docs/guides/auth/redirect-urls
- https://supabase.com/docs/guides/troubleshooting/why-am-i-being-redirected-to-the-wrong-url-when-using-auth-redirectto-option-_vqIeO
