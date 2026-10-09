# BARBERCRAFT — Saloane de explorat → Catalog → Rezervări, cu aprobarea clienților

## Administrator
1. Autentifică-te în `/admin.html#admin-explore`. Intră la **Saloane de explorat**, editează denumire, adresă, servicii, imagini și confirmă dreptul de publicare.
2. Apasă **Importă în Catalog**. Aplicația transferă informațiile într-o singură fișă identificată prin `explore_sample_id`, o publică în Catalog și ascunde versiunea demonstrativă ca să nu apară duplicate. Nu activează automat rezervări.
3. Deschide `/admin.html#admin-catalog`, găsește salonul și apasă **Asociază profilul PRO**; selectează **profilul autentic al salonului**, administrat cu acordul proprietarului. Operațiunea nu transferă proprietatea unei pagini de pe altă platformă și nu permite atribuirea falsă a personalului.
4. Proprietarul/managerul configurează în `/pilot-control.html` tarifele exacte (nu intervale de preț), duratele și programul, activează calendarul pilot și aprobă separat **Acceptă programări publice** pentru profilul asociat. Reasocierea la alt PRO resetează automat acest acord.
5. În `/admin.html#admin-clients`, clienții nou-înregistrați intră la **În așteptare**. Apasă **Aprobă**, **Respinge** sau **Suspendă** (cu motiv pentru acțiuni negative).
6. Clientul se autentifică în `/catalog-booking.html?salon=<catalog-id>`, verifică aprobarea contului, alege serviciul, data și ora, introduce contactul și consimțământul. La confirmare se generează un eveniment real în calendarul PRO, cu blocare server-side a suprapunerilor și cod de rezervare.

## Protecții în sistem
- Conturile preexistente au fost lăsate aprobate; noi înregistrări Auth au status pending prin trigger.
- Doar conturi autentificate și aprobate pot confirma programări **publice din catalog**. Căutarea salonului rămâne publică.
- Informațiile private ale conturilor (ex.: email) sunt citite exclusiv din RPC restricționat la administrator. Moderarea este jurnalizată și conturile de admin nu pot fi dezactivate din lista de clienți.
- Importul din explorare nu creează automat un cont PRO, angajați, program real ori booking activ.
- `bc_catalog_booking_public`, `bc_catalog_booking_slots` și `bc_catalog_booking_create` refolosesc validările existente pentru ore, lock de salon, suprapuneri, limită de 3 rezervări/7 zile/telefon și server-timezone `Europe/Bucharest`.
- Oprirea calendarului proprietarului sau delistarea profilului blochează rezervări publice noi, dar **nu șterge** cele deja confirmate.
- Fluxul privat, pe bază de link și cod secret, de pilot PRO rămâne separat; poate fi folosit de invitați fără cont pentru teste controlate.

## Limite prezente
- Motorul de rezervare publică este conservator: un singur slot simultan per salon, încă **nu multi-frizer**. E necesar un pas ulterior pentru calendar specific fiecărui frizer.
- Contul aprobat nu înseamnă număr de telefon verificat: pentru utilizare comercială extinsă sunt recomandate verificare SMS, protecție anti-spam, notificări/confirmări, politici GDPR, gestionarea anulărilor și flux de dispute.
- Salonul trebuie să-și confirme serviciile, prețurile, orarul, reprezentarea legitimă și toate datele înainte de activare.
- Sistemul nu acordă automat XP, recompense sau puncte pentru o rezervare nefinalizată.
- Testele automate validează codul, integrarea RPC-urilor și verificări de bază. Un test cu conturile reale ale unui administrator, proprietar și client pe telefon trebuie făcut înainte de lansare publică.

## QA
- Supabase migration aplicată; conturile Auth deja existente păstrate.
- Flux tranzacțional `BEGIN...ROLLBACK` verificat: import → asociere PRO → activare owner → client în așteptare refuzat → client aprobat rezervare confirmată. Rollback, fără date fictive persistate.
- După test, verificat: catalog_profiles=0, public_bookable=0, fake_bookings=0, fake_calendar=0, pending_clients=0.
- GitHub Actions: `tests/barbercraft-explore-public-booking-approvals-smoke.mjs` + suita completă.
