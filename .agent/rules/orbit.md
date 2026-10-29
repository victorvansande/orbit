---
trigger: always_on
---

# Orbit: regels voor Antigravity

Dit project wordt afwisselend bewerkt met Claude Code en met Antigravity. Alle projectkennis en werkafspraken staan in **CLAUDE.md** in de root. Dat bestand is de enige bron van waarheid.

## Altijd, bij elke taak

1. **Lees eerst CLAUDE.md volledig**, vóór je iets wijzigt. Lees zeker de secties Werkafspraken, Samenwerking en Overdracht, en de sectie over het onderdeel waar je aan werkt. Volg alles wat erin staat, ook als het afwijkt van je eigen gewoontes.
2. **Begin met `git pull origin main`.** Lees daarna de laatste regels onder "Overdracht" in CLAUDE.md en `git log --oneline -15`, zodat je weet wat er laatst gebeurde.
3. **Zet alles wat je verandert ook in CLAUDE.md**, in de sectie waar het thuishoort: wat, waarom, wat Victor koos of afwees (met datum), welke bestanden, functies, sleutels en tokens, en hoe je het getest hebt. Wat niet in CLAUDE.md staat, bestaat voor de volgende sessie niet.
4. **Voeg bij het stoppen een regel toe onder "Overdracht"** onderaan CLAUDE.md: datum, tool (Antigravity), wat er af is, wat nog openstaat.
5. **Commit en push naar `main`** na elke afgeronde wijziging. Commitberichten in het Nederlands.

## Nooit

- Nooit `git push --force`, `rebase`, `reset --hard` of `commit --amend` op gepushte commits. Iets ongedaan maken = `git revert`.
- Nooit secrets of API-tokens invullen, aanmaken of beheren (de Cloudflare-secrets staan als GitHub secrets, door Victor ingesteld).
- Nooit taken, het archief, sync of opslagsleutels zo wijzigen dat bestaande gegevens verloren gaan. Lees eerst "Vangnet: nooit iets kwijt" in CLAUDE.md.
- Geen em dashes, geen marketingtaal en geen emoji, ook niet in commits en docs. UI-tekst in het Nederlands én Engels (`src/i18n.js`).
- Geen build-stap, geen frameworks, geen npm-dependencies in de app.
- Geen losse kleuren: altijd een CSS-token op `:root`, ook herdefinieerd voor het donkere thema.
- Geen werk aan andere projecten in deze map.
- CLAUDE.md niet inkorten of herschrijven: alleen aanvullen of verbeteren wat niet meer klopt.

## Testen vóór elke push

- Lokaal: `python3 -m http.server 3000` in de root, open http://localhost:3000/.
- Desktop 1440×900 én gsm 375 px, licht én donker thema.
- Console foutloos, geen horizontale scroll (`document.documentElement.scrollWidth === innerWidth`).
