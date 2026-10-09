# BARBERCRAFT Territory War — arhitectură și reguli (pilot V14)

## Stadiu

**Motor backend și interfețe în pregătire; competiția este DEZACTIVATĂ** prin `bc_tw_settings.enabled=false`. Nu există efecte financiare sau rezervări noi generate de acest document. Activarea necesită validarea partenerilor, mecanism de checkout/fiscalizare, audit și regulament publicat.

## Modelul bazei de date Supabase

- `bc_tw_territories` — sectoarele Bucureștiului (1–6).
- `bc_tw_memberships` și `bc_tw_territory_history` — sector ales prin consimțământ, istoric și schimbare blocată 30 de zile.
- `bc_tw_rounds` — săptămâni ISO locale Europe/Bucharest, status open/settled, câștigător și ultimul clasat.
- `bc_tw_activity` — câte un eveniment imutabil pe programare verificată, cu cod probator, scor, Raid, multiplicatori și fidelitate.
- `bc_tw_weekly_results` — rank, scor, utilizatori unici per sector și săptămână.
- `bc_tw_active_buffs` — câștigătorul și multiplicatorii pentru săptămâna următoare.
- `bc_tw_salon_optins` — salon verificat, sector, procent 10–15%, limită de utilizări și upgrade-uri; participare voluntară.
- `bc_tw_monthly_results`, `bc_tw_awards`, `bc_tw_fortresses` — MVP, locurile 2–10, premii în așteptare și salon fortăreață.
- `bc_tw_redemptions` — rezervări și utilizări de beneficii cu referință unică (încă neconectat la checkout).
- `bc_sales_ledger` — registrul financiar separat; doar tranzacții verificate, fără valori demo.
- `bc_specialist_settings` — programul pe 7 zile și prețurile individuale, salvate per salon și membru.
- `bc_calendar_feed_tokens` — abonări iCalendar prin token SHA-256, fără datele clienților.

## Algoritmul punctajului

```js
// După verificarea reală a unui serviciu prestat:
// Miercuri/marți 11:00–16:00 (București): happyHour = 3; altfel 1.
// Ultimul sector săptămâna anterioară: underdog = 1.5; altfel 1.
// Săptămâna victoriei, în sectorul campion, client din același sector: championXP = 2.
const salonSectorXP = Math.round(100 * happyHour * underdogSalon * championXP);
const raidHomeXP = homeSector !== salonSector
  ? Math.round(150 * underdogHome)
  : 0;
// Scorul sectorului gazdă += salonSectorXP.
// Scorul sectorului de origine += raidHomeXP (doar dacă este vizită într-alt sector).
// Puncte fidelitate = 20 pentru client eligibil din sector campion, altfel 10.
// O singură vizită verificată pe zi / cel mult 7 pe săptămână per client.
// UNIQUE(calendar_event_id) împiedică dublarea.
```

Funcții pure pentru simularea și compararea rezultatelor: `territory-war.js` (`calculateVisit`, `scoreRound`, `whatsappBooking`). **Scorurile reale se calculează numai pe server.**

## Reset și premii

O rundă este `[luni 00:00, următoarea luni 00:00)`, fus `Europe/Bucharest`. Weekendul se încheie duminică la 23:59:59; cron `barbercraft-tw-weekly-close` rulează **minut de minut** și finalizează exact după ce începe luni. Evită decalajul DST la trecerea la ora de vară/iarnă.

`bc_tw_settle_due_rounds()` folosește lock tranzacțional și clasament determinist (puncte descrescător, utilizatori unici descrescător, ID sector crescător). Dacă toate sectoarele au 0 puncte, **nu se acordă un câștigător artificial**. Buffurile se activează pentru săptămâna următoare doar dacă motorul este pornit.

`bc_tw_settle_previous_month()` este programată în prima zi din lună, ora 03:00 UTC și produce `pending`:
- Locul 1/sector: `mvp`, `free_cut`, `grooming_kit`;
- Locurile 2–10: `captain`, `weekend_priority`;
- Salonul cu cel mai mare scor din sectorul dominant: `bc_tw_fortresses`, rang 1.

**Premiile fizice, voucherele de tuns, avantajul weekend și poziția #1 în Recomandate nu sunt încă onorate/aplicate automat.** Sunt necesare reguli de eligibilitate, acordul sponsorilor, inventar și audit.

## RPC / servicii folosite

