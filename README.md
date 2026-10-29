# June 5th

## Design

Startsidan använder designkitets två separata blomsterillustrationer från [src/assets/botanical](./src/assets/botanical). Övriga dekorationsförslag i kitet har inte lagts till på undersidorna.

- Pinyon Script används endast för namnen på startsidan.
- Jost används för övrig text i hela appen, enligt valt alternativ A. Det ersätter tills vidare Glacial Indifference; nya fontfiler/licens behövs om det senare ska bytas.
- Typsnitten laddas från Google Fonts med `display=swap` och lokala reservtypsnitt. Jost och Pinyon Script distribueras med SIL Open Font License i Google Fonts.
- Senaste designval: varm linnebeige bakgrund (`#F1E8DA`) och ljusa informationskort från förslag 1, mjuk salvia och rosa accenter. Nedräkningen följer förslag 3: tunna Jost-siffror mellan två linjer utan bakgrundsplatta. Större diagonala blomsterhörn omger de staplade namnen.
- Befintliga navigeringsikoner, länkar, nedräkning och OSA-flöde behålls. Dekorationerna har tom alternativtext och kan inte blockera klick.

## Bilduppladdning

“Ta foto” och “Välj bild” använder samma uppladdningsflöde. Kameravalet ber mobilen om den bakre kameran; det faktiska kameragränssnittet styrs av telefonen/webbläsaren.

- Hela kedjan inväntas: bildfil till Storage, hämtning av bildlänk och sparande av galleripost i Firestore.
- Fel i alla tre stegen visas i gränssnittet och loggas i webbläsarkonsolen. Ett fel efter filöverföringen kan lämna en fil i Storage utan galleripost; meddelandet skiljer därför på överföringsfel och sparfel.
- Under uppladdning visas procent och därefter “Sparar i galleriet…”. Bekräftelse visas först när galleriposten har sparats. Samtidiga uppladdningar förhindras och samma fil kan väljas igen efter ett avslutat försök.
- Ett intermittent fel med Chrome på Android har rapporterats men inte reproducerats på den fysiska telefonen. Lokala tester med simulerad Firebase verifierar återkoppling och felhantering, inte telefonens kamera eller produktionsbehörigheter.

### Mobiltest efter publicering

1. Inloggad i Chrome på Android → Galleri → Ta foto → godkänn bilden → uppladdning/sparande följs av bekräftelse och bilden visas.
2. Samma konto → Välj bild → välj ett foto → bilden visas och finns kvar efter omladdning.
3. Avbryt kameran utan att ta en bild → återgå till galleriet → ingen uppladdning startar och knapparna fungerar.
4. Testmiljö med simulerat överförings- eller sparfel → försök ladda upp → tydligt fel, ingen falsk bekräftelse och knapparna återställs.

## Musikröster och gästexport

Klädinspiration finns på `/dress-code` för inloggade gäster. Den bifogade klädguiden visas oförändrad och kan öppnas i full storlek. FAQ-posten med ID `dress-code` får automatiskt en inspirationslänk på en ny rad efter sitt svar; adminens sparade svar skrivs inte över.

- ”Sök på Spotify” under låtönskningar i gäst- och adminvyn öppnar Spotify-sökning med låttitel och eventuell artist i ny flik. Länken använder `/search/results/<URL-kodad söktext>`, verifierat med ifyllt sökfält och sökträffar i Spotifys webbspelare. Fungerar även för befintliga önskningar utan nya databasfält eller Spotify API. Länken garanterar inte en specifik inspelning.

