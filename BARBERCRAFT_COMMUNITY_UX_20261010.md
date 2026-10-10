# Barbercraft · comunitate și simplificare UX

Favoritele au două liste, Saloane și Frizeri, cu număr public de aprecieri. Clienții nu pot fi salvați la favorite. Prietenia folosește relația reciprocă existentă: o cerere devine prietenie când destinatarul o acceptă. Blocarea și permisiunile de mesagerie rămân aplicate pe server. Prezența este reală, cu heartbeat la 30 secunde și expirare după 75 secunde; conversația deschisă se actualizează la 4 secunde.

Rangurile folosesc exclusiv vizite validate: Bronz 1/2/3 la 3/6/9, Silver 1/2/3 la 12/18/24, Gold 1/2/3 la 30/40/50, Premium la 65 și Platinum la 80. Progresul până la următorul rang și insignele apar în galerie, profil public și Passport. Etichetarea @salon oferă sugestii și linkuri interne.

Homepage-ul pierde filtrele vechi și întreaga secțiune Servicii speciale. Contul grupează Passport și notificările; portofelul păstrează ✂️ Barber Pass. Navigația Passport folosește aceleași patru destinații ca portalul clientului. Asistentul rămâne fix deasupra Contul meu, se minimizează prin click în exterior sau Escape și are X și clopoțel mute. Meniul și ferestrele calendarului/programului folosesc X. Agenda PRO listează clienții din rezervări și clienții importați, cu acces limitat la salon și specialist.

## Calendar și WhatsApp

Sync Calendar creează un eveniment .ics din rezervarea confirmată și folosește partajarea nativă când telefonul o permite, altfel descarcă fișierul pentru import. Browserul nu poate scrie automat în calendarul telefonului fără confirmarea utilizatorului și nu oferă sincronizare bidirecțională a modificărilor.

Confirmarea WhatsApp este amânată la cererea utilizatorului: formularul nu oferă opt-in și frontend-ul nu apelează outbox-ul. La activarea ulterioară va necesita opt-in la rezervare și un canal activ în bc_whatsapp_channels. Outbox-ul și funcția barbercraft-whatsapp-confirmation sunt instalate în proiectul Supabase zqdsrgamoqcvbmazbwcq. Nu s-au trimis mesaje de test și nu s-a activat un scheduler.

Pentru activare, configurați secretele serverului META_WHATSAPP_TOKEN, META_CONFIRMATION_TEMPLATE (template aprobat cu cinci parametri: salon, dată, oră, locație, serviciu), META_GRAPH_VERSION și WHATSAPP_DISPATCH_SECRET. Programați un POST către funcția Edge cu header x-dispatch-secret, păstrând secretul în Vault/server, niciodată în frontend. SUPABASE_URL și SUPABASE_SERVICE_ROLE_KEY sunt furnizate de runtime. Rezultatele ambigue nu sunt retrimise automat pentru a evita duplicatele; verificați mesajul la Meta înainte de reprogramare.

## Validare și publicare

Migrația 20261010022721_community_favorites_presence.sql a fost aplicată în Supabase. Testele SQL au verificat idempotența favoritelor, refuzul favoritelor de tip client, accesul anonim limitat, prezența, prietenii, rangurile și agenda salonului; fixture-urile au fost anulate cu ROLLBACK.

Cele 29 de teste Node verifică fluxurile existente și comportamentul noilor ranguri, inimilor, asistentului și exportului calendarului. Verificarea vizuală în browser nu a fost posibilă în mediul curent (socket/Chromium restricționate). Frontend-ul este livrat prin PR și necesită integrarea/publicarea normală a repository-ului.