| Funcție | Apelant | Scop |
| --- | --- | --- |
| `bc_tw_choose_territory(sector)` | Client autentificat | Alege sectorul; 30 zile blocare |
| `bc_client_rewards_summary()` | Client autentificat | XP, puncte, premii proprii, cheltuieli verificate |
| `bc_tw_leaderboard()` | Public | Runde încheiate, scoruri agregate |
| `bc_tw_salon_optin(...)` | Owner | Consimțământ, sector validat de catalog, cap și buget |
| `bc_tw_quote(salon,gross_minor,at)` | Client autentificat | **Estimare**, fără reținerea discountului |
| `bc_tw_record_verified_visit(...)` | Service role numai | Premiile pentru vizite verificate; nu este expus browserului |
| `bc_tw_settle_due_rounds()` | Cron / Service role | Închide runde și creează buffuri |
| `bc_tw_settle_previous_month()` | Cron / Service role | Produce clasamente/premii lunare |
| `bc_pro_save_staff_settings(...)` | Specialist sau Owner/Manager | Program și prețuri individuale |
| `bc_pro_sales_summary(salon)` | Owner/Manager | Sumare vânzări verificate |
| `bc_admin_sales_summary()` | Admin platformă | Statistici totale și activare pilot (doar citire în UI) |
| `bc_pro_create_calendar_feed(salon)` | Membru PRO | Generează link nou de abonare; invalidează precedentul |
| `bc_pro_revoke_calendar_feed(salon)` | Membru PRO | Revocă abonarea |
| `barbercraft-calendar-feed?token=...` | Calendar extern | Feed ICS **read-only**, fără nume de client |

### Flux financiar obligatoriu înainte de lansare

`verified_booking -> check-in / dovadă serviciu -> plată verificată -> sale ledger idempotent -> discount rezervat + buget verificat -> activity reward -> WhatsApp notification`

În versiunea pilot, ultimii pași de checkout/redemption încă nu sunt legați. **Nu** se apelează `bc_tw_record_verified_visit` în browser și nu se acordă bonusuri doar din rezervarea manuală.

## Mesaje WhatsApp — machete, NU trimiteri automate

**Comandant / MVP:**

Salut! Aș vrea o programare BARBERCRAFT la 4MEN, sâmbătă la ora 12:00, pentru tuns. 🏆 Am titlul „Comandantul Sectorului 6” (MVP). Te rog să verifici disponibilitatea și eligibilitatea voucherului înainte de confirmare.

**Upgrade gratuit:**

Salut! Am selectat un tuns în BARBERCRAFT pentru miercuri, ora 15:00. 🎁 În cont apare un upgrade de spălat părul care așteaptă confirmarea salonului. Este disponibil la această programare?

Niciun mesaj nu trebuie să pretindă un beneficiu garantat înainte de validare. Trimiterea automată prin WhatsApp necesită template aprobat/permisiuni conform canalului Business.

## Limite și următoarele livrabile

- Calendar Apple / Android: feed ICS revocabil, actualizări **într-un singur sens** la frecvența aplicației. Modificările externe necesită OAuth/CalDAV și gestionarea conflictelor.
- Google Calendar: abonare la feed din versiunea web; sincronizarea bidirecțională Google necesită OAuth și tokenuri păstrate securizat.
- Programul/prețurile individuale sunt editabile în PRO, dar motorul de rezervare pentru **câte un calendar per specialist** trebuie conectat separat la acest program.
- Sectorul proprietarului/salonului trebuie verificat (din catalog) înainte de competiție; apartenența clientului este declarativă și poate necesita verificare suplimentară antifraudă.
- Upgrade WhatsApp, cashback convertibil în voucher, redemption cu cap tranzacțional, premii fizice și promovarea Salonului Fortăreață necesită integrare operațională.

## Testare necesară

1. Owner editează programul și prețul unui frizer; angajatul își poate edita doar propria configurație.
2. Linkul privat iCalendar returnează doar intervale, nu date personale; după revocare returnează 404.
3. O vizită fake sau duplicată este respinsă; puncte doar pe confirmări dintr-un serviciu backend de încredere.
4. Settlement săptămânal este idempotent, pe Europe/Bucharest, inclusiv la schimbările DST; fără câștigători la scor 0.
5. În modul dezactivat, quote = 0 și nicio tranzacție/premiu/reducere nu este generată.
