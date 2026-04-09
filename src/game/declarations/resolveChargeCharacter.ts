import type { CardRef, GameState, LegacyDeclaration, PlayerID } from "../GameTypes";
import { appendLog } from "../engine/cloneState";
import { findCardOwnerOnField } from "../engine/utils";

export function resolveChargeCharacter(state: GameState, declaration: LegacyDeclaration): void {
  if (!declaration.sourceCardId) return;

  const owner = declaration.playerId as PlayerID;
  const found = findCardOwnerOnField(state, declaration.sourceCardId);
  if (!found || found.playerId !== owner) return;

  const payload = declaration.payload ?? {};
  const deckCount = Number(payload.deckCount ?? 0);
  const discardCardIds = Array.isArray(payload.discardCardIds)
    ? (payload.discardCardIds as string[])
    : [];

  const charged: CardRef[] = [];

  for (let i = 0; i < deckCount; i += 1) {
    const card = state.players[owner].deck.shift();
    if (!card) break;
    charged.push({ ...card, location: "charge" });
  }

  for (const chargeId of discardCardIds) {
    const discardIndex = state.players[owner].discard.findIndex((card) => card.instanceId === chargeId);
    if (discardIndex >= 0) {
      const [card] = state.players[owner].discard.splice(discardIndex, 1);
      charged.push({ ...card, location: "charge" });
    }
  }

  found.card.chargeCards = [...(found.card.chargeCards ?? []), ...charged];
  appendLog(state, `차지 해결: ${declaration.sourceCardId} (+${charged.length})`);
}
