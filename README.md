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
