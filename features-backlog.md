# Förslag till backlogg – June 5th

Utkast baserat på [features.md](./features.md) och [wedding-app-spec.md](./wedding-app-spec.md). Stories och deluppgifter är förslag, inte skapade ärenden i ett ärendehanteringssystem. Beslut som saknas är markerade som frågor.

## Nya önskemål – 26 oktober 2026

Status uppdaterad 2026-10-29 mot lokal kod. Implementerat betyder inte publicerat eller verifierat i produktion. Se även [features.md](./features.md).

| Önskemål | Story | Status |
|---|---|---|
| Klädinspiration via länk efter klädkoden | US-14 | Implementerad lokalt med klädguiden |
| Lyssna på Spotify från inkomna låtönskningar | US-15 | Implementerad lokalt med önskad länktext och Spotify-sökning |
| Rätta gilla-knappen på inkomna låtönskningar | US-05 | Implementerad lokalt; backendtester godkända |
| FAQ: ”Hur funkar transport under dagen?” | US-03 | Implementerad i standardfrågor med godkänt tillfälligt svar |
| Svara nej för flera personer i OSA | US-16 | Implementerad lokalt; admin och export uppdaterade |

## Repogenomgång – 29 oktober 2026

Genomgången omfattar klientflöden, aktiv Firebase-backend, den äldre backendmallen, regler, service worker, konfiguration och tester. Detta är inte en produktionsverifiering eller garanti att alla buggar är hittade.

**Åtgärdat**
- Lint använder rätt miljö för React, Node/CommonJS, tester och service worker. Auth-hooken är separerad från komponentexporten.
- Gemensam listhämtning i admin/galleri visar laddning och fel i stället för att tolka nekad hämtning som tomma listor.
- FAQ-redigering är låst under sparande, så att anropssvaret inte skriver över ändringar gjorda under väntetiden.
- Push-utskick deduplicerar tokens och delas i grupper om högst 500. Den extra bakgrundsnotisen har tagits bort eftersom FCM automatiskt visar notification-payloads.
- Cacheutrymmesfel blockerar inte lyckade nätverkssvar; cacherensning begränsas till appens egna äldre cacheversioner.
- Registrering hanterar saknad inbjudningskonfiguration och tomt namn. OSA-direktlänk följer med via länkarna mellan inloggning och registrering.
- Bildval valideras före uppladdning mot befintlig Storage-gräns.

**Återstående, prioriterat**
1. Före publicering: kör [regeltesterna](./tests/firebase-rules.test.mjs). Försöket är blockerat av saknad Java. Verifiera därefter riktiga gäst-/adminflöden och uppdatera befintlig sparad FAQ separat.
2. Bekräfta toastmasteradressen i [Kontakt](./src/pages/Contact.jsx); den är fortfarande en TODO. Kyrkadress, logga och eventuellt exakt inbjudningstypsnitt kräver också underlag.
3. Besluta om serverstyrd inbjudningskontroll. [Registrering](./src/pages/Register.jsx) kontrollerar i dag inbjudningskoden i klienten, inte som en serververifierad inbjudan.
4. Förbättra profilfel och dialogtillgänglighet: synlig återhämtning vid saknad/oläsbar profil, fokusfälla, Escape och återställning av fokus.
5. Förbättra pushlivscykeln: utgångna tokens, flera enheter per konto och återupptagning efter delvis misslyckade utskick. Dagens profil lagrar en token per konto.
6. Prestanda: huvudbundlen är cirka 943 kB före gzip och klädguiden cirka 1,26 MB. Dela kod per sida och optimera bilder utan att försämra läsbarheten.
7. Förvaltning: bekräfta om den oanvända mallen [june5thdb](./june5thdb) kan tas bort och lägg till automatiska kontroller i GitHub innan fortsatt publicering.

**Verifierat lokalt:** lint utan fel/varningar; 29 backendtester och 4 service worker-tester godkända; bygge lyckas med storleksvarning. Mobil-UI med simulerad Firebase kontrollerar nya texter, inspirationsbild, OSA-nej för två personer, utloggning, låst FAQ-sparande och fel i samtliga adminlistor/galleri. Push på riktiga enheter och produktionsregler är inte verifierade.

## EPIC 1 – Gästkonto och notiser

### US-01 – Välja och införa en inloggningslösning
**Som gäst vill jag kunna logga in på ett enkelt och tryggt sätt, så att jag kommer åt bröllopsinformationen och kan använda appens funktioner.**

