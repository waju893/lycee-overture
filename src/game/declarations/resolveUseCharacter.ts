import type { EngineEvent, GameState, LegacyDeclaration, PlayerID } from "../GameTypes";
import { placeCharacterOnField } from "../GameRules";
import { appendLog } from "../engine/cloneState";
import { removeCardFromHand } from "../engine/utils";

export function resolveUseCharacter(state: GameState, declaration: LegacyDeclaration): void {
  const slot = declaration.targetSlots?.[0];
  const playerId = declaration.playerId as PlayerID;
  const card = declaration.sourceCardId
    ? removeCardFromHand(state, playerId, declaration.sourceCardId)
    : undefined;

  if (!card || !slot) return;

  placeCharacterOnField(state, playerId, slot, {
    ...card,
    location: "field",
    isTapped: false,
  });

  state.events.push({
    type: "CHARACTER_USED",
    playerId,
    cardId: card.instanceId,
  } as EngineEvent);

  appendLog(state, `등장 선언 해결: ${card.name} -> ${slot}`);
}
