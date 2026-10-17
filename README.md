# Madplan

Mobil webapp: Sund på Budget-opskrifter → samlede ingredienser → fradrag for beholdning → eksisterende indkøbsliste i eTilbudsavis.

Production: https://madplan-woad.vercel.app/

## Vercel

Projektet `madplan` deployer `main` fra `TheBikingVikingDK/madplan`. Buildless HTML med Node.js-funktioner i `api/`. Vercel installerer Cheerio til opskriftsimporten. Ingen database kræves.

Sæt `SESSION_SECRET` som production Secret med 32 tilfældige bytes i hex-format. Den må ikke committtes eller være en offentlig browser-variabel. Miljøændringer kræver en ny deployment. Brug en anden nøgle på previews, hvis login ønskes dér.

## Ugevalg

Appen starter på den nyeste almindelige sunde madplan fra Sund på Budget. Vælg uge i dropdownen og tryk Vælg ret for at hente ingredienser og vælge retten. Du kan blande en eller flere retter fra forskellige uger. Hent flere tidligere uger udvider arkivet. Uger og menuer læses fra den offentlige WordPress REST API og filtreres til kategorien `sunde-madplaner`.

## iPhone

Åbn production-adressen i Safari → Del → Føj til hjemmeskærm → Tilføj. Åbn Madplan fra ikonet og log ind i eTilbudsavis. Manifest, PNG-ikoner og standalone metadata er inkluderet. Gemt madplan kan åbnes offline; import og eTilbudsavis kræver internet.

## Tests

`npm test` kører Node.js-tests uden eksterne kald. Se [integrationsbeskrivelsen](docs/etilbudsavis.md) for login, dubletregler og live-testbegrænsninger.

## Ingredienser og mål

Almindelige navnevarianter og størrelsesangivelser lægges sammen, fx løg/alm. løg/stort løg og gulerod/gulerødder. Rødløg, forårsløg, rå/kogte ris, meltyper og hakket/ikke-hakket kød holdes adskilt. Opskrifternes originale linjer vises under hver samlet ingrediens.