- Musikröstning använder callable-funktionen `voteForWish` i `europe-west1`. Inloggning krävs. Hjärtat lägger till eller tar bort den egna rösten. Servern tar emot önskat läge (`voted: true/false`), så upprepade anrop inte växlar rösten oavsiktligt. Transaktionen bevarar andras röster och räknar från listan. Egna önskningar kan inte röstas på. Publicera uppdaterad `voteForWish` före webbappen; äldre klienters anrop utan `voted` betyder fortsatt lägg till.
- Gästlistan exporteras via callable-funktionen `exportGuests` i samma region. Funktionen kontrollerar adminrollen i användarens Firestore-profil innan den hämtar användare och OSA-svar.
- FAQ läses av inloggade gäster via `getFaqs` och hanteras i adminpanelen via `saveFaqs` i `europe-west1`. Funktionen kontrollerar adminrollen server-side. En versionskontrollerad Firestore-transaktion sparar hela ordningen i `siteContent/faq`; befintliga frågor är startinnehåll tills admin sparar första ändringen.
- FAQ-frågor och svar kan läggas till, redigeras, tas bort och flyttas upp/ner. Ändringar blir synliga för gäster efter att de sparats.
- Standardfrågorna innehåller ”Hur funkar transport under dagen?” med svaret ”Information om transport under dagen kommer närmare bröllopet.” Redan sparad FAQ ersätts inte av nya standardfrågor: lägg till frågan via admin och spara om den saknas i den publicerade listan.
- Webbadresser som börjar med `https://` eller `http://` i FAQ-svar visas som klickbara länkar. Klistra in webbplatsens adress följd av `/?osa=1` för att öppna OSA-dialogen på startsidan; lokalt används `http://localhost:5173/?osa=1`. OSA kräver inloggning precis som startsidan.
- Bildgalleriet visar alla foton i uppladdningstidsordning (nyaste först) och kan filtreras på uppladdarens stabila användar-ID. Poster utan uppladdar-ID visas fortfarande under “Alla uppladdare”.
- Uppladdaren kan ta bort sin egen bild med bekräftelse före 7 juni 2027 kl. 00.00 svensk sommartid (2027-06-06 22:00 UTC). Efter stoppdatumet nekar serverfunktionen gästborttagning; admin kan fortfarande radera. Gäst- och adminradering använder callable-funktionen `deletePhoto`, som kontrollerar roll/ägarskap, tar bort Storage-filen och därefter Firestore-posten.
- Lokala [Firestore-regler](./firestore.rules) och [Storage-regler](./storage.rules) är förberedda utifrån reglerna som delats från Firebase Console. De blockerar direkt klientradering av bildposter och bildfiler, även för admin. Serverfunktionen använder Admin SDK och kontrollerar behörighet. Reglerna är inte publicerade eller verifierade i emulatorn; kontrollera dem före produktionsanvändning.
- Galleri-filtret är en multiselect med sökruta inuti dropdownen och kryssrutor för en eller flera uppladdare. Sökning ändrar inte befintliga val. Inga val eller “Rensa val – visa alla” visar alla bilder. Filtreringen använder uppladdarens ID, inte visningsnamnet.
- Exportknappen finns i adminpanelens flikar Gäster och OSA. CSV-filen använder UTF-8 med BOM, semikolon och CRLF för svensk Excel. Fält med citattecken/radbrytningar escapes och celler som kan tolkas som formler neutraliseras.
- Exporten innehåller namn, kontaktens e-post, närvaro, allergier/matpreferenser och registrerarens namn. Ett OSA-svar med flera personer ger flera rader. Registrerade som tackat nej eller inte svarat finns också med. Separata e-postadresser för medföljande finns inte i nuvarande datamodell.

## Inloggning, OSA, offline och notiser