**Deluppgifter**
- Jämför och rekommendera lämpliga inloggningssätt utifrån målgruppen, gemensam inbjudningslänk och appens befintliga Firebase/PWA-upplägg.
- Bestäm om gäster ska registrera sig med e-post och lösenord eller använda en annan lösning.
- Dokumentera flödet för gäst respektive admin och eventuella krav på återställning av konto/lösenord.
- Implementera och testa beslutat flöde på mobil och dator.

**Acceptanskriterier**
- En inbjuden gäst kan skapa konto och logga in enligt det beslutade flödet.
- En gäst kan inte nå adminfunktioner genom att ändra klientens data eller URL.
- Felaktiga inloggningsuppgifter ger ett begripligt felmeddelande.

**Frågor**
- Ska gäster använda e-post/lösenord enligt nuvarande kravspecifikation, eller önskas lösenordslös inloggning?
- Ska varje gäst ha en unik inbjudningslänk, eller gäller fortfarande en gemensam länk?

### US-11 – Återställa glömt lösenord
**Status:** Planerad för senare. Inte implementerad. Förslaget nedan behöver bekräftas innan implementation.

**Som gäst vill jag kunna återställa mitt lösenord via e-post, så att jag kan komma in i appen igen utan hjälp från brudparet.**

**Deluppgifter**
- Lägg till länken “Glömt lösenord?” på inloggningssidan och ett formulär för e-postadress.
- Använd Firebase Authentication för att skicka återställningslänken; appen ska inte hantera eller skicka lösenord.
- Bestäm språk, avsändarnamn och vart gästen kommer efter återställningen.
- Visa tydlig återkoppling, hantera ogiltig e-postadress, nätverksfel och för många försök samt förhindra dubbla pågående anrop.
- Testa hela flödet med ett testkonto, inklusive utgången och redan använd återställningslänk.

**Acceptanskriterier (förslag)**
- Gästen kan starta återställning från inloggningssidan utan att vara inloggad.
- Ett konto med e-post och lösenord kan få en återställningslänk och välja ett nytt lösenord.
- Bekräftelsen avslöjar inte om e-postadressen har ett konto: “Om det finns ett konto med den e-postadressen får du ett mejl med instruktioner.”
- Efter lyckad återställning fungerar det nya lösenordet och det gamla nekas.
- Ogiltig eller utgången länk ger begriplig återkoppling och möjlighet att starta om återställningen.
- Formuläret fungerar på mobil och med tangentbord; gästen kan återgå till inloggningen.

**Frågor**
- Räcker Firebase-standardflödet för att välja nytt lösenord, eller ska även den sidan ha appens egen design?
- Vilket avsändarnamn och vilken svarsadress ska återställningsmejlet använda?

### US-02 – Ta ställning till och erbjuda uppdateringsnotiser
**Som gäst vill jag förstå och styra om jag får uppdateringar, så att jag inte missar viktig information och vet vad mitt val innebär.**

**Deluppgifter**
- Verifiera stöd och begränsningar för pushnotiser i webbappen/PWA på iOS och Android.
- Notiser är frivilliga; appens kärnfunktioner ska fungera även om gästen tackar nej.
- Utforma samtyckestext, tidpunkt för webbläsarens tillståndsfråga och hantering av avböjt tillstånd.
- Om funktionen behålls: implementera registrering och avregistrering av notiser samt testa på stödda enheter.

**Acceptanskriterier**
- Gästen får tydlig information innan appen ber om tillstånd.
- Appens kärnfunktioner fungerar även om gästen tackar nej.
- Notiser skickas bara till gäster som har gett tillstånd och kan tas emot på de plattformar som uttryckligen stöds.

**Frågor**
- Vilka uppdateringar är så viktiga att de ska motivera notiser?

## EPIC 2 – Bröllopsinformation och visuell identitet

### US-03 – Uppdatera praktisk bröllopsinformation
**Status 2026-10-29:** Standardfrågorna anger mörk kostym, inomhusvigsel och kvällsbuss till Linköpings centrum. Bekräftad kyrkadress och adress till ladan återstår. Befintligt adminsparat innehåll skrivs inte över och måste uppdateras separat.

