
/*
PATCH TARGET: src/components/PracticeBoard.tsx

1. Add imports at the top of the file:

import BattleDebugPanel from "./BattleDebugPanel";
import { getBattleDebugState } from "../game/debug/getBattleDebugState";

2. Inside the PracticeBoard component, obtain debug state:

const battleDebug = getBattleDebugState(engine);

(engine should be whatever instance or state object you already use.)

3. Add the debug panel somewhere inside the board root JSX:

<BattleDebugPanel state={battleDebug} />

That's it. This will render a floating debug window showing:
- current battle phase
- attacker
- defender
- column
- priority player
- declaration stack depth
*/