- Registrering skapar Auth-kontot och därefter profilen i `users`. Misslyckas profilen tas Auth-kontot bort igen, så att gästen kan försöka på nytt med samma e-post. Konton som blev utan profil före denna ändring rättas inte automatiskt.
- Appen lyssnar på den inloggades profil i stället för att läsa den en gång. Namnet syns direkt efter registrering och appen fastnar inte på laddningsskärmen om den startas offline.
- OSA: första namnraden förifylls med gästens namn. Både ”Ja” och ”Tyvärr nej” kan innehålla flera personer och kräver namn på varje rad; extra rader tas bort med ✕. Svaret gäller hela sällskapet. Matpreferenser är frivilliga vid ja och döljs/rensas när nej väljs; namnen behålls vid byte av svar. Admin räknar avböjande personer separat och CSV visar en rad per person utan matpreferenser vid nej. Äldre svar utan namnrader räknas som kontaktpersonen. Publicera uppdaterad `exportGuests` före webbappen för korrekt export av nej-sällskap.
- Nedräkningen räknar mot 5 juni 2027 kl. 14.00 svensk tid, visar ”Det är idag!” resten av dagen och därefter ett tack.
- Det finns en enda service worker, [public/sw.js](./public/sw.js), som även laddar push-koden från `firebase-messaging-sw.js` (genereras av [vite.config.js](./vite.config.js)). Sidor hämtas från nätet först och cachen används bara offline; filer under `/assets/` har innehållshash och hämtas från cachen först. Registrera inte `firebase-messaging-sw.js` separat – två registreringar på scope `/` ersätter varandra.
- [firebase.json](./firebase.json) sätter `Cache-Control: no-cache` på allt utom `/assets/**`, som får `immutable` i ett år. Annars kan webbläsaren visa en upp till en timme gammal kopia av en enskild adress (t.ex. `/login`) efter en publicering. Regeln för `/assets/**` måste stå efter `**`.
- Notiser loggas i adminpanelens historik även när ingen gäst har slagit på notiser (”0 mottog”).

## Verifiering

```powershell
npm --prefix functions test
npx eslint src\pages\FAQ.jsx src\pages\Admin.jsx src\pages\Home.jsx src\pages\PhotoGallery.jsx src\hooks\usePushNotifications.js public\sw.js
npm run build
```

Backendtesterna använder simulerad Firestore och testar även serverbehörigheter, upprepade röstanrop, transaktionsomförsök och CSV-innehåll. De ersätter inte ett integrationstest med Firebase.

## Publicering

Hostingkonfigurationen i [firebase.json](./firebase.json) publicerar `dist` på Firebase Hosting. Här finns ingen verifiering av vilken version som är publicerad eller vem som äger kontot.

Webbappen behöver de nya serverfunktionerna. Publicera därför funktionerna först och webbappen först efter att funktionspubliceringen lyckats. Kommandona nedan väljer projektet `june5th` uttryckligen.

1. Öppna PowerShell i projektmappen och kör tester och bygge. Fortsätt bara om samtliga kommandon lyckas:

```powershell
npm --prefix functions test
npm run build
```

2. Kontrollera konto och projekt. Vid saknad inloggning, kör `firebase login`. Fortsätt bara om rätt projekt syns och kontot har rätt att publicera:

```powershell
firebase login:list
firebase projects:list
```

3. Öppna Firebase Console → projektet `june5th` → Firestore Database → Rules. Kontrollera befintliga regler innan publicering:
   - En gäst får inte skapa sin profil med `role: 'admin'` eller ändra sin roll till admin.
   - Endast admin får läsa samtliga användarprofiler och OSA-svar; gästen får läsa sitt eget privata innehåll.
   - Inloggade gäster får läsa musikönskningar och önskarens namn.
   - Gäster får skapa egna musikönskningar med tom `votes` och `voteCount: 0`, men inte ändra `votes`/`voteCount` direkt. Röstningen sker via serverfunktionen.
   - Admins musikmoderering ska fortsatt fungera.
   - Endast admin får skapa dokument i `notification_queue`, eftersom varje dokument skickar en notis till alla gäster.
   - En inloggad användare får läsa sin egen profil i `users` (appen lyssnar på den med `onSnapshot`).