**Tillägg 2026-10-26:** Godkänd fråga: ”Hur funkar transport under dagen?”. Godkänt tillfälligt svar: ”Information om transport under dagen kommer närmare bröllopet.” Inlagt i lokala standardfrågor före parkering. Befintlig sparad FAQ skrivs inte över; frågan måste läggas till via admin om FAQ redan sparats. Klädinspirationslänken bryts ut i US-14.

**Som gäst vill jag hitta korrekta uppgifter om vigsel, klädsel, adresser och transport, så att jag kan planera min dag.**

**Deluppgifter**
- Uppdatera FAQ så att det framgår att vigseln hålls inomhus.
- Lägg till FAQ-svar om kvällsbuss från festlokalen till Linköpings centrum.
- Uppdatera klädkoden till mörk kostym.
- Lägg in adressen till Rappesta kyrka och komplettera med adressen till ladan när den är bekräftad.
- Kontrollera att informationen visas bra på mobil.
- Lägg till ”Hur funkar transport under dagen?” med bekräftat svar i befintlig adminhanterad FAQ; undvik en dubblett om en transportfråga redan finns.

**Acceptanskriterier**
- FAQ anger att vigseln hålls inomhus och beskriver kvällsbussen.
- Klädkoden visas som mörk kostym.
- Publicerade adresser är bekräftade och går att använda för navigering.
- Okänd adress till ladan publiceras inte som om den vore bekräftad.
- Den nya transportfrågan visas i beslutad ordning och innehåller endast bekräftade uppgifter.

**Frågor**
- Är stavningen och namnet på platsen “Rappesta kyrka” korrekt?
- Vilken tid går bussen, var stannar den och krävs föranmälan? detta kommer uppdateras senare
- När kommer adressen till ladan och ska den visas även på startsidan? - en månad innan festen
- Godkänd tillfällig svarstext: ”Information om transport under dagen kommer närmare bröllopet.” Kontrollera eventuell befintlig transportfråga innan en ny läggs till i admin.
- Var i FAQ-ordningen ska transportfrågan placeras?

### US-14 – Visa klädinspiration från FAQ
**Status:** Implementerad lokalt med användarens bifogade klädguide som oförändrad bild på `/dress-code`. FAQ-posten `dress-code` får inspirationslänken efter svaret på en ny rad. Bilden kan öppnas i full storlek. Sparade FAQ-svar ändras inte. Lint passerar; bygge lyckas med storleksvarning. Mobilvy verifierad med simulerad Firebase. Inte publicerat.

**Som gäst vill jag kunna öppna klädinspiration från klädkoden, så att jag förstår vad ”Mörk kostym” innebär.**

**Deluppgifter**
- Behåll ”Mörk kostym” och lägg efter den en radbrytning följd av ”Vill du ha mer inspiration, klicka här!”.
- Gör ordet ”här” till en intern länk till en ny sida för klädinspiration.
- Ta emot eller ta fram och godkänn mockup samt innehåll/bilder för sidan.
- Lägg till sidan och säkerställ att FAQ kan visa den namngivna länken och radbrytningen även när svaret sparas via admin.
- Kontrollera mobilvy, tangentbordsnavigation, direktlänk och återgång till FAQ.

**Acceptanskriterier**
- Klädkoden följs av den angivna texten på en ny rad.
- ”här” är klickbart och öppnar den nya inspirationssidan.
- Sidan följer appens godkända färger och typsnitt och visar godkänt material.
- Befintliga FAQ-svar och vanliga webblänkar fortsätter fungera.

**Frågor**
- Finns en färdig mockup som ska bifogas, eller ska ett förslag tas fram för godkännande?
- Vilka texter och bilder ska inspirationssidan innehålla?

### US-04 – Uppdatera typsnitt och logotyp
**Status:** Startsidan har implementerats lokalt med två större diagonala blomsterhörn. Senaste val efter fem designförslag: linnebeige bakgrund och informationskort från förslag 1, nedräkning från förslag 3 (tunna Jost-siffror mellan linjer, utan platta). Jost används för appens text och Pinyon Script för startsidans namn. Befintliga navigeringsikoner behålls. Separat logotyp återstår.

**Som gäst vill jag mötas av en enhetlig visuell identitet, så att appen känns genomarbetad och hör ihop med inbjudan.**

**Deluppgifter**
- Ta emot och bekräfta logotypfilen från Johanna.
- Ta emot eller identifiera typsnittet som används på inbjudan.
- Tillämpa det beslutade typsnittet på Brittas och Johannas namn.
- Kontrollera läsbarhet, laddning och utseende på mobil och dator.

