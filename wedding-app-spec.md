# Kravspecifikation – June 5th
### Britta & Johannas Bröllopsapp
**Datum:** Juni 2026  
**Bröllop:** Britta & Johanna, 5:e juni 2027, Östergötland  
**Appnamn:** June 5th  
**Version:** 1.1  

---

## 1. Syfte och bakgrund

Appen syftar till att ge bröllopspar och gäster en samlad digital upplevelse inför, under och efter bröllopet. Gästerna ska enkelt kunna ta del av information, önska musik, kommunicera med brudparet, ladda upp bilder och ta emot notiser – allt på ett ställe.

---

## 2. Teknisk stack

| Komponent | Val |
|---|---|
| Frontend | React (via Lovable) |
| Backend / Databas | Firebase (Firestore, Auth, Storage, Cloud Messaging) |
| Hosting | Firebase Hosting |
| Push-notiser | Firebase Cloud Messaging (FCM) |
| Appformat | PWA (Progressive Web App) – installerbar på hemskärm, stöd för push-notiser och kamera |
| Autentisering | Firebase Auth – e-post/lösenord eller custom token |

**Kostnadsmål:** Hålla sig inom Firebases gratislager (Spark Plan). Vid 60–80 aktiva användare och måttlig användning är detta fullt realistiskt.

---

## 3. Plattform

Appen byggs som en **PWA** vilket innebär:
- Fungerar i mobilens webbläsare (iOS Safari, Android Chrome)
- Kan installeras på hemskärmen via "Lägg till på hemskärmen"
- Push-notiser fungerar på Android direkt; på iOS krävs att användaren installerar appen via Safari
- Tillgång till kamera via webbläsarens Camera API (ingen App Store-publicering behövs)
- Kräver internetuppkoppling (offline-läge är inte ett krav)

---

## 4. Användare och roller

### 4.1 Roller

| Roll | Beskrivning |
|---|---|
| **Gäst** | Vanlig inbjuden gäst. Kan ta del av all publik information, önska musik, chatta och ladda upp bilder. |
| **Admin** | Brudparet och toastmaster. Har tillgång till adminpanel med utökade funktioner. |

### 4.2 Inloggning och registrering

- Gäster bjuds in via en **personlig inbjudningslänk** (skickas t.ex. i digital inbjudan eller via SMS)
- Länken tar gästen direkt till appen där de skapar ett konto med:
  - Valfritt visningsnamn (syns i chatt, bilduppladdning, musikönskemål)
  - Lösenord (gästen väljer själv)
- **Inget e-postverifieringssteg** krävs för att hålla det enkelt
- Admins skapas manuellt i Firebase Console eller via en dold adminregistreringssida
- En **QR-kod** ska finnas (t.ex. på välkomstkortet vid bröllopslokalen) som pekar på appens URL – en genväg till inloggningssidan, inte en automatisk inloggning

---

## 5. Funktioner

### 5.1 Startsida / Dashboard

- Välkomstbanner med brudparets namn och datum (Britta & Johanna – 5 juni 2027)
- Nedräkning till bröllopsdagen
- Snabblänkar till appens olika sektioner
- Eventuell notis-feed (se 5.6)

---

### 5.2 FAQ

- Statisk sida med vanliga frågor och svar
- Innehållet hanteras direkt i koden (ingen adminpanel behövs i första versionen)
- Kategorier kan t.ex. vara: Schema, Klädkod, Lokal & parkering, Övernattning, Barn & allergier

---

### 5.3 Musikönskemål

**Gästvy:**
- Gäster kan skicka in låtönskemål med fält för:
  - Låttitel
  - Artist
  - Valfritt: kort meddelande ("Det här måste spelas vid middagen!")
- Alla önskemål visas i en publik lista
- Gäster kan **rösta upp** andras önskemål (en röst per gäst och låt)
- Listan sorteras efter antal röster

**Adminvy:**
- Kan se, ta bort och markera låtar som "bekräftad" eller "avböjd"

**Spotify-integration (önskvärd, ej blockerande):**
- Om integration med Spotify Web API är möjlig: sökfunktion med autokomplettering av låt/artist
- Om det bedöms för komplext i första version: fritext-inmatning är acceptabelt

---

### 5.4 Kommunikation med brudpar/toastmaster

- Gäster kan skicka ett **direktmeddelande till brudparet/toastmaster** via ett kontaktformulär i appen
- Formuläret öppnar gästens **e-postklient** med förifylld mottagare: britta.toresson@gmail.com och johanna.norell@live.com
- Ingen inbyggd chattfunktion i denna version (utvärderas senare)

**Toastmaster-anmälan:**
- Separat knapp/sektion: "Anmäl tal, lek eller aktivitet"
- Öppnar e-postklient med förbestämt ämne: "Anmälan – [Gästens namn]"
- Toastmasterns e-postadress konfigureras i koden

---

### 5.5 Bildgalleri

**Uppladdning:**
- Alla inloggade gäster kan ladda upp bilder
- Möjlighet att **öppna kameran direkt i appen** (via Camera API i webbläsaren) alternativt ladda upp från kamerarullen
- Bild associeras automatiskt med gästens visningsnamn och tidsstämpel

