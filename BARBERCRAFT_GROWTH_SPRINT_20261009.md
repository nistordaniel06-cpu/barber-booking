# BARBERCRAFT Growth Sprint — 9 octombrie 2026

## Livrat

### 1. Eliminare salon din PRO

- Ecran nou în **PRO → Setări → Șterge salonul meu**, disponibil numai persoanelor cu rol `owner`.
- Eliminarea este **arhivare reversibilă**, nu ștergere fizică: ascunde listările, dezactivează rezervările și participarea la competiție, păstrând programări/recenzii/istoric financiar. Se cere scrierea numelui exact al salonului.
- Se refuză arhivarea când există rezervări viitoare în curs; un trigger refuză rezervările viitoare noi pentru un salon arhivat.
- Restaurarea este permisă numai proprietarului, fără reactivarea automată a publicării sau rezervărilor.
- **Limitare:** ștergerea definitivă/anonimizarea datelor și retenția legală sunt procese separate, nu se lansează din acest buton.

### 2. Căutare națională și localizare

- Homepage: **Lângă mine**, **Toată România**, **Vezi harta**; filtrele detaliate județ/oraș/sector sunt în panou extensibil, nu pe un rând tăiat pe mobil.
- Geolocația browserului necesită permisiune; folosește cel mai apropiat centru de oraș dintr-o listă statică și revine la nivel național când nu există rezultat relevant. Nu se salvează coordonate ale utilizatorului în DB.
- Harta Leaflet/OSM arată cercuri agregate după **oraș**, nu puncte GPS exacte ale saloanelor (nu avem încă geocodare autorizată pe toate adresele).
- Dacă geolocația este refuzată, aplicația rămâne utilizabilă național.

### 3. Bătălia Zonelor — modul strategic (inspirat din bucla jocurilor browser de strategie)

- `kingdom-strategy.html`: sat persistent, resurse (lemn, piatră, fier, hrană), șapte clădiri, producție server-side în intervale de 3 minute cu plafon 6 ore, limită de depozit, instruire infanterie, misiune zilnică.
- 6 alianțe de sector, trezorerii comune, donație zilnică, upgrade fortăreață, expediție PvE cu rezultat determinist (maxim una/zi).
- Toate mutațiile de resurse sunt RPC-uri autentificate cu lock tranzacțional, soldul nu vine din browser.
- Separat de jocul sezonier: resursele și trupele **nu sunt XP, bani, premii sau puncte de fidelitate**. PvP, asediu asupra jucătorilor, comandanți și economii de sezon rămân de construit.

### 4. Referral client și PRO

- `referral.html`: cod personal și link, activare cu cont înregistrat recent, tracking invitation, status și istoric.
- Cod referrer client: progresează până la `qualified` doar după o vizită dublu confirmată (QR+staff) din `bc_service_visits`.
- Cod PRO: doar administratorul poate verifica noua locație al cărei titular este invitatul; imposibil de calificat doar prin creare de cont.
- Protecții: fără auto-invitare, fără conturi vechi, invitație folosită o singură dată, plafon lunar de recomandări, fără insert client direct.
- `Admin → Referral`: editor de termeni/campanie și verificare conversii PRO.
- **Campania este implicit OFF**. Valorile exemplu configurabile sunt 100 puncte promo propuse pentru cel care invită, 50 pentru noul client și 14 zile PRO propuse; acestea nu sunt acreditate în portofel și nici abonamentul nu se prelungește automat. La calificare cu campania activă, sunt înregistrate **cereri pending** distincte de XP și de plăți; pentru beneficii efective rămân necesare finanțare, termeni și integrarea promoției cu wallet/subscripția.

### 5. Catalog de saloane sursate din MERO (NUMAI DEMO EXTERN)

- 20 listări repartizate: **Sector 6: 5**; **Sectoare 1–5: câte 3**.
- Stocate într-o tabelă separată `bc_discovery_salon_samples` și afișate în homepage într-o grilă cu fișă și link către sursa publică originală, plus extrase de servicii, prețuri și nume de profesioniști atunci când sunt vizibile public.
- **Niciunul nu este creat ca partener sau frizer BARBERCRAFT și niciunul nu permite programare în BARBERCRAFT.**
- Fotografii originale sau imagini de copertă MERO **nu sunt copiate**. Fiecare are ilustrație generică proprie, marcată explicit, iar fotografiile autentice sunt disponibile la sursă. Nu pretindem că extrasul de servicii acoperă absolut toate serviciile salonului sau că prețurile vor rămâne actualizate.
- Pentru **copertă reală, fotografii reale, servicii și personal complet sincronizate** trebuie consimțământul fiecărui partener și importul autorizat/integrarea API, plus verificarea periodică a prețurilor.

## Securitate și testare

- Tabelele nou create au RLS. RPC-urile sensitive sunt security definer cu verificarea rolului și grant exclusiv către utilizatori autentificați.
- Campania referral și competiția oficială rămân inactive. Nu au fost create tranzacții fictive, conturi de angajați false sau visit XP.
- Testele `node tests/barbercraft-growth-smoke.mjs` și suita existentă rulează în GitHub Actions.
- **QA încă necesar:** două conturi reale (client/PRO/owner) pentru referral; proprietar cu salon fără programări viitoare pentru arhivare; poziționarea pe telefon cu permisiunea de localizare; hartă Leaflet pe Android; interacțiuni sat dintr-un cont real, inclusiv donații și cooldown. Nu există teste browser E2E autentificate în acest sprint.

## Surse publice (date de serviciu și preț)

Fiecare profil din `bc_discovery_salon_samples` conține `source_url` MERO original, care se poate deschide direct din pagina salonului; consultate la 9 octombrie 2026. Valorile sunt snapshot, nu API live.
