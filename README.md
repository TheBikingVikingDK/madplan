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

## Personer og antal gange

Trin 1 har antal personer (standard 4) og +/- for 1–30 gange pr. valgt ret. Valgene deles i skyen. Indkøbsbehovet beregnes som original ingrediensmængde × personer i planen / originalt portionsantal × antal gange. Skaleringen sker før enhedsomregning, sammenlægning og fradrag for beholdning, uden at ændre originalopskriften. eTilbudsavis, kopiering og Påmindelser bruger samme beregnede behov.

Kildens recipeYield eller det synlige opskriftskorts portionsantal hentes ved import og for tidligere gemte retter. Manglende antal bruger en tydeligt markeret antagelse om 4 personer, som kan rettes ved retten. Sammensatte opskrifter bevarer hver dels portionsantal; ekstra ingredienser skaleres med hovedretten. Originalens ingredienser og portionsantal vises i forhåndsvisningen. Antal personer bevares ved Start forfra; antal gange nulstilles. Fortryd gendanner de tidligere antal. Gamle delte dokumenter uden disse felter åbnes med 4 personer og 1 gang.

Aktuelt forløb: 1 Vælg retter, 2 Tilpas mængder, 3 Tilpas indkøb, 4 Send indkøbslisten, 5 Ugens madplan. Personantal på trin 1 kan ændres med separate +/− knapper. Mængder pr. valgt ret findes kun på trin 2. Trinpositioner i tidligere lokale og delte planer flyttes til samme indhold i det nye forløb. `flowVersion:5` forhindrer gentagen migrering.

Deling vises som en tydelig grøn boks øverst med knapperne Gem og del / Del fælles madplan samt Åbn med kode. Knapperne åbner en native modal dialog med fokusstyring, Luk og Escape. Delingskode, link, oprettelse, status og eksisterende delingsfunktioner findes i dialogen. Gemmestatus og fejl er også synlige i boksen, når dialogen er lukket.

Delingsboksen i sidetoppen er erstattet af en 46 px ikonknap øverst til højre ved trinnavigationen. Knappen bruger et delingsikon med tilgængeligt navn og bevarer den eksisterende popup. Valgt-antal er fjernet fra toplinjen; fælles status findes i popup’en. En lille prik markerer gemt/afventende/konflikt uden at fylde på siden.

Alle popup’er bruger en fælles scroll-lås: siden fastlåses før åbning, kun dialogen kan rulle, og baggrundens position samt tidligere inline-styles gendannes ved Luk/Escape. Scroll chaining fra popup’en begrænses med overscroll-behavior. Flere åbne dialoger holder låsen, indtil den sidste er lukket.

Trin 3: Ret navn åbner et felt med Gem, Annuller og mulighed for oprindeligt navn. Visningsnavne gemmes separat fra ingrediensidentitet og bruges i eksport; de synkroniseres med fælles madplaner. Sammenlægning aktiveres med en tydelig knap og bruger checkbokse direkte i ingredienslisten. Gemte grupper kan ophæves nederst.
