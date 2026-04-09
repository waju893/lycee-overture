import type { GameState, LegacyDeclaration } from "../GameTypes";
import { appendLog } from "../engine/cloneState";
import { getDirectAttackInfo, millFromDeckToDiscard } from "../engine/utils";

export function resolveAttack(state: GameState, declaration: LegacyDeclaration): void {
  if (!declaration.sourceCardId) return;

  const info = getDirectAttackInfo(state, declaration.sourceCardId);
  if (!info) return;

  const { attackerInfo, defenderPlayerId, column, defender } = info;

  if (defender && !defender.isTapped) {
    state.battle = {
      isActive: true,
      attackerCardId: attackerInfo.card.instanceId,
      attackerPlayerId: attackerInfo.playerId,
      defenderPlayerId,
      attackColumn: column,
      awaitingDefenderSelection: true,
    };
    appendLog(state, `방어자 선택 대기: ${attackerInfo.card.instanceId}`);
    return;
  }

  const dmg = attackerInfo.card.dmg ?? attackerInfo.card.damage ?? 1;
  attackerInfo.card.isTapped = true;
  millFromDeckToDiscard(state, defenderPlayerId, dmg);
  state.battle = {
    isActive: false,
    awaitingDefenderSelection: false,
  };
  appendLog(state, `직접 공격 처리: ${attackerInfo.card.instanceId} / DMG ${dmg}`);
}
