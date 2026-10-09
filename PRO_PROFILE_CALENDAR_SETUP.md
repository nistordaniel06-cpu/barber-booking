# BARBERCRAFT PRO — profil, echipă, calendare (V11)

## 1. Conectează salonul PRO la profilul public
În `admin.html` → **Catalog saloane** → **Asociază profilul PRO**, alege 4MEN din lista de saloane active, verifică adresa, apoi confirmă. Fără această asociere, profilul din PRO nu actualizează automat fișa publică.

## 2. Editează profilul
În `professionals.html` → Salon → Profil online: nume, adresă, descriere, telefon, website, copertă. Imaginea trebuie să fie JPG/PNG/WebP și să aibă cel mult 5 MB. Salvarea folosește o funcție Supabase ce verifică rolul Owner/Manager și Storage cu politici RLS.

## 3. Invită personal prin e-mail
În Salon → Echipă, proprietarul introduce e-mailul și selectează Staff, Moderator sau Manager. Edge Function `barbercraft-team-invite` verifică sesiunile și drepturile, apoi creează invitația.
- Pentru utilizatori noi, Supabase Auth încearcă să trimită e-mailul de invitație.
- Pentru utilizatori existenți, Supabase Auth încearcă să trimită un link de autentificare.
- Livrarea efectivă depinde de setările SMTP/template și limitele furnizorului. Interfața spune dacă trimiterea nu a reușit.
- Invitatul trebuie să se autentifice și să apese **Acceptă** în PRO. Niciun rol nu se acordă numai pe baza introducerii unui e-mail.
- Verifică în Supabase → Authentication → Email templates, SMTP și setările Redirect URLs.

## 4. Calendar
Din PRO → Calendar poți introduce un interval manual sau importa un export **.ics** din Google Calendar ori Apple Calendar. Dacă MERO oferă un export .ics, același importator îl poate procesa.
- Se importă intervale **ocupate**, nu rezervări confirmate.
- Importul suportă evenimente cu UTC sau Europe/Bucharest (alte fusuri orare și evenimente recurente complexe sunt omise).
- Dublurile după UID sunt actualizate la reimport.
- Exportul .ics este disponibil pentru evenimentele calendarului BARBERCRAFT.
- **Nu există încă sincronizare bidirecțională continuă Google/Apple**: aceasta necesită OAuth, conturi conectate, permisiuni, refresh tokens și tratarea modificărilor.

## 5. Ce NU activează această etapă
- rezervări automate din aplicația clienților;
- mesaje WhatsApp sau sincronizare MERO fără export autorizat;
- fotografii multiple ori importul recenziilor altor platforme;
- plăți și modul POS.

Teste recomandate: accesul Owner/Manager/Staff, e-mail livrat și acceptare invitație, copertă vizibilă după asocierea profilului, import .ics mic și reimport fără duplicate, butonul Înapoi la setări, tema Light/Dark.