**Acceptanskriterier**
- Godkänd logotyp visas på de överenskomna platserna utan att förvrängas.
- Namnen använder det godkända typsnittet.
- Texten är fortsatt läsbar och layouten fungerar på små skärmar.

**Frågor**
- Vilka delar av appen ska få den nya logotypen?
- Ska det nya typsnittet bara användas för namnen eller även för andra rubriker? - Senaste beslut enligt designkit och typsnittsjämförelse: två typsnitt, Pinyon Script för startsidans namn och Jost för övrig text i hela appen.
- Vem tillhandahåller typsnittet och finns det en webblicens? - Inga fontfiler ingick i kitet. Jost valdes som tillfällig ersättare för Glacial Indifference; Jost och Pinyon Script laddas via Google Fonts.

## EPIC 3 – Musikönskemål

### US-05 – Förtydliga musikönskemål och röstning
**Status:** Implementerad lokalt. Serverfunktion `voteForWish` behöver publiceras tillsammans med webbappen. Automatiska backendtester finns; verifiering mot produktions-Firebase återstår.

**Återöppnad 2026-10-26:** Användaren rapporterar att gilla-knappen inte går att trycka på för en låt som någon annan har önskat. Tidigare implementation räknas inte som verifierad lösning på det nya felet. Orsaken är inte utredd.

**Nytt beslut 2026-10-26:** Användaren bekräftar att knappen fungerar nu. Ta bort hjälptexten och den gröna röstbekräftelsen. Ett nytt klick på markerat hjärta ska ta bort den egna rösten. Detta ersätter tidigare beslut om permanenta röster. Implementerat lokalt; uppdaterad `voteForWish` måste publiceras före webbappen.

**Som gäst vill jag se vem som önskat en låt och kunna rösta på önskemål, så att jag enkelt kan delta och se vilka låtar andra gillar.**

**Deluppgifter**
- Byt platshållartexten i musikformuläret till “Natasha Bedingfield" och "Unwritten" artist/låt.
- Förbättra kontrasten för namnet på gästen som önskat låten.
- Undersök och rätta gilla-/röstknappen så att den ger tydlig återkoppling.
- Säkerställ att samma gäst inte kan rösta flera gånger på samma låt.
- Återskapa det rapporterade felet på inkomna önskningar; kontrollera knappstatus, callable-anrop, felåterkoppling och sparat röstetal innan orsaken fastställs.
- Rätta orsaken och verifiera med två olika gästkonton samt efter omladdning.

**Acceptanskriterier**
- Platshållaren visar artist och låttitel på ett begripligt sätt.
- Önskarens namn har tillräcklig kontrast i samtliga relevanta vyer.
- En röst registreras en gång, uppdaterar visat röstetal och kvarstår efter omladdning.
- Gästen ser om den egna rösten är registrerad.

**Frågor**
- Ska gästen kunna ta bort eller ändra sin röst? - Ja, enligt nytt beslut 2026-10-26: klicka på markerat hjärta för att ta bort den egna rösten.
- Ska låtönskemål och önskarens namn vara synliga för alla inloggade gäster? - ja
- Bekräftat symptom: knappen går inte att trycka på för någon annans önskning.
- Gäller felet egna eller andras önskningar, och vilken enhet/webbläsare används? Nuvarande avsikt är att inte rösta på sin egen önskning.

### US-15 – Lyssna på låtönskningar på Spotify
**Status:** Söklänkar implementerade lokalt efter beslut 2026-10-26. Länktexten är nu ”Lyssna på Spotify” i gäst- och adminlistan. Tillgänglighetsnamnet förklarar att länken söker på låttitel och eventuell artist i en ny flik. Ingen API-integration eller datamigrering krävs. Lint passerar; bygge lyckas med storleksvarning. Inte publicerat.

**Som gäst vill jag kunna öppna Spotify från en inkommen låtönskning, så att jag kan lyssna på låten.**

**Deluppgifter**
- Bestäm om länken ska gå till en Spotify-sökning på låt/artist eller en exakt låt med sparad Spotify-URL.
- Visa ”Lyssna på Spotify” som länk under varje inkommen låtönskning.
- Hantera äldre önskningar, saknad artist och eventuell saknad låtlänk enligt beslutad modell.
- Kontrollera URL-kodning av specialtecken och mobil-/datorbeteende utan att störa röstknappen.

