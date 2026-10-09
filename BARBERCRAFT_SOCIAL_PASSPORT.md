# BARBERCRAFT — Social Passport & recenzii cu vizită verificată

## Ce este implementat

- QR personal reparat: un singur QR, centrat, cu tokenul scurt afișat mascat.
- Recenzii publice **doar după două acțiuni diferite**: check-in voluntar al clientului cu QR, apoi confirmarea serviciului finalizat de un membru autorizat al salonului în PRO → Scanează QR. O vizită permite o singură recenzie; nu se generează XP din simpla confirmare.
- Datele din vechiul jurnal al clientului rămân private și nu sunt tratate drept recenzii verificate. Ratingul importat fără dovada vizitei nu este afișat ca verificat. Pagina publică de detalii a salonului folosește exclusiv `bc_verified_reviews_list`.
- `social.html`: profil social opțional/publicat voluntar; follow/unfollow; număr de urmăritori; chat text permis **doar după follow reciproc** și acceptarea mesajelor de ambii; 12 mesaje/min, limită de 1000 caractere, blocare și raportare.
- Mesajele sunt private în Supabase și chatul se actualizează periodic (12 secunde). **Nu sunt criptate end-to-end și nu dispar automat.** Acesta este un MVP de chat inspirat vizual din aplicații sociale, nu o clonă Snapchat.
- `Barber Passport PRO`: acces numai membrilor verificați ai unui salon, istoric locuri de muncă **declarat, neverificat** (fără pretinderea unei confirmări), galerie separată **publicată explicit** cu acord pentru fotografii și sondaje active de 7 zile cu un singur vot/utilizator.
- `Idei salon`: prag 5 vizite finalizate și verificate în zile distincte la același salon (din confirmările QR+personal sau activitatea verificată a jocului). Maximum 3 idei în 30 de zile per salon. Clientul și echipa salonului le pot vedea; proprietarul/managerul poate schimba stadiul.
- Meniul PRO și previzualizarea personală conțin linkuri directe către comunitate, profil și mesaje. Admin are coadă privată de raportări.

## Unde testezi

- `/social.html#profile` – activezi profilul și alegi dacă accepți mesaje.
- `/social.html` – cauți persoane care și-au publicat profilurile și alegi „Urmărește”.
- `/social.html#messages` – mesaje între două profiluri care se urmăresc reciproc.
- `/social.html#ideas` – propuneri după 5 vizite finalizate.
- `/passport.html#verifiedReviews` – recenzii publice din vizite confirmate.
- `/passport-preview.html` – propriul profil, urmăritori, galerie și recenzii verificate.
- `/reward-redeem.html` – angajatul scanează pașaportul, iar **după serviciu** confirmă vizita din secțiunea „Vizite finalizate & recenzii reale”.

## Pași de QA reali (nu au fost automatizați)

1. Două conturi separate, ambele activează profilul public și mesajele; verifică follow reciproc, trimiterea și primirea de mesaje.
2. Cont profesional asociat salonului poate încărca o fotografie cu consimțământ, adăuga experiență declarată și crea sondaj.
3. Cont client prezintă QR, cont angajat face check-in; verifică faptul că o recenzie NU este disponibilă înainte de confirmarea serviciului finalizat.
4. Angajatul confirmă serviciul real; clientul poate publica o singură recenzie, iar aceasta apare în tabul public al salonului.
5. După cinci vizite confirmate pe zile distincte, formularul de propunere al clientului devine disponibil pentru acel salon.
6. Testează încercări fără autentificare / în afara salonului / mesaje fără urmărire reciprocă și verifică respingerea server-side.

## Limite care rămân

- În prezent nu sunt vizite confirmate în noul flux, profiluri sociale opt-in sau conversații reale. Nu au fost fabricate date de test în producție.
- Mesajele text au actualizare periodică; notificările push, stories, mesaje efemere, fotografii temporare și apelurile video NU sunt implementate.
- Vizitele sunt validate prin check-in al clientului și atestarea personalului; nu reprezintă o dovadă independentă a plății. O viitoare integrare POS/bon poate crește gradul de verificare.
- Fotografiile de portofoliu PRO sunt deliberate și **publice** după upload; nu folosi fotografii fără permisiune. Galeria privată din Passport este păstrată separat.
- Raportările comunității necesită moderare de către platformă. Administratorul vede coada și poate folosi controalele existente de administrare a conturilor.
- Verificările automate acoperă structura, sintaxa și conectarea; browserul autentificat pe două dispozitive trebuie testat separat.