**Visning:**
- Bilder visas i ett gemensamt galleri, kronologiskt ordnat
- Öppna och visa bild i helskärm vid klick

**Lagring:**
- Bilder sparas i **Firebase Storage** och är tillgängliga även efter bröllopet
- Brudparet kan via Firebase Console ladda ner samtliga bilder vid behov
- Ingen automatisk bildnedladdning i appen i första versionen

**Moderering:**
- Inga krav på godkännande – alla bilder publiceras direkt
- Admin kan ta bort bilder vid behov via adminpanelen

---

### 5.6 Push-notiser

**Teknik:** Firebase Cloud Messaging (FCM)

**Sändare:** Endast admins (brudpar/toastmaster) kan skicka notiser

**Mottagare:** Alla gäster som accepterat push-notiser vid installationen

**Exempel på notiser:**
- 🌤️ "Det ser ut att bli 20 grader och sol på lördag – dags att välja outfit!"
- 🎵 "Lyssna in dig på vår favoritlåt innan lördagen: [låttitel]"
- 📢 "Kom ihåg att höra av dig till toastmaster om du vill hålla tal!"
- 📸 "Nu börjar vi fira – lägg upp dina förberedelse-bilder i galleriet!"
- 🥂 "Välkomna! Middagen serveras om 30 minuter."

**Adminpanel – notiser:**
- Formulär för att skriva och skicka en push-notis till alla gäster
- Historik över skickade notiser

**Obs:** Gästen måste acceptera push-notiser när appen laddas för första gången. På iOS krävs dessutom att appen är installerad som PWA.

---

### 5.7 Adminpanel

Tillgänglig enbart för användare med admin-rollen.

**Innehåll (initialt):**
- Skicka push-notiser (se 5.6)
- Se lista över registrerade gäster
- Ta bort bilder från galleriet
- Se och hantera musikönskemål (bekräfta/avböj)

---

## 6. Design och UX

- Mobilfirst – all design optimeras primärt för mobiltelefon
- **Appnamn:** June 5th

### Visuellt tema

Inspirerat av save the date-kortets estetik:

| Element | Värde |
|---|---|
| Primärfärg | Misty sage / dammig grön (t.ex. `#8A9E8C` eller `#7D9B7F`) |
| Bakgrundsfärg | Krämvit / off-white (`#F5F0EA`) |
| Accentfärg | Dusty rose / blekrosa (`#D4A5A0`) – från blomman på kortet |
| Textfärg | Mörk kol / nästan svart (`#2C2C2C`) |
| Typografi | Kombination av serif/versaler för rubriker + script/handstil för namn och detaljer |
| Illustrationer | Botaniska element (vildblommor, örter) som dekoration |

Tonen ska vara: **romantisk, luftig, modern nordisk** – lika fin som en premiumapp i App Store.

- Inga krav på mörkt/ljust läge i första versionen

---

## 7. Tidslinje och livscykel

| Fas | Tidsram |
|---|---|
| Appen lanseras (gäster bjuds in) | Ca 1–2 månader före bröllopet (april 2027) |
| Aktiv under bröllopsdagen | 5 juni 2027 |
| Appen hålls aktiv efter bröllopet | Minst 1 månad efteråt (bildgalleri m.m.) |

---

## 8. Icke-funktionella krav

- **Prestanda:** Appen ska laddas snabbt på mobilt nätverk (4G/5G)
- **Skalbarhet:** Dimensioneras för 60–80 aktiva användare
- **Säkerhet:** Firebase Security Rules används för att säkerställa att gäster bara kan se/ändra sin egen data; admins har utökad access
- **Tillgänglighet:** Svenska som enda språk
- **Offline:** Inget krav på offline-funktionalitet

---

## 9. Utanför scope (version 1.0)

Följande funktioner är identifierade men skjuts till framtida versioner:

- AI-stöd för talskrivning (länk till extern tjänst utvärderas)
- Privata meddelanden mellan gäster
- Öppen gruppchatt
- CMS/adminpanel för FAQ-redigering
- Automatisk bildnedladdning / albumexport i appen
- Spotify-integration (utvärderas baserat på komplexitet)

---

## 10. Öppna frågor / beslutspunkter

| # | Fråga | Status |
|---|---|---|
| 1 | Spotify-integration | ✅ Avvaktar – nice to have till senare version |
| 2 | Appens namn | ✅ **June 5th** |
| 3 | Brudparets e-post | ✅ britta.toresson@gmail.com, johanna.norell@live.com |
| 4 | Toastmasterns e-post | ⏳ Återkommer |
| 5 | Visuellt tema / färgpalett | ✅ Misty sage + krämvit, inspirerat av save the date-kortet |
| 6 | Inbjudningslänk gemensam eller unik per gäst | ✅ **Gemensam länk** – gästen registrerar sig med unik e-post |

---

## Bygg i rätt ordning
1. Auth (inloggning/registrering)     ← börja här
2. FAQ                                 ← snabb win
3. Musikönskemål + röstning
4. Bildgalleri
5. Kontaktformulär (mailto)
6. Push-notiser                        ← spara till sist
7. Adminpanel

*Dokumentet uppdateras löpande allteftersom nya krav tillkommer.*