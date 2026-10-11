# eTilbudsavis integration

Madplan bruger eTilbudsavis' interne web-API. Protokollen er undersøgt med udgangspunkt i https://github.com/CagosDk/hacs-etilbudsavis/blob/main/custom_components/etilbudsavis/api.py og https://etilbudsavis.dk/. Dette er ikke en officiel integration; endpoints og svarformater kan ændres.

## Brug

1. Åbn Madplan i Safari og føj den til hjemmeskærmen. Åbn appikonet.
2. Gem opskrifter og vælg op til tre retter. Angiv beholdning og udelad basisvarer.
3. Log ind med e-mailadressen fra eTilbudsavis-kontoen og den sekscifrede e-mailkode.
4. Vælg en eksisterende indkøbsliste, gennemgå varerne og tryk Tilføj valgte varer.

Login-koder og tokens returneres ikke til browserens JavaScript. Tokenet ligger krypteret i en Secure, HttpOnly, SameSite=Strict cookie med 30 dages levetid; upstream-sessionen kan udløbe tidligere. `SESSION_SECRET` skal være en server-side Vercel Secret (mindst 32 tegn). OTP-cookie udløber efter 10 minutter. Udlogning fjerner begge cookies på denne enhed.

Aktive varer med samme navn (uanset store/små bogstaver og mellemrum) springes over. Afkrydsede varer blokerer ikke nye køb. Forskellige navne, fx `løg` og `rødløg`, kræver manuel gennemgang. Mængder samles i en note, og antal sættes til 1; appen beregner ikke antal pakker og ændrer ikke eksisterende varer. Ved flere enheder for samme ingrediens skrives begge mængder i noten.

Listen læses igen lige før overførsel. Hver vare sendes én gang uden automatisk retry. Ved en afbrudt forespørgsel kan en vare være oprettet, selv om svaret ikke nåede frem. Overførslen stopper, viser delresultatet og kræver ny gennemgang. Samtidige overførsler fra forskellige enheder kan stadig konkurrere; API'et tilbyder ikke en dokumenteret atomisk kontrol for dubletter.

Opskrifter og beholdning gemmes i localStorage på den aktuelle enhed/browser. Safari og hjemmeskærmstilstand kan have adskilt lagring. Indkøbslisten forbliver i eTilbudsavis. Service worker cacher kun appens offentlige filer, aldrig login eller API-svar.

## Verifikation

`npm test` tester parser, sessionskryptering, origin-kontrol, loginforløb, listeadgang, dubletter og delvist fejlede overførsler med simulerede API-svar. En komplet live-test kræver brugerens e-mailkode og konto. Koder indtastes i Madplan, aldrig i en chat eller et repository.
