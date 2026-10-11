# Madplan

Mobil webapp: Sund på Budget-opskrifter → samlede ingredienser → fradrag for beholdning → eksisterende indkøbsliste i eTilbudsavis.

Production: https://madplan-woad.vercel.app/

## Vercel

Projektet `madplan` deployer `main` fra `TheBikingVikingDK/madplan`. Buildless HTML med Node.js-funktioner i `api/`. Vercel installerer Cheerio til opskriftsimporten. Ingen database kræves.

Sæt `SESSION_SECRET` som production Secret med 32 tilfældige bytes i hex-format. Den må ikke committtes eller være en offentlig browser-variabel. Miljøændringer kræver en ny deployment. Brug en anden nøgle på previews, hvis login ønskes dér.

## Ugevalg

Appen starter på den nyeste almindelige sunde madplan fra Sund på Budget. Vælg uge i dropdownen og tryk Vælg ret for at hente ingredienser og vælge retten. Du kan blande op til tre retter fra forskellige uger. Hent flere tidligere uger udvider arkivet. Uger og menuer læses fra den offentlige WordPress REST API og filtreres til kategorien `sunde-madplaner`.

## iPhone

Åbn production-adressen i Safari → Del → Føj til hjemmeskærm → Tilføj. Åbn Madplan fra ikonet og log ind i eTilbudsavis. Manifest, PNG-ikoner og standalone metadata er inkluderet. Gemt madplan kan åbnes offline; import og eTilbudsavis kræver internet.

## Tests

`npm test` kører Node.js-tests uden eksterne kald. Se [integrationsbeskrivelsen](docs/etilbudsavis.md) for login, dubletregler og live-testbegrænsninger.

## Ingredienser og mål

Almindelige navnevarianter og størrelsesangivelser lægges sammen, fx løg/alm. løg/stort løg og gulerod/gulerødder. Rødløg, forårsløg, rå/kogte ris, meltyper og hakket/ikke-hakket kød holdes adskilt. Opskrifternes originale linjer vises under hver samlet ingrediens.

Kg/g og l/dl/cl/ml omregnes direkte. Måleskeer regnes som 15 ml/spsk og 5 ml/tsk. Volumen til vægt bruger omtrentlige råvarefaktorer i gram pr. dl, baseret på [DTU's mål- og vægttabeller](https://www.food.dtu.dk/-/media/institutter/foedevareinstituttet/publikationer/pub-2013/rapport_maal-vaegt-og-portionsstoerrelser-paa-foedevarer.pdf) og [Arlas mel-, gryn- og ristabel](https://www.arla.dk/opskrifter/leksikon/viden/vaegt-mel-gryn-ris-og-kerner/). Fx bruges 80 g/dl for tørre almindelige ris, 85 g/dl for brune ris, 60 g/dl for hvedemel og 35 g/dl for havregryn. Risvarianter bruger faktor for den relevante kategori; basmati/jasmin estimeres som almindelige tørre ris. Omregning markeres med ca. Faktoren kan ændres i appen og gemmes lokalt. Ukendte råvarer kræver en brugerangivet faktor; appen antager ikke 1 ml = 1 g. Styk, pakker og dåser omregnes ikke til gram uden vareoplysninger.

Eksisterende beholdning og udeladelser migreres til de nye ingrediensnavne/enheder. eTilbudsavis' dubletkontrol bruger de samme navnevarianter.
