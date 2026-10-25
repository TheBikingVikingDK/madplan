# eTilbudsavis integration

Madplan bruger eTilbudsavis' interne web-API. Protokollen er undersøgt med udgangspunkt i https://github.com/CagosDk/hacs-etilbudsavis/blob/main/custom_components/etilbudsavis/api.py og https://etilbudsavis.dk/. Dette er ikke en officiel integration; endpoints og svarformater kan ændres.

## Brug

1. Åbn Madplan i Safari og føj den til hjemmeskærmen. Åbn appikonet.
2. Gem opskrifter og vælg en eller flere retter. Angiv beholdning og udelad basisvarer.
3. Log ind med e-mailadressen fra eTilbudsavis-kontoen og den sekscifrede e-mailkode.
4. Vælg en eksisterende indkøbsliste, gennemgå varerne og tryk Tilføj valgte varer.

Login-koder og tokens returneres ikke til browserens JavaScript. Tokenet ligger krypteret i en Secure, HttpOnly, SameSite=Strict cookie med 30 dages levetid; upstream-sessionen kan udløbe tidligere. `SESSION_SECRET` skal være en server-side Vercel Secret (mindst 32 tegn). OTP-cookie udløber efter 10 minutter. Udlogning fjerner begge cookies på denne enhed.

Aktive varer med samme navn eller en brugerdefineret navnevariant opdateres i stedet for at oprette en dublet. Preview viser den nye samlede note, og varerne kan fravælges. Ved oprettelse sendes noten i `comment`; opdateringer bruger `shortDescription` og varens eksisterende `clientId`. Vægt- og volumenmængder lægges sammen med de samme råvarefaktorer som i Madplan. Eksempel: `200 g` + `400 g` bliver `600 g`; `200 g` + `2 dl` ris bliver cirka `360 g`. Danske tusindtalsseparatorer i appens noter fortolkes korrekt.

Stykmængder øger både noten og styktælleren. Hvis en eksisterende stykvare ikke har en mængdenote, bruges dens tæller som antal styk. Ved gram og ml bevares tælleren, og mængden øges i noten; antal pakker kan ikke beregnes uden pakkestørrelse. En eksisterende vare uden en kendt vægt får bevaret en tydelig note om den ukendte mængde. Andre kommentarer bevares, og uforenelige enheder vises separat. Afkrydsede varer blokerer ikke nye køb. Hver bekræftet overførsel lægger mængderne til igen; dette er ikke en løbende synkronisering, som trækker mængder fra eTilbudsavis ved fravalg af retter.

Listen læses igen lige før overførsel. Hver vare sendes én gang uden automatisk retry. Ved en afbrudt forespørgsel kan en vare være oprettet, selv om svaret ikke nåede frem. Overførslen stopper, viser delresultatet og kræver ny gennemgang. Samtidige overførsler fra forskellige enheder kan stadig konkurrere; API'et tilbyder ikke en dokumenteret atomisk kontrol for dubletter.

Opskrifter og beholdning gemmes i localStorage på den aktuelle enhed/browser. Safari og hjemmeskærmstilstand kan have adskilt lagring. Indkøbslisten forbliver i eTilbudsavis. Service worker cacher kun appens offentlige filer, aldrig login eller API-svar.

## Verifikation

`npm test` tester parser, sessionskryptering, origin-kontrol, loginforløb, listeadgang, dubletter og delvist fejlede overførsler med simulerede API-svar. En komplet live-test kræver brugerens e-mailkode og konto. Koder indtastes i Madplan, aldrig i en chat eller et repository.

Skjulte ingredienser gemmes ved navn på enheden og udelades på tværs af opskrifter og enheder (g, ml, stk). Listen nederst kan foldes ud, og hver ingrediens kan vises igen. Ingredienslinjer med intervaller, fx `350-400 g kyllingebryst`, bruger den højeste mængde.

Brugergrupper oprettes under Sammenlæg ingredienser: markér mindst to navne, vælg fælles navn og gem. Grupper, beholdning, omregningsfaktorer og skjulte ingredienser gemmes på enheden. Grupper kan ophæves nederst; beholdningen for det valgte hovednavn bevares. Navne med stort startbogstav bruges i visning, kopiering og overførsel. Opskrifternes kildeingredienser bevares uændret.

Optælling og indkøbsbehov beregnes fra de aktuelt valgte opskrifter. En ændring ugyldiggør tidligere previews. Forsinkede svar på et preview kan ikke genindføre et forældet indkøbsbehov, og ændringer fra andre faner genberegnes via storage-eventet. Ukendte mængder skjuler ikke kendte delmængder.
