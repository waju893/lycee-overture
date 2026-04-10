Lycee Overture battle priority patch

Included files:
- src/game/BattleRestrictions.ts (new)
- src/game/GameTypes.ts
- src/game/GameRules.ts
- src/game/GameEngine.ts

What this patch changes:
1. Adds battle-forbidden keyeffect constants and set:
   step=2, sidestep=3, orderstep=4, jump=5, orderchange=9, convert=20
2. Adds battle.phase and battle.priorityPlayer / passedPlayers tracking.
3. Changes attack resolution flow to:
   attack declaration resolves -> defender selection wait -> duringBattle priority window -> both players pass -> final battle resolution
4. Blocks rule-based useCharacter during duringBattle.
5. Blocks declarations from cards that carry battle-forbidden keyeffects while battle is active.
6. PASS_PRIORITY during duringBattle now rotates priority and only resolves battle after both players pass.

Important limitations of this patch:
- It is intentionally conservative and keeps the existing legacy declaration stack model.
- It does not fully rework nested response stack semantics beyond the current project structure.
- It assumes SET_DEFENDER already exists in your UI / action flow.
- Effect/ability-based special summon exceptions are not separately tagged yet; the current block only stops the regular useCharacter path during duringBattle.

Suggested test flow:
- attack declaration -> defender selection -> duringBattle pass/pass -> battle resolves
- duringBattle useCharacter should be blocked
- duringBattle cards with step/sidestep/orderstep/jump/orderchange/convert should be blocked
