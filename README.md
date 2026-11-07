# Pieterpad Tracker

Een Progressive Web App om je voortgang op het **Pieterpad** (Pieterburen → Sint-Pietersberg, 26 etappes, ~506 km) bij te houden. Gemaakt voor de iPhone (installeerbaar op het beginscherm), werkt ook op desktop. Volledig offline bruikbaar; synchroniseert met Supabase zodra er verbinding is.

> Persoonlijk hulpmiddel, niet officieel. Etappes en afstanden komen van [pieterpad.nl](https://www.pieterpad.nl/etappes). Het officiële logo wordt niet gebruikt; de app heeft een eigen icoon.

## Wat kan het?

- **Overzicht**: voortgangsbalk (km en %), kaart met gelopen etappes in rood, eerstvolgende etappe, laatste dagboekentry.
- **Etappes**: de 26 officiële etappes, met status (gepland / deels / gelopen). Detailpagina met kaart, gegevens, routes, foto's, dagboek en plekken.
- **Routes**: GPX, TCX en FIT importeren (meerdere tegelijk). Afstand, duur, bewegingstijd, datum en hoogtemeters worden uitgelezen en de app stelt voor bij welke etappe de route hoort (ook bij een etappe in twee delen of in omgekeerde richting). Handmatig toevoegen zonder bestand kan ook. Export terug naar GPX.
- **Foto's**: vanaf camera of fotobibliotheek, automatisch verkleind (max. 2048 px), EXIF-datum en -locatie, galerij per etappe, volledig scherm met swipen.
- **Dagboek**: tijdlijn, markdown, stemming en weer, foto's. Direct na "etappe afronden" voorgesteld. Niet-opgeslagen concepten worden bewaard.
- **Plekken**: restaurants, cafés en overnachtingen met beoordeling, prijs, notitie, locatie (huidige locatie, adres zoeken of op de kaart tikken), filter op type en etappe.
- **Statistieken**: totaal km, etappes, % voltooid, looptijd, gemiddelde snelheid, hoogtemeters, langste etappe, km per maand, wandeldagen, voortgang per provincie, geschatte einddatum.
- **Homey-koppeling**: generieke webhook bij het afronden van een etappe (werkt ook offline via een wachtrij).
- **Verwijderen** van routes, foto's, dagboekentries en plekken altijd met bevestiging en een "Ongedaan maken"-melding. Er wordt nooit iets direct gewist (zachte verwijdering).
- **Back-up**: export/import als zip (data.json + foto's). Import voegt samen en wist niets.

## Techniek

React 19 + Vite + TypeScript, Tailwind CSS 4, `vite-plugin-pwa` (Workbox), Dexie (IndexedDB), Supabase (Postgres + Storage + Auth), Leaflet + OpenStreetMap, JSZip, exifr, marked + DOMPurify, fit-file-parser. Lettertypes Raleway en PT Serif (zoals pieterpad.nl, beide open source) zitten lokaal in de app, zodat ze offline werken.

### Datamodel

Alle records staan lokaal in IndexedDB en hebben dezelfde sync-velden: `id`, `updatedAt` (ms), `deleted` (tombstone), `dirty` (nog te versturen).

| Tabel | Velden |
|---|---|
| `stages` (Etappe) | nummer, naam, van, naar, afstandKm, status (`gepland`/`gelopen`), datum gelopen, duur (min), notities. Vooraf gevuld met de 26 etappes. De GPX-track(s) van een etappe zijn de gekoppelde routes. |
| `routes` (Route) | naam, etappe (optioneel: los = omleiding/extra), bron (gpx/tcx/fit/handmatig), bestandsnaam, datum, afstand, duur, bewegingstijd, stijgen/dalen, trackpunten `[lat, lon, hoogte?, tijd?]`, notities |
| `diary` (Dagboekentry) | datum, etappe, titel, tekst (markdown), stemming, weer |
| `photos` (Foto) | verkleinde JPEG + thumbnail (blob), bijschrift, opnamedatum, lat/lon (EXIF), etappe en/of dagboekentry, pad in Supabase Storage |
| `places` (Plek) | type (restaurant/café/overnachting), naam, adres, lat/lon, website, beoordeling 1–5, notitie, prijs, etappe |
| `outbox` | Homey-meldingen die nog verstuurd moeten worden |
| `settings` | instellingen (Homey, sync-cursor) |

Voortgang: een gelopen etappe telt met de officiële afstand. Een etappe die (nog) niet op gelopen staat maar wel routes heeft (bijv. het eerste deel) telt mee met de km van die routes, tot maximaal 95% van de etappe.

### Synchronisatie

Local-first: de app leest en schrijft altijd lokaal. De sync draait bij opstarten, bij online komen, bij terugkeren naar de app, ~3 s na elke wijziging en elke 5 minuten:

1. **Ophalen** van alles wat op de server veranderd is sinds de vorige keer (`server_updated_at`-cursor). Per record wint de nieuwste `updatedAt`.
2. **Versturen** van lokale wijzigingen (`dirty = 1`). Foto's worden eerst naar Storage geüpload.

Verwijderingen gaan als tombstone mee, zodat ze ook op andere apparaten verdwijnen (en ongedaan maken ook daar werkt). Foto's die op een ander apparaat zijn toegevoegd worden pas gedownload als je ze bekijkt.

## Lokaal ontwikkelen

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit-tests (parser, etappeherkenning, statistieken, sync)
npm run build      # productiebuild in dist/
npm run preview    # productiebuild lokaal bekijken (incl. service worker)
```

Optioneel: kopieer `.env.example` naar `.env` en vul je Supabase-gegevens in. Zonder `.env` kun je ze ook in de app invullen (Instellingen → Synchronisatie).

## Supabase instellen

1. Maak een (gratis) project aan op [supabase.com](https://supabase.com). Kies regio *West EU (Ireland)* of *Central EU (Frankfurt)*.
2. **Database + opslag + RLS**: open *SQL Editor → New query*, plak de inhoud van [`supabase/schema.sql`](supabase/schema.sql) en klik *Run*. Dit maakt:
   - de tabel `pp_records` met een trigger voor `server_updated_at`;
   - Row Level Security-policies: elke gebruiker ziet en wijzigt alleen zijn eigen rijen;
   - de privé storage-bucket `photos` met policies die alleen de map `<user-id>/` toestaan.
3. **Inloggen met magic link** (*Authentication*):
   - *Sign In / Providers → Email*: zorg dat Email aan staat. Zet eventueel *Allow new users to sign up* uit nadat je zelf een account hebt.
   - *URL Configuration*: zet **Site URL** op je productie-URL (bijv. `https://pieterpad.vercel.app`) en voeg bij **Redirect URLs** ook `http://localhost:5173` toe voor ontwikkelen.
   - *Emails → Templates → Magic Link*: voeg de code toe aan de e-mail, bijvoorbeeld:
     ```html
     <h2>Inloggen bij Pieterpad Tracker</h2>
     <p><a href="{{ .ConfirmationURL }}">Log in</a></p>
     <p>Of typ deze code in de app: <strong>{{ .Token }}</strong></p>
     ```
     **Waarom de code?** Een app op het iPhone-beginscherm heeft eigen opslag, los van Safari. Een magic link opent in Safari, waardoor je dáár inlogt en niet in de app. Met de code log je direct in de app zelf in.
4. Kopieer bij *Project Settings → API* de **Project URL** en de **anon public key**. Zet ze in `.env` (of als environment variables bij je hosting), of vul ze in de app in bij Instellingen → Synchronisatie.

De anon key is bedoeld om in de browser te staan; de beveiliging zit in de RLS-policies.

## Hosten

### Vercel

1. Push de repo naar GitHub en importeer hem op [vercel.com/new](https://vercel.com/new). Framework: *Vite* (wordt herkend).
2. Voeg bij *Environment Variables* `VITE_SUPABASE_URL` en `VITE_SUPABASE_ANON_KEY` toe (optioneel).
3. Deploy. `vercel.json` zorgt dat alle paden naar `index.html` gaan en dat `sw.js` niet gecachet wordt.

### Netlify

1. *Add new site → Import an existing project*, kies de repo. Build command `npm run build`, publish directory `dist` (staat al in `netlify.toml`).
2. Voeg dezelfde environment variables toe en deploy.

Zet daarna de productie-URL als **Site URL** in Supabase (stap 3 hierboven).

### Installeren op de iPhone

Open de URL in **Safari** → deelknop → *Zet op beginscherm*. Daarna draait de app schermvullend en offline. Nieuwe versies worden in de achtergrond gedownload; de app vraagt dan of je wilt bijwerken.

Tip: maak af en toe een back-up (Instellingen → Back-up → Exporteren → *Bewaar in Bestanden*). Safari kan bij langdurig niet-gebruik websitedata opruimen; de app vraagt om "persistente opslag" om dat te voorkomen, en met Supabase-sync staat alles ook in de cloud.

## Homey-koppeling

1. Maak in de Homey-app een flow met de webhook-trigger van Homey (“Er is een webhook aangeroepen”) en event-naam `pieterpad_etappe_afgerond`.
2. Je webhook-URL is `https://webhook.homey.app/<jouw-homey-id>/pieterpad_etappe_afgerond`. Je Homey-ID vind je via [tools.developer.homey.app](https://tools.developer.homey.app) (System).
3. In de app: Instellingen → Homey-koppeling → zet aan, vul de URL in (je mag `{event}` gebruiken: `https://webhook.homey.app/<id>/{event}`) en tik op **Test**.

Bij het afronden van een etappe stuurt de app (GET, aanbevolen):

```
https://webhook.homey.app/<id>/pieterpad_etappe_afgerond?tag=3|21|55|10.9&event=pieterpad_etappe_afgerond&etappe=3&naam=Groningen – Zuidlaren&km=21&totaalKm=55&procent=10.9&datum=2026-05-17
```

- `tag` is het token dat Homey in je flow beschikbaar maakt. Het formaat stel je zelf in (standaard `{etappe}|{km}|{totaalKm}|{procent}`), bijvoorbeeld alleen `{procent}` als je flow alleen dat nodig heeft.
- Alle waarden gaan daarnaast als losse query-parameters mee; met methode **POST** ook als JSON in de body.
- De URL is generiek: elke webhook-dienst (Home Assistant, IFTTT, n8n, …) werkt ook. Placeholders: `{event} {etappe} {naam} {km} {totaalKm} {procent} {datum}`.
- Zonder internet wordt de melding bewaard en verstuurd zodra je weer online bent.

Omdat de browser het antwoord van een andere server niet mag lezen (CORS), kan de app niet controleren of Homey de melding goed ontving; gebruik de testknop en kijk in Homey of de flow startte.

## Testbestanden

In [`samples/`](samples/) staan testbestanden (gegenereerd met `node scripts/make-samples.mjs` op basis van de etappelijnen, met tijden, pauze en hoogteprofiel):

| Bestand | Verwacht resultaat |
|---|---|
| `etappe-01-pieterburen-winsum.gpx` | Etappe 1, ~12 km, ~3 u incl. 25 min pauze |
| `etappe-03-deel-1-groningen-haren.gpx` + `…-deel-2-haren-zuidlaren.gpx` | Allebei etappe 3, elk ~45–55% ("deels") |
| `etappe-08-coevorden-hardenberg.fit` | Etappe 8 (FIT-formaat) |
| `etappe-12-holten-laren.tcx` | Etappe 12 (TCX-formaat) |
| `etappe-26-omgekeerd-maastricht-strabeek.gpx` | Etappe 26, omgekeerde richting |
| `los-wandeling-utrechtse-heuvelrug.gpx` | Geen etappe (losse route) |

De unit-tests in `src/lib/*.test.ts` gebruiken deze bestanden.

## Bronnen en verantwoording

- Etappenamen en afstanden: tabel op [pieterpad.nl/etappes](https://www.pieterpad.nl/etappes) (gecontroleerd november 2026). Totaal 506 km.
- `src/data/stageLines.json`: sterk vereenvoudigde lijnen (±35 m nauwkeurig) afgeleid van de GPX-bestanden op pieterpad.nl, alleen gebruikt om de kaart te tekenen en routes aan etappes te koppelen. Wil je de exacte route, download dan de GPX op pieterpad.nl of koop de gids.
- De verdeling van grensoverschrijdende etappes over provincies is een schatting.
- Kaarttegels: © OpenStreetMap-bijdragers. Adres zoeken via Nominatim (alleen op verzoek).
- Kleuren en typografie zijn geïnspireerd op pieterpad.nl (rood `#ec211d`, donkerblauw `#292c3d`, Raleway/PT Serif); voor tekst wordt een iets donkerder rood gebruikt voor voldoende contrast in fel zonlicht.
- `npm run icons` rendert `public/favicon.svg` opnieuw naar de PNG-iconen (vereist Playwright).
