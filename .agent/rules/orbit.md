---
trigger: always_on
---

# Orbit: regels voor Antigravity

Dit project wordt afwisselend bewerkt met Claude Code en met Antigravity. Alle projectkennis en werkafspraken staan in **CLAUDE.md** in de root. Dat bestand is de enige bron van waarheid.

## Altijd, bij elke taak

1. **Lees eerst CLAUDE.md** (kort), vóór je iets wijzigt. Details staan in `docs/kennis.md`: zoek er gericht in (grep), lees het niet volledig. Lees zeker de secties Identiteit (wat Orbit is, plus de checklist "Klaar is pas klaar"), Werkafspraken, Samenwerking en Overdracht, en de sectie over het onderdeel waar je aan werkt. Volg alles wat erin staat, ook als het afwijkt van je eigen gewoontes.
2. **Begin met `git pull origin main`.** Lees daarna de laatste regels onder "Overdracht" in CLAUDE.md en `git log --oneline -15`, zodat je weet wat er laatst gebeurde.
3. **Zet alles wat je verandert in `docs/kennis.md`**, in de sectie waar het thuishoort (CLAUDE.md blijft kort, onder 15 KB): wat, waarom, wat Victor koos of afwees (met datum), welke bestanden, functies, sleutels en tokens, en hoe je het getest hebt. Wat niet in CLAUDE.md staat, bestaat voor de volgende sessie niet.
4. **Voeg bij het stoppen een regel toe onder "Overdracht"** onderaan CLAUDE.md (hooguit 10 regels, oudere verhuizen naar het einde van `docs/kennis.md`): datum, tool (Antigravity), wat er af is, wat nog openstaat.
5. **Commit en push naar `main`** na elke afgeronde wijziging. Commitberichten in het Nederlands.

## Nooit

- Nooit `git push --force`, `rebase`, `reset --hard` of `commit --amend` op gepushte commits. Iets ongedaan maken = `git revert`.
- Nooit secrets of API-tokens invullen, aanmaken of beheren (de Cloudflare-secrets staan als GitHub secrets, door Victor ingesteld).
- Nooit taken, het archief, sync of opslagsleutels zo wijzigen dat bestaande gegevens verloren gaan. Lees eerst "Vangnet: nooit iets kwijt" in CLAUDE.md.
- Geen em dashes, geen marketingtaal en geen emoji, ook niet in commits en docs. UI-tekst in het Nederlands én Engels (`src/core/i18n.js`).
- Geen build-stap, geen frameworks, geen npm-dependencies in de app.
- Geen code buiten de mappenstructuur: volg CLAUDE.md, sectie **Structuur** (mappen per domein, afhankelijkheden één kant op, nieuwe functies in een module van hun domein en niet in `app.js`, geen dode code).
- Geen losse kleuren: altijd een CSS-token op `:root`, ook herdefinieerd voor het donkere thema.
- Geen werk aan andere projecten in deze map.
- `docs/kennis.md` niet inkorten of herschrijven: alleen aanvullen of verbeteren wat niet meer klopt. CLAUDE.md is de korte kern (onder 15 KB).

## Testen vóór elke push

- Lokaal: `python3 -m http.server 3000` in de root, open http://localhost:3000/.
- Desktop 1440×900 én gsm 375 px, licht én donker thema.
- Console foutloos, geen horizontale scroll (`document.documentElement.scrollWidth === innerWidth`).
- Logisch uitgelijnd: wat bij elkaar hoort deelt een rand of lijn (tekst en zichtbare randen op de randen van de inhoud), niets onnodig forceren. Nameten met `getBoundingClientRect`. Zie CLAUDE.md, Identiteit, Gedrag.
- Genoeg lucht: binnen een groep 2 tot 10 px, tussen groepen minstens 16 px, onder een groot vlak (poster, kaart, QR, scène) minstens 20 px, een regel onder een merk of titel minstens 8 px. Nameten tussen zichtbare tekst en randen. Zie CLAUDE.md, Identiteit, Gedrag.
