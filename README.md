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

I trin 4 kan brugeren vælge Apple Påmindelser som alternativ til eTilbudsavis. Den indbyggede vejledning beskriver en engangsopsætning af genvejen `Madplan til Påmindelser`: Opdel Genvejsinput på nye linjer → Gentag med hver → Tilføj ny påmindelse med Gentag emne som titel i en valgt liste. Brugeren opretter eller vælger listen i Påmindelser. Hver overførsel føjer nye punkter til listen.

Appen sender én URL-kodet tekstlinje pr. ingrediens via Apples dokumenterede `shortcuts://run-shortcut?name=…&input=text&text=…`. Navn og mængde er begge i påmindelsens titel. Eksisterende sammenlægninger, beholdningsfradrag, udeladelser og skjulte ingredienser gælder også her. Ingen eTilbudsavis-session kræves; ingen data sendes til en eksportserver. Appen kan ikke bekræfte oprettelsen i Påmindelser. Den egentlige native afvikling skal verificeres på en Apple-enhed med genvejen installeret.

Kilde: https://support.apple.com/da-dk/guide/shortcuts/apd624386f42/ios

## Trinvis navigation

Appens fire trin vises som separate sider med hash-adresserne `#trin-1` til `#trin-4`. Videre, Tilbage, trinnavigation og browserens tilbage/ frem-knapper bevarer indtastninger og valg. Sidste trin huskes lokalt ved genindlæsning. Trin 3 og 4 kræver mindst én valgt ret. Ingrediensgrupper og skjulte ingredienser findes nederst på trin 3.

Start forfra viser en forklaring og nulstiller kun den aktuelle plans valg, beholdningsfradrag og udeladelser. Gemte opskrifter, skjulte ingredienser, sammenlægninger, omregningsfaktorer, login og eksportopsætning bevares. Fortryd gendanner den tidligere plan i samme åbne side. Navigation og genstart blokeres under import og overførsel, så igangværende arbejde ikke blandes med en ny plan.
