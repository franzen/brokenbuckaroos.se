# Broken Buckaroos

Publik webbplats för Broken Buckaroos, byggd med vinext och Oortis CMS.

## Kom igång

1. Kopiera `.env.example` till `.env` och ange adressen till CMS:et.
2. Installera beroenden med `npm install`.
3. Starta utvecklingsservern med `npm run dev`.

CMS-sajten identifieras med `CMS_SITE_KEY`. Navigation hämtas från menyerna
`main` och `footer` om inget annat anges. Endast publicerat, anonymt läsbart
innehåll visas.

## Innehållsstöd

Alla Oortis CMS v1-block stöds: hero, rich text, image, image/text,
call-to-action, quote, content feed och embed. Sidor, inlägg, evenemang,
navigation, metadata, omdirigeringar och media hämtas dynamiskt.

## Kvalitetskontroll

- `npm run build`
- `npm run lint`
- `npm test`