**Acceptanskriterier**
- Inkomna önskningar har en tydlig Spotify-länk enligt beslutad länkmodell.
- Länken går till önskad låt eller tydligt till en sökning på låt/artist; ingen obekräftad träff presenteras som exakt låt.
- Befintliga önskningar hanteras utan att försvinna eller kräva att de skapas om.
- Röstning och dess återkoppling fungerar oberoende av Spotify-länken.

**Frågor**
- Räcker en Spotify-sökning med låttitel och artist, eller ska länken gå direkt till exakt låt?
- Om exakt låt krävs: ska gästen ange Spotify-länk när önskningen skapas, eller ska admin komplettera den?
- Avser ”inkomna önskningar” gästernas lista, adminlistan eller båda?

## EPIC 8 – OSA för sällskap

### US-16 – Tacka nej för flera personer
**Status:** Implementerad lokalt. Namn krävs även vid nej; matpreferenser döljs och rensas vid nej. Admin räknar/visar avböjande personer och exporten innehåller en rad per person. 26 backendtester passerar; OSA-formuläret har verifierats i webbläsaren med simulerad databas. Publicera uppdaterad `exportGuests` före webbappen.

**Som gäst vill jag kunna tacka nej för flera namngivna personer i samma OSA, så att hela sällskapets svar registreras utan separata konton.**

**Deluppgifter**
- Visa namnlista samt lägg till/ta bort person även när ”Tyvärr nej” är valt.
- Anpassa validering och sparande så att samtliga avböjande personers namn bevaras.
- Bestäm hantering av matpreferenser och befintliga namn när man växlar mellan ja och nej.
- Visa avböjande personer korrekt i adminlistan utan att räkna dem som deltagare.
- Säkerställ att CSV-exporten innehåller en rad per namngiven avböjande person med korrekt närvarostatus.
- Bevara stöd för äldre nej-svar som saknar personlista och testa redigering efter omladdning.

**Acceptanskriterier**
- ”Tyvärr nej” kan sparas för flera personer i samma svar.
- Namn och nej-status finns kvar efter omladdning och visas korrekt i admin och export.
- Avböjande personer ökar inte antalet deltagare.
- Befintligt ja-flöde och äldre OSA-svar fortsätter fungera.
- Byte mellan ja och nej tappar inte namn oavsiktligt.

**Frågor**
- Bekräftat: varje avböjande persons namn är obligatoriskt, precis som vid ja.
- Bekräftat: matpreferenser döljs och rensas vid nej; de återställs inte när gästen byter tillbaka till ja.
- Befintligt beteende behålls: ett svar gäller hela sällskapet. Blandade ja-/nej-svar ingår inte i denna story.

## EPIC 4 – Bildgalleri

### US-13 – Hantera och sortera FAQ från adminpanelen
**Status:** Implementerad lokalt. `getFaqs` och `saveFaqs` behöver publiceras tillsammans med webbappen. Produktionsbeteende och Firebase-regler är inte verifierade.

**Som admin vill jag kunna lägga till, redigera, ta bort och sortera FAQ-frågor och svar, så att gästerna hittar aktuell information i en tydlig följd.**

**Deluppgifter**
- [x] Spara innehållet i Firebase och skydda skrivningar genom serverkontrollerad adminroll.
- [x] Lägg till adminvy för att skapa, redigera, ta bort och ordna frågor och svar.
- [x] Visa sparat FAQ-innehåll i gästvyn enligt administratörens ordning.
- [x] Bevara befintliga frågor och svar som startinnehåll i Firebase.
- [x] Visa begriplig återkoppling om en ändring inte kan sparas eller bygger på en inaktuell version.

**Acceptanskriterier**
- [x] Admin kan skapa, redigera och ta bort FAQ-frågor och svar.
- [x] Admin kan ändra FAQ-posternas ordning; den valda ordningen visas för gäster.
- [x] Ändringarna sparas med versionskontroll i Firebase.
- [x] Gäster kan läsa FAQ; endast admin får spara ändringar via serverkontrollerad funktion.
- [x] Befintliga FAQ-frågor används som startinnehåll tills admin sparar första ändringen.

**Beslut**
- FAQ sparas i Firebase och administratörens sparade ändringar visas utan kodpublicering.
- Admin kan lägga till, redigera, ta bort och ändra ordning.

