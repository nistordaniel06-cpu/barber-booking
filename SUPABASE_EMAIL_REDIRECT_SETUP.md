# BARBERCRAFT — confirmarea e-mailului trebuie să revină pe GitHub Pages

## Ce am corectat în aplicație
- În pagina de rezervări a clientului (`catalog-booking.js`), `auth.signUp()` transmite acum **explicit** `options.emailRedirectTo` către `https://nistordaniel06-cpu.github.io/barber-booking/catalog-booking.html?salon=<uuid-valid>`. Înregistrarea păstrează salonul din care a pornit clientul, fără a trece prin localhost.
- Formularul de înregistrare din homepage trimite deja `emailRedirectTo=https://nistordaniel06-cpu.github.io/barber-booking/`, iar formularul PRO trimite deja la `/barber-booking/professionals.html`.
- `social.html` / `social.css`: am reparat cele două checkboxuri public/mesaje din Social Passport (selectoare specifice, lățime/înălțime fixă 22px, rânduri responsive).

## IMPORTANT: configurația proiectului Supabase trebuie verificată manual o singură dată
Conectorul Supabase disponibil în ChatGPT gestionează SQL, migrații, funcții etc., dar nu expune modificarea **Auth → URL Configuration**. Schimbarea de mai jos nu se poate face din SQL.
1. Intră la **https://supabase.com/dashboard/project/zqdsrgamoqcvbmazbwcq/auth/url-configuration**
2. La **Site URL**, înlocuiește **orice localhost** cu:
   `https://nistordaniel06-cpu.github.io/barber-booking/`
3. În **Redirect URLs**, păstrează/adaugă:
   - `https://nistordaniel06-cpu.github.io/barber-booking/`
   - `https://nistordaniel06-cpu.github.io/barber-booking/professionals.html`
   - `https://nistordaniel06-cpu.github.io/barber-booking/**` (permite și `catalog-booking.html?salon=...`)
4. Salvează. Nu adăuga domenii necunoscute în allowlist. Dacă nu folosești localhost pentru dezvoltare, îl poți scoate dintre adresele permise.
5. Folosește **o nouă înregistrare cu adresă de test** sau retrimite emailul de verificare dacă îl ai disponibil. Emailurile trimise anterior pot conține un redirect deja generat către localhost: ele nu se rescriu retroactiv.

## Cum verifici pe telefon
1. Deschide `https://nistordaniel06-cpu.github.io/barber-booking/`.
2. Creează un cont nou de client din aplicație; deschide mesajul nou „Confirm your email address”.
3. Apasă linkul „Confirm email address”. URL-ul final ar trebui să fie pe `nistordaniel06-cpu.github.io/barber-booking/` sau pe pagina de rezervare cu parametrul salon, **nu localhost**.
4. Revino la Admin → Clienți și aprobă contul nou; autentificarea cu cont confirmat va permite apoi programarea la un salon cu rezervări publice activate.
5. Pe telefon, deschide Comunitate → Profilul meu → verifică cele două opțiuni de confidențialitate din Pașaportul Social PRO: casetele trebuie să fie complet vizibile și să poată fi bifate independent.

## Securitate și observații
- Confirmarea adresei de e-mail și aprobarea de către administrator sunt **două etape diferite**. Linkul de confirmare nu aprobă automat contul.
- Nu partaja linkurile brute de confirmare: ele pot conține tokenuri de autentificare.
- Nu modificăm sau ștergem conturile, verificările ori sesiunile existente.
- Pentru template-uri de email de marcă BARBERCRAFT, personalizarea se face separat în Supabase → Auth → Email Templates.

## Retrimitere pentru clienții care au primit deja link spre localhost
- **Client → Cont personal**: introduce e-mailul și apasă **Retrimite e-mailul de confirmare**.
- **Catalog → Autentificare**: introduce e-mailul și apasă **Retrimite confirmarea**. Linkul nou păstrează identificatorul salonului.
- **PRO → Autentificare**: introduce e-mailul profesional și apasă **Retrimite confirmarea**. Revine la pagina de autentificare PRO.
- Toate folosesc `supabase.auth.resend({type:"signup",email,options:{emailRedirectTo:...}})` cu URL de producție. Supabase poate impune limite de frecvență la retrimitere.
- **Important:** retrimite e-mailul **după** ce Site URL și allowed Redirect URLs sunt salvate în Dashboard; altfel Supabase poate continua să folosească adresa implicită.
