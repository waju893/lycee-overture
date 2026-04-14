Lycee effect parser skeleton
===========================

This bundle adds a practical parser skeleton that works from Japanese `text` only.
`textKr` is not used for engine parsing.

Added files
-----------
- src/tools/card-import/LyceeEffectParserTypes.ts
- src/tools/card-import/parseLyceeEffectText.ts
- src/tools/card-import/buildParsedEffectsForAllCards.ts
- src/tools/card-import/reportUnresolvedLyceeParses.ts
- src/game/__tests__/LyceeEffectParser.test.ts

What it does
------------
1. Split card text into lines
2. Normalize digits and whitespace
3. Parse header like [誘発], [宣言], [常時]
4. Infer simple timings like onEnter / onTurnStart / onAttackDeclare
5. Parse common patterns first:
   - draw
   - modifyStat
   - chooseOne
   - searchCard
   - freeUse
   - optionalElse
6. Leave unknown lines as unresolved instead of failing silently

Recommended first commands
--------------------------
1) parser smoke test
npx vitest run src/game/__tests__/LyceeEffectParser.test.ts

2) parse all current card json files and write draft fields back into each json
npx ts-node src/tools/card-import/buildParsedEffectsForAllCards.ts "C:/Users/DESKTOP/Desktop/lycee-overture/public/cards"

3) create unresolved report to see what patterns to support next
npx ts-node src/tools/card-import/reportUnresolvedLyceeParses.ts "C:/Users/DESKTOP/Desktop/lycee-overture/public/cards"

Fields written into each card json
----------------------------------
- parsedEffectsDraft
- parseMeta
- unresolvedTextLines

Important note
--------------
This is a parser skeleton, not a full production parser.
The goal is to make parsing easy to extend.
Add new small parsers one by one based on the unresolved report.