Regelfilerna är nu kopplade i `firebase.json`. Jämför dem med de aktuella Console-reglerna före publicering så att senare ändringar i Console inte skrivs över av misstag. Serverns rollkontroll förutsätter att klienter inte kan ge sig själva adminrollen. Befintliga adminroller måste kontrolleras manuellt: de tidigare profilreglerna tillät gäster att ändra sin egen roll. Nya regler återställer inte redan ändrade roller.

De lokala reglerna tillåter:
- Registrering med egen profil och `role: 'guest'`; profilredigering får inte ändra eller ta bort rollen. Rolländringar görs av betrodd projektadministratör i Firebase Console, inte från appen.
- Egen profilläsning och adminläsning av gästlistan; gäster kan inte läsa andra gästers e-post/profiler.
- Nya musikönskningar med eget användar-ID och utan röster; endast admin får ändra status eller ta bort önskningar. Röstning sker via `voteForWish`.
- Bildfiler och bildposter skapade med eget användar-ID och appens namnformat `photos/<uid>_<tidsstämpel>.<ändelse>`. Befintliga filer kan fortfarande läsas. Nya filer måste ha `image/*` som innehållstyp och vara mindre än 10 MiB. Direkt överskrivning och radering är blockerad.
- OSA-läsning/skrivning för ägaren, OSA-läsning för admin och notisköskapande för admin. FAQ sparas endast via serverfunktionerna.

Frivilliga regeltester finns i [tests/firebase-rules.test.mjs](./tests/firebase-rules.test.mjs). De använder enbart emulatorprojektet `demo-june5th`, aldrig produktion. Firebase CLI och Java 21 eller senare behöver finnas i PATH:

```powershell
npm run test:rules
```

Emulatorproven har inte körts: startförsöket stoppades av saknad Java, och Java-installation avböjdes. Backendens enhetstester ersätter inte regeltester. Använd åtminstone Rules Playground för tillåtna och nekade anrop och genomför de manuella kontrollerna nedan. Ändra inte till generell läs-/skrivåtkomst för att lösa ett fel.

4. Publicera funktionerna. Vänta på lyckad publicering innan nästa steg:

```powershell
$env:FUNCTIONS_DISCOVERY_TIMEOUT = "60"
firebase deploy --project june5th --only "functions:voteForWish,functions:exportGuests,functions:getFaqs,functions:saveFaqs,functions:deletePhoto,functions:sendPushNotification"
```

5. Publicera webbappen först när föregående kommando lyckats:

```powershell
firebase deploy --project june5th --only hosting
```

6. När funktioner och webbapp är publicerade: publicera båda regelfilerna direkt därefter. Gamla öppna appversioner som raderar direkt kommer att nekas; ladda om dem. Publicera inte reglerna separat innan `deletePhoto` och den nya webbappen finns på plats, eftersom gamla adminflödets radering då slutar fungera.

```powershell
firebase deploy --project june5th --only "firestore:rules,storage"
```

7. Kontrollera Firebase Console → Functions: `voteForWish`, `exportGuests`, `getFaqs`, `saveFaqs`, `deletePhoto` och `sendPushNotification` ska finnas i `europe-west1`. Kör därefter acceptanstesterna nedan. Inga av dessa kommandon har körts som del av den lokala regelförberedelsen.

### Manuell kontroll av regler

1. Rules Playground, gäst-UID och egen profil → skapa profil med adminroll eller ändra/ta bort befintlig roll → nekas; skapa egen gästprofil och ändra visningsnamn med oförändrad roll → tillåts.
2. Rules Playground, gäst-UID → läs annan användarprofil/OSA → nekas; admin-UID → läs profiler/OSA → tillåts.
3. Rules Playground, gäst-UID → skapa bildpost med annat användar-ID eller annan användares lagringssökväg → nekas; eget ID och korrekt egen sökväg → tillåts.
4. Rules Playground, bildpost respektive Storage-fil → direkt delete med ägarens, annan gästs och admins UID → nekas för samtliga.
5. Publicerad app, gästkonto → ladda upp en liten JPEG och öppna den → tillåts; ta bort egen bild via bekräftelsedialog → callable-funktionen lyckas före stoppdatumet.
6. Publicerad app, admin → ta bort en testbild via adminpanelen → callable-funktionen lyckas.
7. Publicerad app, gäst → skapa musikönskning och rösta på annans; admin → ändra status → samtliga avsedda flöden fungerar.

