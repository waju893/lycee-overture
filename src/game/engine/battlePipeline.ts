import type { GameState } from "../GameTypes";
import { getOpponentPlayerId } from "../GameTypes";
import { removeCardFromAllZones } from "../GameRules";
import { appendLog } from "./cloneState";
import { findCardOwnerOnField, millFromDeckToDiscard } from "./utils";

export function setDefender(state: GameState, playerId: "P1" | "P2", defenderCardId?: string): void {
  if (!state.battle.isActive) return;
  if (!state.battle.attackerCardId || !state.battle.attackerPlayerId) return;

  const attackerInfo = findCardOwnerOnField(state, state.battle.attackerCardId);
  if (!attackerInfo) {
    state.battle = { isActive: false, awaitingDefenderSelection: false };
    return;
  }

  const defenderPlayerId = state.battle.defenderPlayerId ?? getOpponentPlayerId(attackerInfo.playerId);
  if (playerId !== defenderPlayerId) {
    appendLog(state, "NOT_DEFENDER_PLAYER");
    return;
  }

  const dmg = attackerInfo.card.dmg ?? attackerInfo.card.damage ?? 1;
  if (defenderCardId) {
    const found = findCardOwnerOnField(state, defenderCardId);
    if (found && found.playerId === defenderPlayerId) {
      state.battle.defenderCardId = defenderCardId;
      attackerInfo.card.isTapped = true;

      if ((attackerInfo.card.ap ?? attackerInfo.card.power ?? 0) > (found.card.dp ?? found.card.hp ?? 0)) {
        removeCardFromAllZones(state.players[defenderPlayerId], found.card.instanceId);
      }

      if ((found.card.ap ?? found.card.power ?? 0) > (attackerInfo.card.dp ?? attackerInfo.card.hp ?? 0)) {
        removeCardFromAllZones(state.players[attackerInfo.playerId], attackerInfo.card.instanceId);
      }

      state.battle = { isActive: false, awaitingDefenderSelection: false };
      appendLog(state, `배틀 해결: ${attackerInfo.card.instanceId} vs ${defenderCardId}`);
      return;
    }
  }

  attackerInfo.card.isTapped = true;
  millFromDeckToDiscard(state, defenderPlayerId, dmg);
  state.battle = { isActive: false, awaitingDefenderSelection: false };
  appendLog(state, `직접 공격 처리: ${attackerInfo.card.instanceId} / DMG ${dmg}`);
}
