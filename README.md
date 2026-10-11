# Madplan

Mobilvenlig prototype til at samle ingredienser fra op til tre opskrifter og fratrække varer, der allerede er hjemme.

## Status
- [x] Gem opskrifter og links manuelt
- [x] Vælg op til tre retter
- [x] Saml ens ingredienser med samme enhed; kg→g, l/dl→ml
- [x] Fratræk beholdning og udelad varer
- [x] Lokal lagring i browseren
- [x] Kopiér indkøbsbehov
- [ ] Automatisk import fra Sund på Budget
- [ ] Sikker eTilbudsavis API-integration med dubletkontrol

## Prøv
Åbn index.html i browseren eller publicér via en statisk webhost.

## Begrænsninger
Der er endnu ingen automatisk eTilbudsavis-synkronisering. Den uofficielle API skal undersøges og implementeres server-side; aldrig læg credentials i frontend. Import er indtil videre manuel. Ingrediensparseren understøtter simple mængder og enheder, ikke alle varianter. Opskrifter gemmes lokalt i browseren, ikke på tværs af enheder.
