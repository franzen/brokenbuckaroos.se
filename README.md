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
`404.html` är en kopia av appskalet så att alla CMS-drivna rutter fungerar även
vid direktlänkning.

Alla Oortis CMS v1-block stöds, liksom navigation, media, inlägg, evenemang,
omdirigeringar och dynamisk metadata.
