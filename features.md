
Status uppdaterad 2026-10-29 mot den lokala koden. Senaste ändringarna är inte publicerade.
Avbockat betyder implementerat i koden, inte verifierat i Firebase-produktion.

## Tankar från 2026-10-25

- [ ] Fundera över vilken inloggningslösning som passar appen bäst.
- [ ] Johanna vill ha en finare logga - hon återkommer med bild.
- [ ] Ny font på Britta och Johanna - samma som på inbjudan. Pinyon Script används nu; överensstämmelse med inbjudan återstår att bekräfta.
- [ ] "Vill du få uppdateringar" - ska det verkligen vara valfritt? Webbpush/PWA finns implementerat, men plattformsverifiering och beslut om upplägget återstår.
- [ ] Adress: addera Rappesta kyrka; adress till ladan kommer senare.
- [x] FAQ: vigseln hålls inomhus. Uppdaterat standardsvar; befintlig adminsparad FAQ måste uppdateras separat.
- [x] FAQ om kvällsbuss från festlokalen till Linköpings centrum. Inlagt separat från den allmänna transportfrågan; tider och hållplatser anges inte innan de bekräftats.
- [x] Klädkod: mörk kostym. Inlagt i FAQ:s standardsvar och på inspirationssidan; befintlig adminsparad FAQ måste uppdateras separat.
- [x] Musik: ändra placeholder till Natasha Bedingfield och Unwritten.
- [x] Musik: förbättra kontrasten för namnet på den som önskat låten.
- [x] Musik: rätta hjärt-/gillaknappen. Lägga till och ta bort röst är implementerat; backendtester godkända.
- [x] Foto: skaparen kan ta bort sin egen bild. Kräver bekräftelse och gäller före 7 juni 2027 kl. 00.00 svensk tid; backendtester godkända. Produktionsregler återstår att verifiera.
- [x] Byt "Öppna din epostklient" till "Skicka ett mail till brudparet".
- [x] Flytta logga ut-knappen från Kontakt till startsidan. Pågående utloggning och eventuella fel visas.
- [x] Exportera gästlistan och matpreferenser till Excel-kompatibel CSV via admin.

## Nya features

- [x] Klädkod: radbrytning och "Vill du ha mer inspiration, klicka här!" med länk till en ny sida med klädguiden.
- [x] "Lyssna på Spotify" och Spotify-länk under inkomna låtönskningar i gäst- och adminvyn. Länken öppnar sökresultat för låt och artist enligt tidigare beslutad söklänksmodell, inte en garanterad specifik inspelning.
- [x] Fixa gilla-knappen på inkomna låtönskningar, se ovan.
- [x] FAQ: lägg till "Hur funkar transport under dagen?" i standardfrågorna med tillfälligt svar. Om FAQ redan sparats via admin måste frågan också läggas till där; produktionsinnehållet är inte verifierat.
- [x] OSA: även "Tyvärr nej" tillåter svar åt flera personer. Admin och CSV-export hanterar personerna.

## Övriga frågor

- [ ] Hur hostas hemsidan?

## Verifiering och återstående arbete efter repogenomgång

- [x] Rättad lintkonfiguration för React, Node/CommonJS, tester och service worker.
- [x] Tydliga laddnings- och felmeddelanden i adminlistor och bildgalleri.
- [x] FAQ-formuläret låses medan sparande pågår så att pågående ändringar inte skrivs över av svaret.
- [x] Push deduplicerar mottagartokens och delar upp utskick i grupper om högst 500.
- [x] Borttagen extra bakgrundsnotis som kunde visas utöver FCM:s automatiska notis.
- [x] Cachefel får inte dölja ett lyckat nätverkssvar; andra appars cache raderas inte vid service worker-uppdatering.
- [x] OSA-direktlänken bevaras även via registreringslänken; registrering visar fel vid saknad konfiguration eller tomt namn.
- [x] Bildval valideras mot Storage-gränsen: bildtyp och mindre än 10 MiB.
- [ ] Regeltester: blockerade av saknad Java. Inga produktionsregler har ändrats.
- [ ] Publicera funktioner/webbapp och uppdatera redan sparad FAQ via admin.
- [ ] Minska huvudbundlen och bildstorlekarna; bygget varnar fortfarande för en JavaScript-fil över 500 kB.
- [ ] Bekräfta toastmasterns riktiga e-postadress; nuvarande adress är markerad som TODO i koden.
- [ ] Förbättra dialogernas fokusfälla, Escape-stängning och återställning av fokus.
- [ ] Besluta serverstyrd inbjudningskontroll; nuvarande inbjudningskod kontrolleras i klienten.
- [ ] Förbättra pushlivscykeln: hantera utgångna tokens, flera enheter och återupptagning efter delvis misslyckade utskick.