### US-12 – Bläddra bland bilder efter uppladdningstid och uppladdare
**Status:** Implementerad lokalt. Befintliga bilder är redan sorterade nyaste först; galleriet har nu filter per uppladdarens användar-ID.

**Som gäst vill jag bläddra bland bilder i en tidslinje eller filtrera efter uppladdare, så att jag lätt hittar bilder från en viss tid eller person.**

**Deluppgifter**
- [x] Behåll tidslinjevyn som standard och sortera bilder med nyaste uppladdningar först.
- [x] Lägg till ett sökbart uppladdarfilter med “Alla uppladdare” som standard och valbara uppladdare.
- [x] Visa ett tydligt valt filter och uppdatera galleriet när filtret ändras.
- [x] Behåll befintligt bildvisnings-/fullscreenflöde och fungerande beteende för nya och äldre bilder.
- [x] Visa även poster utan känd uppladdare i vyn “Alla”.

**Acceptanskriterier**
- [x] Alla gäster ser samma tidslinje, sorterad efter appens uppladdningstid, nyaste först.
- [x] Gästen kan välja en eller flera uppladdare och ser deras bilder tillsammans; inga val visar alla bilder.
- [x] Uppladdare identifieras med stabilt användar-ID, inte enbart visningsnamn.
- [x] Bildens uppladdarnamn visas korrekt och tidslinjen fortsätter fungera efter omladdning.
- [x] Bilder kan öppnas i befintlig fullskärmsvy från både tidslinje och filtrerat resultat.

**Beslut**
- Tidslinjen använder uppladdningstid (`createdAt`), inte datum extraherat ur bildens EXIF-metadata.
- Standardordning är nyaste först.
- Uppladdarvalet är ett filter på tidslinjen, inte separata album.
- Uppladdarnamn söks inuti dropdownen; flera personer kan väljas med kryssrutor och valen behålls när sökningen ändras.

### US-06 – Låta gästen ta bort sin egen bild
**Status:** Implementerad lokalt. `deletePhoto` behöver publiceras och Firebase-reglerna måste kontrolleras innan användning i produktion.

**Som gäst vill jag kunna ta bort en bild som jag själv laddat upp av misstag, så att felaktiga bilder inte ligger kvar i galleriet.**

**Deluppgifter**
- [x] Visa borttagningsval för bildens uppladdare.
- [x] Bekräfta permanent borttagning innan bilden tas bort.
- [x] Kontrollera ägarskap/adminroll och tidsgräns i callable-serverfunktionen.
- [x] Radera både bildfil och tillhörande Firestore-post; visa fel om någon del misslyckas.
- [ ] Verifiera produktionsregler så klienter inte kan kringgå serverraderingen genom direkta Firestore-/Storage-anrop.

**Acceptanskriterier**
- [x] Uppladdaren kan ta bort sin egen bild efter en bekräftelse.
- [x] En annan gäst nekas i serverfunktionen även om hen ändrar bild-ID.
- [x] Gäster nekas server-side från och med måndag 7 juni 2027 kl. 00.00 svensk tid.
- [x] Admin kan fortsatt ta bort bilder även efter gästernas stoppdatum.
- [x] Bildfil och post tas bort; fel visas om borttagningen misslyckas.
- [ ] Firebase-regler för direkta klientraderingar är ännu inte verifierade.

**Frågor**
- Gästborttagning stoppas 7 juni 2027 kl. 00.00 svensk tid; admin kan fortsätta radera.
- Bekräftelseruta räcker; bekräftad borttagning är permanent.
- Lokal säkerhetskopia krävs inte före aktivering av gästborttagning.

## EPIC 5 – Kontakt och navigation

### US-07 – Förtydliga kontaktlänken
**Status:** Implementerad lokalt. Båda mottagarna behålls och kravet på konfigurerad e-postklient förklaras.

**Som gäst vill jag förstå att kontaktknappen skickar ett e-postmeddelande till brudparet, så att jag vet vad som händer när jag trycker på den.**

**Deluppgifter**
- Byt texten “Öppna din e-postklient” till “Skicka ett mail till brudparet”.
- Kontrollera att länken öppnar ett nytt e-postmeddelande med rätt mottagare.
- Kontrollera beteendet på mobil och dator.

