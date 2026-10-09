# BARBERCRAFT — test real cu clienții 4MEN

## Acum disponibil în repo
- **Admin → Importuri externe**: „Publică în aplicație”, aprobare sau respingere draft, **„Șterge importul”**. Ștergerea este limitată la tabelul de import și copia publică neasociată. Un profil asociat unui salon PRO se detașează, fără a șterge salonul real sau programările. Auditul acțiunii rămâne.
- **PRO → Testează cu clienții** (sau Admin → Testează cu clienții 4MEN): `pilot-control.html?from=pro`.
- **Link privat pentru clienți**: `pilot.html?salon=<salon_uuid>&invite=<cod_aleator>`. Acest link devine valid doar după activarea pilotului de către proprietarul/managerul autentificat.
- **Servicii și prețuri reale introduse de proprietar**; nu sunt populate artificial din MERO. Maximum 12 servicii. Durate 15–120 de minute, intervale la 30 minute.
- **Confirmare rezervări**: pachetul verifică disponibilitatea pe server și blochează suprapunerile din calendarul PRO. Rezervarea confirmată creează un eveniment real `bc_pro_calendar_events` și returnează un cod. Nu trimite automat SMS sau email.
- **Evaluare UX**: după rezervare clientul poate raporta cum a mers (1–5 stele + observație); doar echipa salonului vede feedback-ul în pagina pilot.
- **Fără cont obligatoriu pentru client**, dar invitatul trebuie să aibă linkul. Numărul de telefon este folosit exclusiv pentru rezervare, iar acceptarea în formular este obligatorie. Pentru un deployment public fără invitație ar mai trebui protecție anti-spam/SMS verificare și politici de retenție.
- Competiții, XP, puncte, QR check-in și recompense nu se acordă automat pentru aceste rezervări pilot.

## Pașii recomandati pentru un test complet
1. Intră la `https://nistordaniel06-cpu.github.io/barber-booking/professionals.html` și autentifică-te ca proprietar 4MEN. Deschide „Testează cu clienții”.
2. Selectează **4MEN** (nu „4MEN Lujerului — WhatsApp sandbox”). Adaugă 2–3 servicii, tarifele și duratele efective. Configurează orele de test (de ex. 10:00–19:00), și salvează cu pilotul **dezactivat**.
3. Bifează **Acceptă programări pilot**, apoi salvează din nou. Confirmă că accepți rezervări reale. Apasă **Copiază linkul**. Nu există link public activ înainte de această acțiune.
4. Trimite linkul mai întâi unui singur client de încredere sau testează-l din alt browser/telefon. Acesta alege serviciul, data și o oră disponibilă, completează numele și telefonul și confirmă.
5. Clientul salvează codul BARBERCRAFT. Tu deschizi **Calendar PRO** și verifici că evenimentul apare. Verifică și `pilot-control.html` → Programări primite.
6. Clientul trimite un scurt feedback în pagina confirmării. Tu îl vezi la „Feedback de la clienții care s-au programat”.
7. Dacă funcționează, invită progresiv 5–10 clienți, nu tot salonul deodată. Dacă apare orice problemă, debifează pilotul și salvează — oprește **rezervările noi**, dar nu anulează programările deja confirmate.

## Reguli operaționale importante
- „Rezervarea este reală” înseamnă că se ocupă în agenda PRO, nu doar în simulare. Nu distribui linkul până când ești pregătit să accepți clienții.
- Constrângerea conservatoare: o singură programare simultană în salon pentru acest pilot. Suportul avansat pentru frizerii multipli și calendare individuale necesită o etapă separată.
- Orele disponibile sunt calculate pentru următoarele 14 zile; trebuie să existe cel puțin 45 minute înainte de început. Maximum 3 rezervări confirmate în 7 zile pentru același telefon, per salon.
- Oprirea pilotului invalidează posibilitatea unor noi rezervări, dar nu modifică programările deja create.
- Rotirea linkului anulează codul vechi. Clienții trebuie să primească noul link.
- Datele personale sunt disponibile numai proprietarilor/managerilor autorizați în pagina pilot și în calendarul PRO existent. Pentru lansare mai largă trebuie stabilite reguli operaționale de anulare, retenție și ștergere a datelor.
- Nu au fost activate pilotul sau tarifele în producție de către această actualizare; utilizatorul controlează activarea.

## Teste executate
- Test tranzacțional de DB: activare temporară, verificarea sloturilor, rezervare efectivă, feedback, **ROLLBACK** complet. Au rezultat `booking_confirmed=true` și `feedback_saved=true`.
- Verificare ulterioară: nicio programare de test, nicio configurare de pilot activă.
- Ștergerea de import a fost testată tranzacțional cu cont admin: `deleted=true`, urmată de `ROLLBACK`. Importul existent rămâne, pentru ca proprietarul să decidă ștergerea.
- GitHub CI: `node tests/barbercraft-pilot-import-smoke.mjs` plus suita existentă.
- **Lipsă încă**: test browser autentic pe două telefoane cu o programare reală aprobată de salon, expirarea invitației, suport SMS și rate limit la IP.
