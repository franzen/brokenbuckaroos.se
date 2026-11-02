# Broken Buckaroos

Statisk webbplats för Broken Buckaroos, byggd med React och Vite för GitHub
Pages. Allt publikt innehåll hämtas dynamiskt från Oortis CMS i besökarens
webbläsare.

## Lokal utveckling

1. Kopiera `.env.example` till `.env` och ange CMS-adressen.
2. Kör `npm install`.
3. Kör `npm run dev`.

## GitHub Pages

Workflow-filen bygger och publicerar automatiskt `dist` när `main` uppdateras.
Lägg CMS-adressen i repository-variabeln `CMS_URL` under GitHub Actions.
Webbplatsen hittas med `VITE_CMS_SITE_KEY`, som workflow-filen sätter till
`broken-buckaroos`. Bygget hämtar
webbplatsens URL och bassökväg från GitHub Pages, även för en egen domän.
`404.html` är en kopia av appskalet så att alla CMS-drivna rutter fungerar även
vid direktlänkning.

Alla Oortis CMS v1-block stöds, liksom navigation, media, inlägg, evenemang,
omdirigeringar och dynamisk metadata.

## Förhandsvisning av sidor

Förhandsvisningen körs helt i webbläsaren. Den behöver ingen webbserver,
serverrendering, edge-funktion eller ombyggnad när innehållet ändras. CMS:ets
Preview-knapp öppnar en delbar länk med `?preview=<token>`; även osparade sidor
och nya adresser renderas med webbplatsens vanliga layout från `404.html`.
GitHub Pages HTTP-status 404 för en sådan adress är tillåten. Ett 404-svar från
CMS:ets preview-API betyder däremot att länken inte längre är tillgänglig.

Förhandsvisningen använder samma `VITE_CMS_URL` och `VITE_CMS_SITE_KEY` som
publicerade sidor. Webbläsaren slår först upp den aktiva webbplatsen via det
publika API:et och använder dess id för preview-anropet. Ett separat
`VITE_CMS_SITE_ID` eller `CMS_SITE_ID` behövs inte. Uppslagningen kräver inte
att sidan som förhandsvisas finns eller är publicerad. Om uppslagningen misslyckas
försöker preview igen utan att visa publicerat innehåll.

`VITE_SITE_URL` är valfri och anger hela distributionsroten, till exempel
`https://brokenbuckaroos.se/` eller `https://owner.github.io/brokenbuckaroos.se/`.
Vite använder dess sökväg för skript, stilmallar, bilder och webbplatslänkar.
Utan inställningen används basen `/brokenbuckaroos.se/`, och preview använder
webbläsarens origin tillsammans med Vites bassökväg. Ingen extra URL-inställning
behövs för lokal preview. GitHub Pages-workflow-filen sätter `VITE_SITE_URL`
automatiskt; om du anger den manuellt måste värd, port och bassökväg matcha
webbplatsen som öppnas.

Webbplatsens `primary_url` i CMS ska peka på distributionsroten där du vill öppna
preview, inklusive en eventuell projektsökväg. För lokal preview ska den alltså
peka på den lokala Vite-adressen.

CMS ska vara tillgängligt via HTTPS från den publicerade webbplatsen. API:ets
CORS-policy måste tillåta webbplatsens origin och headern `X-CMS-Preview`,
inklusive OPTIONS-preflight. Endast publika inställningar ska ingå i bygget;
inga personalinloggningar eller backendhemligheter används.

Snapshot hämtas före normal sidladdning och uppdateras en gång per sekund utan
överlappande anrop. Statusfältet visar anslutningen och sista giltighetstid.
Vid tillfälliga nätverksfel visas den senast lästa sidan fram till deadline;
utgångna, avslutade och ogiltiga länkar tar bort innehållet direkt. Navigering
till en annan sida avslutar preview i den fliken.

Token skickas endast i `X-CMS-Preview` till preview-API:et och finns kvar i
adressfältet för delning och omladdning. Snapshot och intern token lagras bara
i minnet. API-anrop använder `cache: no-store`; layout och statiska filer får
cachas normalt och bygger aldrig in utkast. Tidiga referrer- och robots-meta-taggar
skyddar preview innan resurser laddas. Webbplatsen registrerar ingen service
worker; en framtida service worker måste undanta preview-API:et från cache.
Inga egna HTTP-headerregler krävs på GitHub Pages.

## Tester

Kör `npm ci` och `npx playwright install chromium` första gången, därefter
`npm test` och `npm run lint`. `npm test` kör livscykeltester med Vitest, kontrollerar
bygget och testar webbläsaren mot en testserver som serverar endast statiska filer.
Webbläsartesterna bygger både en domänrot och en projektsökväg och returnerar
HTTP 404 för adresser som saknas i bygget. Testservern publiceras inte.
