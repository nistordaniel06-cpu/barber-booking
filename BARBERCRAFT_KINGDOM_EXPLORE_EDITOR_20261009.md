# BARBERCRAFT — Regatul Meu / Explore Admin / Mobile UI

## Lansat în cod
- **Regatul Meu**: interfață reproiectată în stil BARBERCRAFT (fundal închis + accente aurii). Pagini separate Satul Meu / Alianța / Expediții, resurse vizibile, harta satului interactivă, progres ghidat „Ce fac acum?”, stări de butoane gestionate prin RPC-urile server-side existente. Nu adaugă monedă reală, XP sau lupte PvP.
- **Explorare**: profilurile demonstrative nu mai afișează butonul către MERO și nu expun URL-uri de sursă în API-ul public. Informația de proveniență a datelor rămâne administrativă. Fotografii reale pot fi afișate doar după încărcare și confirmarea drepturilor. Fără rezervări pe profilurile demonstrative.
- **Admin → Saloane de explorat**: căutare, creare, editare denumire/adresă/localitate/sector/echipă/servicii/prețuri, încarcă copertă și până la 12 fotografii JPG/PNG/WebP de maximum 5MB fiecare, ascunde/arată și șterge definitiv numai profilurile de explorare, nu conturile PRO. Confirmare prin nume la ștergere. Fișierele sunt în `bc-explore-images`.
- **Responsive**: Admin quick tiles și formularul editorului, Invitații & Câștigă PRO, profil social și Barber Passport PRO încadrate pentru telefoane mici; butoane și câmpuri au max-width, text cu wrap.
- **Propuneri clienți**: legăturile și tabul eliminate; scrierea prin RPC dezactivată, istoricul nu a fost șters.

## Securitate
- Toate operațiile de modificare a profilurilor de explorare folosesc funcții cu verificare `bc_is_platform_admin`; anonimi și utilizatorii obișnuiți pot citi numai câmpurile publice ale intrărilor vizibile.
- `source_url` este permis doar pentru administrator, dar vechea referință este păstrată intern pentru trasabilitate.
- Uploadul în bucketul de imagini este permis numai administratorilor; serverul verifică proprietatea fișierelor și apartenența la profil.
- Exemplele nu pot fi transformate în parteneri PRO și nu pot accepta rezervări prin editor; aceasta este o etapă separată de verificare contractuală.
- „Date actualizate” nu înseamnă că un salon este automat verificat independent. Administrarea pozelor presupune confirmarea explicită a drepturilor de publicare.

## Verificări suplimentare recomandate
1. Pe un telefon Android la 360px: Admin rapid, lista Explore, formular servicii/galerie, profil social și Referral.
2. În Admin cu rol verificat: creează un profil de test, adaugă serviciu, încarcă o copertă proprie, ascunde, afișează și șterge profilul.
3. În Regatul Meu cu cont client: colectează provizii, construiește, antrenează trupe și navighează între taburi. Pe un cont PRO, verifică autentificarea înainte de a presupune că modul este accesibil.
4. După publicarea unei fotografii, verifică drepturile și ștergerea în Storage. Fișierele distribuite anterior pot persista temporar în cache-ul browserului.
5. Nu am modificat progresul existent al niciunui jucător și nu am încărcat imagini terțe.

Testele statice sunt în `tests/barbercraft-kingdom-explore-mobile-smoke.mjs`. Nu există în acest sprint un test E2E browser autentificat care să certifice pixel-perfect toate ecranele.
