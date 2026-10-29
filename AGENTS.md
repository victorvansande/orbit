# Voor elke AI-agent (Antigravity, Gemini, Codex, ...)

Lees **CLAUDE.md** volledig vóór je iets doet. Dat is de enige bron van waarheid voor dit project (Orbit): werkafspraken, ontwerpkeuzes van Victor, bestanden, valkuilen en de overdracht tussen tools.

Kort de harde regels (de volledige staan in CLAUDE.md, sectie Samenwerking, en in `.agent/rules/orbit.md`):

- Eerst `git pull origin main`, daarna de laatste regels onder "Overdracht" in CLAUDE.md lezen.
- Alles wat je verandert ook in CLAUDE.md zetten, en bij het stoppen een regel onder "Overdracht".
- Na elke afgeronde wijziging committen en pushen naar `main`. Nooit force push, rebase of amend: ongedaan maken = `git revert`.
- Nooit secrets beheren. Nooit gegevens van gebruikers laten verdwijnen.
- Geen em dashes, geen marketingtaal, geen emoji. Nederlands.
- Testen op 1440×900 en 375 px, licht en donker, console foutloos.