### Fel: Cannot determine backend specification / Timeout after 10000

Felet gäller CLI:ns lokala inläsning av serverkoden, inte JavaScript-bundlens storlek eller serverfunktionens körtid. Firebase dokumenterar `FUNCTIONS_DISCOVERY_TIMEOUT` som ett sätt att ge inläsningen mer tid. PowerShell-kommandot i steg 4 gäller bara den aktuella terminalsessionen.

Den uppdaterade serverkoden har kontrollerats lokalt: alla tre funktioner upptäcks via SDK:ns discovery-endpoint. Det bevisar inte orsaken till en tidigare timeout eller att en produktionspublicering har lyckats. Om felet kvarstår, kör samma funktionspublicering med `--debug` och granska loggen lokalt; dela inte hela loggen utan att först ta bort känsliga uppgifter.

### Egen domän: the-wedding.se hos STRATO

Domänen kan kopplas till befintliga Firebase Hosting; webbappen behöver inte flyttas till STRATO. DNS-inställningar har inte ändrats här.

1. Åtkomst till Firebase-projektet `june5th` och STRATO-kontot → Firebase Console → Hosting → Add custom domain → ange `the-wedding.se`.
2. Firebase visar verifieringspost → öppna DNS-hanteringen för domänen hos STRATO → lägg in exakt TXT-post från guiden och verifiera i Firebase. Behåll ägarverifieringsposten även efter anslutning.
3. Firebase visar vilka webb/DNS-poster som ska ändras → ange exakt de värden guiden visar hos STRATO → domänen pekar på Firebase. Ändra bara relevanta webbposter; behåll MX och andra e-postposter. Kontrollera konflikter med befintliga A/AAAA-poster enligt guiden.
4. Om även `www.the-wedding.se` ska fungera → lägg till den som ytterligare domän i Firebase och konfigurera omdirigering till vald huvudadress → båda adresserna når samma webbplats.
5. DNS är korrekt → invänta Firebase-status Connected och giltigt HTTPS-certifikat → sidan öppnas utan certifikatvarning. DNS-verifiering och certifikat kan vardera ta upp till 24 timmar enligt Firebase.
6. Firebase Console → Authentication → Settings → Authorized domains → lägg till den egna domänen och eventuell www-adress för autentiseringsflöden som kräver godkända domäner, inklusive framtida återställningslänkar.
7. Inloggad på den nya adressen → testa inloggning, OSA, musik och båda bilduppladdningssätten → funktionerna fungerar med befintliga konton och data. Webbläsaren kan kräva ny inloggning på den nya domänen.
8. Lokala design-/galleriändringar som ska publiceras → `npm run build`, därefter `firebase deploy --project june5th --only hosting` → samma Hosting-version används även på ansluten egen domän.

