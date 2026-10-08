## Status actual — Supabase Domn (9 octombrie 2026)

- Proiect selectat: `Domn` (`zqdsrgamoqcvbmazbwcq`, Europa de Vest).
- Migrarea aplicată cu succes; `bc_barbers`, `bc_services`, `bc_appointments` există.
- Sunt introduși **3 frizeri demo** și **7 servicii demo**. Nicio rezervare de test nu a rămas salvată.
- Edge Function `barbercraft-booking` este deployed cu `verify_jwt=true` pentru a preveni accesul public înainte de instalarea protecției anti-abuz.
- URL backend: `https://zqdsrgamoqcvbmazbwcq.supabase.co/functions/v1/barbercraft-booking`.
- `booking-config.js` este intenționat neconfigurat: accesul anonim nu este încă activ. **Nu se pot efectua rezervări reale publice încă.**
- A fost executat un test SQL de rezervare suprapusă într-o tranzacție cu ROLLBACK, fără păstrarea datelor test.
- Următorul pas: CAPTCHA + limitare cereri pentru booking public, verificare flux mobil și dashboard admin autentificat. Nu se activează public fără acestea.

# BARBERCRAFT — Backend real pentru rezervări

Acest branch pregătește fluxul existent de rezervare pentru PostgreSQL/Supabase și îmbunătățește afișarea pe mobil. **Nu este încă activ în producție.**

## Activare

1. Alege un proiect Supabase (folosește proiectul Domn).
2. Rulează `supabase/migrations/20261009_barbercraft_bookings.sql` în proiectul ales.
3. Deploy `supabase/functions/booking/index.ts` cu numele `barbercraft-booking`; configurația implicită a funcției este momentan setată la `verify_jwt=true` până la implementarea protecției anti-abuz. Acest mod necesită protecții suplimentare înainte de trafic public.
4. Configurează `BOOKING_ORIGIN=https://nistordaniel06-cpu.github.io` în secretele Edge Function. Cheia `SUPABASE_SERVICE_ROLE_KEY` este **doar pe server**.
5. Setează `window.BARBERCRAFT_BOOKING_API` în `booking-config.js` la URL-ul funcției, de forma `https://PROJECT.supabase.co/functions/v1/booking`.
6. Testează într-un deployment de staging; apoi publică pe GitHub Pages.

## Comportament

- Selectarea serviciului/frizerului este păstrată.
- Orele disponibile sunt calculate pe server, verificând intervalele ocupate.
- Inserția este atomică; constrângerea PostgreSQL exclude rezervări suprapuse, inclusiv pentru servicii cu durate diferite.
- Dacă serverul este oprit sau neconfigurat, clientul **nu primește confirmare falsă**.
- Numerele de telefon sunt normalizate pentru România către E.164.
- Aplicația folosește momentan date demo pentru servicii și frizeri când endpointul nu e configurat; nu poate confirma rezervări în acest mod.
- Rezervările walk-in folosesc același backend.

## Important înainte de producție

- Activează limitarea cererilor, CAPTCHA/Turnstile și protecție anti-spam pentru endpointul public. CORS **nu** este mecanism de autentificare.
- Dashboardul administrativ actual necesită un API securizat separat și autentificare cu roluri. Nu expune lista clienților prin API-ul public.
- Google Calendar OAuth bidirecțional și notificările WhatsApp Cloud API **nu sunt implementate** în acest branch; linkurile de calendar/WhatsApp existente nu sunt sincronizare reală.
- Pozele, numele, ratingurile și serviciile preîncărcate sunt de demonstrație și trebuie înlocuite cu datele salonului înainte de lansare.
- Verifică politicile GDPR, retenția datelor și acordul pentru notificări.

## Scenarii de testare obligatorii

1. Client A confirmă un serviciu 45 min la 11:15; client B nu poate confirma 11:30 cu același frizer.
2. Doi clienți confirmă simultan același interval — cel mult unul reușește.
3. Clientul nu poate confirma un interval trecut sau în afara programului.
4. Selectarea „Oricare disponibil” alege un frizer liber.
5. La indisponibilitatea serverului, butonul nu emite cod fals de rezervare.
6. Verifică utilizarea pe 360px, 390px și 430px, inclusiv tastatura.

Nu considera aplicația gata de producție până când verificările de mai sus și testele end-to-end nu au trecut.
