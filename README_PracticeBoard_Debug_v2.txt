
Lycee Overture PracticeBoard Debug Patch (v2)

Purpose
-------
Adds a floating debug panel to PracticeBoard so battle priority and
defender selection behaviour can be visually inspected during tests.

Files
-----
src/components/BattleDebugPanel.tsx
src/game/debug/getBattleDebugState.ts
src/components/PracticeBoard.debug.patch.tsx

How to Apply
------------
1. Copy BattleDebugPanel.tsx to:
   src/components/BattleDebugPanel.tsx

2. Copy getBattleDebugState.ts to:
   src/game/debug/getBattleDebugState.ts

3. Follow instructions inside:
   src/components/PracticeBoard.debug.patch.tsx

Test Commands
-------------
npm test
npx vitest run --config vitest.config.ts

GitHub Sync
-----------
git add src/components/BattleDebugPanel.tsx
git add src/game/debug/getBattleDebugState.ts
git commit -m "Add PracticeBoard battle debug overlay"
git push