Kg/g og l/dl/cl/ml omregnes direkte. Måleskeer regnes som 15 ml/spsk og 5 ml/tsk. Volumen til vægt bruger omtrentlige råvarefaktorer i gram pr. dl, baseret på [DTU's mål- og vægttabeller](https://www.food.dtu.dk/-/media/institutter/foedevareinstituttet/publikationer/pub-2013/rapport_maal-vaegt-og-portionsstoerrelser-paa-foedevarer.pdf) og [Arlas mel-, gryn- og ristabel](https://www.arla.dk/opskrifter/leksikon/viden/vaegt-mel-gryn-ris-og-kerner/). Fx bruges 80 g/dl for tørre almindelige ris, 85 g/dl for brune ris, 60 g/dl for hvedemel og 35 g/dl for havregryn. Risvarianter bruger faktor for den relevante kategori; basmati/jasmin estimeres som almindelige tørre ris. Omregning markeres med ca. Faktoren kan ændres i appen og gemmes lokalt. Ukendte råvarer kræver en brugerangivet faktor; appen antager ikke 1 ml = 1 g. Styk, pakker og dåser omregnes ikke til gram uden vareoplysninger.

Eksisterende beholdning og udeladelser migreres til de nye ingrediensnavne/enheder. Eksisterende varer i eTilbudsavis får tilføjet mængden med de samme navnevarianter; se integrationsbeskrivelsen for tæller og note.

Markér to eller flere ingrediensnavne under **Sammenlæg ingredienser**, vælg det fælles navn og gem. Reglen bruges i fremtidige opskrifter og ved match til eTilbudsavis. Gemte sammenlægninger kan ophæves nederst. Navnene vises med stort startbogstav. Antal valgte retter og indkøbsmængder genberegnes ved hvert valg.

## Apple Påmindelser

I trin 3 kan brugeren vælge Apple Påmindelser som alternativ til eTilbudsavis. Den indbyggede vejledning beskriver en engangsopsætning af genvejen `Madplan til Påmindelser`: Opdel Genvejsinput på nye linjer → Gentag med hver → Tilføj ny påmindelse med Gentag emne som titel i en valgt liste. Brugeren opretter eller vælger listen i Påmindelser. Hver overførsel føjer nye punkter til listen.

Appen sender én URL-kodet tekstlinje pr. ingrediens via Apples dokumenterede `shortcuts://run-shortcut?name=…&input=text&text=…`. Navn og mængde er begge i påmindelsens titel. Eksisterende sammenlægninger, beholdningsfradrag, udeladelser og skjulte ingredienser gælder også her. Ingen eTilbudsavis-session kræves; ingen data sendes til en eksportserver. Appen kan ikke bekræfte oprettelsen i Påmindelser. Den egentlige native afvikling skal verificeres på en Apple-enhed med genvejen installeret.

Kilde: https://support.apple.com/da-dk/guide/shortcuts/apd624386f42/ios

## Trinvis navigation

Appens fire trin er vælg retter, tilpas indkøb, send listen og ugens madplan; de vises som separate sider med hash-adresserne `#trin-1` til `#trin-4`. Gemte retter vælges i en fold-ud-liste på trin 1. Videre, Tilbage, trinnavigation og browserens tilbage/ frem-knapper bevarer indtastninger og valg. Sidste trin huskes lokalt ved genindlæsning. Trin 2, 3 og 4 kræver mindst én valgt ret. Ingrediensgrupper og skjulte ingredienser findes nederst på trin 2. Tidligere gemte placeringer i forløbet med fire trin flyttes til det tilsvarende trin ved første åbning.

Start forfra vises på trin 2, 3 og 4. Knappen viser en forklaring og nulstiller kun den aktuelle plans valg, beholdningsfradrag og udeladelser. Gemte opskrifter, skjulte ingredienser, sammenlægninger, omregningsfaktorer, login og eksportopsætning bevares. Fortryd gendanner den tidligere plan i samme åbne side. Navigation og genstart blokeres under import og overførsel, så igangværende arbejde ikke blandes med en ny plan.

Trin 4 viser den aktuelle plans valgte retter i rækkefølge. Op/Ned flytter en ret én plads og gemmer rækkefølgen i den eksisterende `selected`-liste. Nye valg tilføjes sidst, og fravalg ændrer ikke rækkefølgen af de øvrige retter. Links åbnes i en ny fane. For sammensatte retter vises alle opskriftslinks, også fra eksisterende kildeoplysninger; opskrifter uden link viser deres ingredienser. Trin 4 kan åbnes direkte, uden at en ekstern indkøbsliste skal være overført først.

Trin 1: Klik på en ret eller miniature for at se billede og ingredienser i en dialog. Hele fremgangsmåden åbnes hos kilden i en ny fane. Sammensatte retter viser alle dele. Billeder hentes fra opskriftens strukturerede image-felt (eller og:image) og begrænses til HTTPS på sundpaabudget.dk. Manglende billeder udelades. Metadata hentes først nær synlige retter og genbruges under samme besøg.

Samlet opskriftstid vises på trin 1 og i forhåndsvisningen. totalTime foretrækkes; ellers summeres oplyst prepTime og cookTime. Opskriftskortets tidsfelter bruges som fallback. Manglende tider markeres eksplicit, ikke gættet. Ved sammensatte retter vises summen, med besked om at dele kan laves samtidig.

## Fælles madplan uden konto

“Gem og del madplan” opretter en privat JSON-plan i Vercel Blob. En kryptografisk tilfældig kode på 128 bit giver læse- og skriveadgang. Delingslinks bruger fragmentet `#plan=...`, så koden ikke sendes med referrer eller side-URL til serveren. Serveren bruger SHA-256 af koden som filnavn; ingen liste over planer udstilles. Browseren husker koden lokalt. Ingen eTilbudsavis-sessioner, loginoplysninger eller ikke-valgte gemte opskrifter deles.

`BLOB_READ_WRITE_TOKEN` tilknyttes gennem projektets private Blob-store (Frankfurt). SDK'et kan også bruge BLOB_STORE_ID og VERCEL_OIDC_TOKEN. Alle API-kald er same-origin POST med no-store. Dokumenter valideres og begrænses til 250 kB. Opdateringer bruger ETag/ifMatch til atomisk versionskontrol og private useCache:false-læsninger. Konflikter kræver eksplicit valg af lokal eller fælles version. Ingen automatisk overskrivning ved en konflikt.

Ændringer gemmes efter ca. 1,5 sekund. Åbne, synlige sider henter fælles ændringer hvert 15. sekund og ved tilbagevenden til siden. Input og åbne dialoger udsætter automatisk anvendelse; Opdatér fra skyen kan bruges manuelt. Ændringer ved manglende net gemmes lokalt og genforsøges. Gemmestatus og konflikter er synlige. Seneste aktivt valgte trin deles, men flytter kun en anden bruger ved genåbning af planen. Status for indkøbslisten deles separat og ændres ikke ved navigation. eTilbudsavis-overførsel registrerer sendt/delvist sendt; Påmindelser/manuel indsætning markeres manuelt efter kontrol. Ændret indkøbsbehov siden overførsel markeres.

Åbning af en delt plan bevarer en lokal sikkerhedskopi. Fortsæt lokalt afkobler denne enhed; cloudplanen bliver liggende. Sikkerhedskopien kan gendannes efter afkobling. “Start forfra” i en fælles plan nulstiller den fælles plans valg og status, når opdateringen er gemt.

Versionskontrol: En separat tilfældig dokumentrevision bevares uændret mellem skrivning og læsning. Transportens HTTP-ETag normaliseres før Blob ifMatch. Tests dækker også to samtidige skrivninger og forskelle mellem API- og HTTP-formater for ETags.
