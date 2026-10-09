# BARBERCRAFT — corectarea redirectării e-mailurilor Supabase (GitHub Pages)

## Adresele de producție
**Project ID Supabase:** `zqdsrgamoqcvbmazbwcq`

**Site URL (Supabase Auth → URL Configuration)**
```
https://nistordaniel06-cpu.github.io/barber-booking/
```

**Redirect URLs – introdu EXACT aceste 3 adrese**
```
https://nistordaniel06-cpu.github.io/barber-booking/
https://nistordaniel06-cpu.github.io/barber-booking/auth-confirmed.html
https://nistordaniel06-cpu.github.io/barber-booking/professionals.html
```

**Setările din Supabase Dashboard trebuie salvate manual** în `Authentication → URL Configuration`. Conectorul Supabase disponibil proiectului permite SQL/migrații, dar **nu oferă operație de editare Auth Site URL sau lista Redirect URLs**. Setarea nu poate fi schimbată prin migrație SQL și nu este suficient doar să modificăm pagina GitHub.

După salvare:
1. Testează o înregistrare nouă cu e-mail de probă real.
2. Apasă „Confirm email address” din mesaj; redirecționarea va fi către `auth-confirmed.html` pentru clienți sau `professionals.html` pentru PRO.
3. Conturile de client necesită în continuare aprobare administrativă pentru rezervările publice. Confirmarea e-mailului **nu aprobă automat clientul**.
4. Pentru e-mailuri primite ÎNAINTE de corecție, folosește butonul **„Retrimite e-mailul de confirmare”** din Cont client, Catalog sau PRO. Un link emis deja cu `redirect_to=localhost` poate păstra vechea destinație.
5. Dacă folosești un șablon email modificat care concatenează `{{ .SiteURL }}` într-un URL hardcodat, revizuiește-l. Pentru confirmările standard păstrează `{{ .ConfirmationURL }}` ca destinație a butonului de confirmare. Supabase gestionează tokenul și redirectarea. Nu înlocui acel URL cu o legătură directă simplă spre aplicație.

## Modificări implementate în GitHub
- `auth-config.js`: constantele publice `BARBERCRAFT_SITE_URL` și `BARBERCRAFT_AUTH_CONFIRM_URL`.
- `index.html` și `catalog-booking.js`: `emailRedirectTo` explicit către confirmarea BARBERCRAFT.
- `professionals.html`: `emailRedirectTo` către Portal PRO; sesiunea profesională rămâne izolată.
- `auth-confirmed.html` / `auth-confirmed.js`: pagină de confirmare cu erori explicite, verificarea identității și navigare în Cont client / Portal PRO.
- Butoane de retrimitere în client, Catalog și PRO.
- `social.html` / `social.css`: opțiunile profil public și mesaje reciproce au switch-uri responsive 44 × 26px cu text pe mai multe rânduri.

## Verificări înainte de distribuirea către clienți
- GitHub Pages deployment se finalizează.
- Site URL și allowed redirect list actualizate și SALVATE în Supabase Auth (pas manual obligatoriu).
- E-mail nou de confirmare → GitHub Pages, NU localhost.
- Clientul apare în „Admin → Clienți”, primește aprobarea și poate folosi rezervările publice activate de PRO.
- Profilul social din Portal PRO la 320/375px: ambele comutatoare complet vizibile, activate/dezactivate și valorile sunt salvate după refresh.

Documentație oficială: https://supabase.com/docs/guides/auth/redirect-urls