Källa: [Firebase – Connect a custom domain](https://firebase.google.com/docs/hosting/custom-domain). Använd värdena i den aktuella Firebase-guiden, inte generiska IP-adresser. STRATO:s exakta menybenämningar kan variera med abonnemang.

### Paketuppdatering 2026-10-25

Frontend och den aktiva backendmappen `functions` har uppdaterade låsfiler. Backend använder `firebase-admin` 14.5.0 och `firebase-functions` 7.4.0 med Node 22. Frontend använder Firebase 12.19.0, React Router 7.18.4 och Vite 8.3.5.

Firebase Firestores Node-beroende låser annars gRPC till en äldre minorversion med rapporterade säkerhetsproblem. En avgränsad `overrides`-post i [package.json](./package.json) använder `@grpc/grpc-js` ^1.14.6 tills Firebase uppdaterar sitt beroende. Båda aktiva paketträden rapporterar 0 kända sårbarheter efter uppdateringen. Detta är en paketkontroll, inte en fullständig säkerhetsgranskning.

### Acceptanstest efter publicering

1. Två gästkonton → konto A önskar en låt → konto B ser låten och önskarens namn.
2. Konto B → rösta på låten och ladda om → röstetalet ökar en gång och knappen visar Röstat; klicka igen och ladda om → den egna rösten tas bort och antalet minskar med ett utan att andras röster påverkas.
3. Konto B i två flikar → rösta samtidigt på samma nya låt → endast en röst registreras.
4. Gästkonto → öppna Kontakt → texten är Skicka ett mail till brudparet och länken innehåller båda mottagarna.
5. Admin med OSA-data → exportera från Gäster och OSA → samma gemensamma CSV-format, en rad per person, korrekta svenska tecken, närvaro och matpreferenser.
6. Gästkonto eller utloggad → anropa `exportGuests` → nekad åtkomst utan gästdata i svaret.
7. Testmiljö utan nätverk → försök rösta/exportera → begripligt fel visas, inte en falsk framgång.
8. Gästkonto → öppna FAQ → befintliga frågor visas i rätt ordning; admin ändrar ordning, lägger till/redigerar/tar bort fråga och sparar → gästen ser uppdateringen efter omladdning.
9. Gästkonto → försök anropa `saveFaqs` → servern nekar; två admins med samma FAQ-version → den andra sparningen får versionskonflikt och måste hämta senaste FAQ.
10. Gästkonto → Bildgalleri → välj “Alla uppladdare” eller en gäst → bilder visas nyaste först och valet filtrerar rätt bilder utan att bryta fullskärmsvisning.
11. Gäst A → ta bort egen bild efter bekräftelse → den försvinner från Storage och galleriet; gäst B → försök ta bort A:s bild → servern nekar.
12. Testmiljö med klockan före 7 juni 2027 kl. 00.00 svensk tid → gäst kan ta bort egen bild; från stoppdatumet → servern nekar gäst men admin kan fortsatt ta bort.
13. Gästkonto → öppna bildfiltret och sök i dropdownen → bara matchande namn visas; välj flera uppladdare → deras bilder visas tillsammans, nyaste först; rensa val → alla bilder visas igen.
14. Registrera ny gäst → ladda upp en bild utan att ladda om → bilden och Kontakt visar gästens namn, inte ”Gäst”.
15. Chrome DevTools → Application → Service Workers → tillåt notiser och ladda om → endast `sw.js` är registrerad.
16. Publicera en ny version → ladda om appen i en webbläsare som besökt den tidigare → nya versionen visas utan att webbplatsdata rensas.
17. DevTools → Offline → ladda om → appen öppnas utan att fastna på laddningsskärmen; slå på nätet → innehållet laddas.
18. OSA → ”Ja” → lägg till en tom rad → svaret går inte att skicka förrän raden fylls i eller tas bort; admin → OSA → ”Kommer” stämmer med CSV-exporten.
19. Admin → Notiser → skicka utan att någon gäst slagit på notiser → notisen syns i historiken med ”0 mottog”.
20. OSA → ”Tyvärr nej” → ange två namn och spara → båda finns kvar när svaret öppnas igen; admin visar två avböjande personer och CSV har två rader med ”Kommer ej”.
21. OSA → ja med matpreferenser → välj nej och sedan ja → namnen finns kvar men matpreferenserna är tomma; vid nej är matpreferensfälten dolda.
22. OSA → nej med en tom namnrad → sparande blockeras tills namnet fylls i eller raden tas bort; äldre nej-svar utan namnlista → kontaktpersonens namn förifylls vid redigering.

## Vite-mallens information

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