**Acceptanskriterier**
- Knappen visar den nya texten.
- Klick öppnar e-postklienten med de avsedda mottagarna.
- Det framgår att gästen behöver en konfigurerad e-postklient för att skicka meddelandet.

**Frågor**
- Ska båda brudparets e-postadresser fortsatt vara mottagare? - Ja

### US-08 – Göra utloggning lätt att hitta
**Status 2026-10-29:** Flyttad från Kontakt till startsidan. Knappen visar pågående utloggning och felmeddelande vid misslyckande. Omdirigering till inloggning efter utloggning verifierad med simulerad autentisering.

**Som inloggad gäst vill jag hitta utloggning där jag förväntar mig den, så att jag enkelt kan avsluta min session.**

**Deluppgifter**
- Bestäm placering utifrån befintlig navigation, exempelvis startsida eller meny.
- Flytta utloggningsknappen från kontaktsidan.
- Kontrollera att utloggning fungerar och att skyddade sidor inte längre kan nås efteråt.

**Acceptanskriterier**
- Utloggning finns på en tydlig, konsekvent plats.
- Kontaktsidan innehåller inte längre en orelaterad utloggningsknapp.
- Efter utloggning kräver skyddade funktioner ny inloggning.

**Frågor**
- Föredras startsidan, en gemensam meny eller en profilsida? - Vad rekommenderar du?

## EPIC 6 – Admin och export

### US-09 – Exportera gästlista och matpreferenser
**Status:** Implementerad lokalt. Serverfunktion `exportGuests` behöver publiceras tillsammans med webbappen. Exporten är en gemensam CSV, med en rad per anmäld person och kontaktpersonens e-post. Allergier och matpreferenser är ett gemensamt fält eftersom OSA lagrar dem tillsammans.

**Som admin vill jag exportera gästlistan och matpreferenser till Excel, så att jag kan planera mat och samordna information inför bröllopet.**

**Deluppgifter**
- Bekräfta vilka gäst- och preferensfält som ska ingå.
- Skapa export för gästlistan och matpreferenserna.
- Begränsa exporten till admin och skydda gästernas personuppgifter.
- Testa filen i Excel och kontrollera svenska tecken, kolumnrubriker och tomma värden.

**Acceptanskriterier**
- Endast admin kan skapa eller hämta exporten.
- Exporten innehåller de överenskomna fälten och aktuella uppgifter.
- Filen öppnas korrekt i Excel med svenska tecken och tydliga rubriker.
- Gäster kan inte komma åt exporten eller andra gästers uppgifter via appens gränssnitt.

**Frågor**
- Vilka fält ska ingå, exempelvis namn, e-post, närvaro, allergier och övriga matpreferenser? - ja
- Ska gästlista och matpreferenser vara en gemensam fil eller separata exporter? -en gemensam
- Ska formatet vara `.xlsx` specifikt, eller är en Excel-kompatibel `.csv` acceptabel? - cvs är ok

## EPIC 7 – Drift och hosting

### US-10 – Dokumentera var och hur hemsidan hostas
**Som administratör vill jag veta var hemsidan hostas och hur den publiceras, så att vi kan förvalta den och planera inför bröllopet.**

**Deluppgifter**
- Verifiera den faktiska hostingtjänsten och produktionsadressen.
- Jämför nuläget med kravspecifikationens uppgift om Firebase Hosting.
- Dokumentera deployflöde, åtkomst/ägarskap och eventuell kostnad.
- Dokumentera hur en tidigare version kan återställas.

**Acceptanskriterier**
- Produktionshosting och URL är verifierade och dokumenterade.
- Det finns en kort instruktion för publicering och återställning.
- Ägarskap och nödvändiga åtkomster är kända utan att hemligheter skrivs in i dokumentationen.

**Frågor**
- Är Firebase Hosting redan produktionsmiljö, eller är appen bara hostad lokalt/förhandsvisad? - vad menar du?
- Vem ska äga och sköta hostingkontot? - hur tar jag reda på det?

## Föreslagen ordning

1. Besluta inloggningsflöde och notisstrategi.
2. Rätta musikröstning och behörighet för borttagning av bilder.
3. Uppdatera bröllopsinformation och kontakt-/utloggningsnavigation.
4. Genomför export efter att fält och åtkomst har bekräftats.
5. Tillämpa logotyp och typsnitt när materialet finns.
6. Verifiera och dokumentera hosting parallellt med övrigt arbete.
