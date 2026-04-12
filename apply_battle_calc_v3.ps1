
$ErrorActionPreference = 'Stop'

function Replace-Regex {
    param(
        [string]$Path,
        [string]$Pattern,
        [string]$Replacement
    )
    $content = Get-Content -Raw -Path $Path
    $updated = [regex]::Replace($content, $Pattern, $Replacement, [System.Text.RegularExpressions.RegexOptions]::Singleline)
    if ($updated -eq $content) {
        throw "Pattern not found in $Path"
    }
    Set-Content -Path $Path -Value $updated -Encoding UTF8
}

# 1) GameTypes.ts: add support/bonus fields
Replace-Regex -Path "src/game/GameTypes.ts" `
    -Pattern "sp\?: number;\r?\n\s*isTapped\?: boolean;" `
    -Replacement "sp?: number;`r`n  support?: number;`r`n  bonus?: number;`r`n  isTapped?: boolean;"

# 2) GameEngine.ts: add battle helper functions after makeBattleCause
$enginePath = "src/game/GameEngine.ts"
$engine = Get-Content -Raw -Path $enginePath
$needle = @"
function makeBattleCause(playerId: PlayerID, sourceCardId?: string): CauseDescriptor {
  return {
    controller: playerId,
    controllerPlayerId: playerId,
    relationToAffectedPlayer: 'self',
    causeKind: 'battle',
    category: 'battle',
    sourceOwnerKind: 'battle',
    sourceKind: 'battle',
    sourceType: 'battle',
    isEffect: false,
    isAbility: false,
    sourceCardId,
  };
}
"@
$insert = @"
function makeBattleCause(playerId: PlayerID, sourceCardId?: string): CauseDescriptor {
  return {
    controller: playerId,
    controllerPlayerId: playerId,
    relationToAffectedPlayer: 'self',
    causeKind: 'battle',
    category: 'battle',
    sourceOwnerKind: 'battle',
    sourceKind: 'battle',
    sourceType: 'battle',
    isEffect: false,
    isAbility: false,
    sourceCardId,
  };
}

function getBattleAttackValue(card: CardRef): number {
  return (card.ap ?? card.power ?? 0) + (card.support ?? 0) + (card.bonus ?? 0);
}

function getBattleDefenseValue(card: CardRef): number {
  return (card.dp ?? card.hp ?? 0) + (card.bonus ?? 0);
}
"@
if (-not $engine.Contains($needle)) {
    throw "Needle not found in $enginePath"
}
$engine = $engine.Replace($needle, $insert)

# 3) GameEngine.ts: replace defender battle calculation block
$pattern = @"
if \(defenderCardId\) \{
    const found = findCardOwnerOnField\(state, defenderCardId\);
    if \(found && found.playerId === defenderPlayerId\) \{
      if \(\(attackerInfo.card.ap \?\? attackerInfo.card.power \?\? 0\) > \(found.card.dp \?\? found.card.hp \?\? 0\)\) \{
        destroyCardToDiscard\(
          state,
          defenderPlayerId,
          found.card,
          makeBattleCause\(attackerPlayerId, attackerInfo.card.instanceId\),
          \{ isDown: true, destroyReason: 'battle' \},
        \);
      \}
      if \(\(found.card.ap \?\? found.card.power \?\? 0\) > \(attackerInfo.card.dp \?\? attackerInfo.card.hp \?\? 0\)\) \{
        destroyCardToDiscard\(
          state,
          attackerPlayerId,
          attackerInfo.card,
          makeBattleCause\(defenderPlayerId, found.card.instanceId\),
          \{ isDown: true, destroyReason: 'battle' \},
        \);
      \}
      appendLog\(state, '배틀 종료 \(down = battle destroy\)'\);
      clearBattleState\(state\);
      flushNormalizationAndTriggers\(state, eventStartIndex\);
      return;
    \}
  \}
"@
$replacement = @"
if (defenderCardId) {
    const found = findCardOwnerOnField(state, defenderCardId);
    if (found && found.playerId === defenderPlayerId) {
      const attackerAttack = getBattleAttackValue(attackerInfo.card);
      const attackerDefense = getBattleDefenseValue(attackerInfo.card);
      const defenderAttack = getBattleAttackValue(found.card);
      const defenderDefense = getBattleDefenseValue(found.card);

      if (attackerAttack > defenderDefense) {
        destroyCardToDiscard(
          state,
          defenderPlayerId,
          found.card,
          makeBattleCause(attackerPlayerId, attackerInfo.card.instanceId),
          { isDown: true, destroyReason: 'battle' },
        );
      }
      if (defenderAttack > attackerDefense) {
        destroyCardToDiscard(
          state,
          attackerPlayerId,
          attackerInfo.card,
          makeBattleCause(defenderPlayerId, found.card.instanceId),
          { isDown: true, destroyReason: 'battle' },
        );
      }
      appendLog(
        state,
        `[BATTLE] attacker ${attackerAttack} vs defender ${defenderDefense} | defender ${defenderAttack} vs attacker ${attackerDefense}`,
      );
      appendLog(state, '배틀 종료 (down = battle destroy)');
      clearBattleState(state);
      flushNormalizationAndTriggers(state, eventStartIndex);
      return;
    }
  }
"@
$updated = [regex]::Replace($engine, $pattern, [System.Text.RegularExpressions.MatchEvaluator]{ param($m) $replacement }, [System.Text.RegularExpressions.RegexOptions]::Singleline)
if ($updated -eq $engine) {
    throw "Battle block pattern not found in $enginePath"
}
Set-Content -Path $enginePath -Value $updated -Encoding UTF8

# 4) Add new tests
$testPath = "src/game/__tests__/BattleCalculationExtended.test.ts"
$testContent = @'
import { describe, expect, it } from "vitest";
import { reduceGameState } from "../GameEngine";
import { createInitialGameState } from "../GameRules";
import type { CardRef, FieldSlot, GameState, PlayerID } from "../GameTypes";

function makeCharacter(
  instanceId: string,
  owner: PlayerID,
  slotStats?: { ap?: number; dp?: number; dmg?: number; support?: number; bonus?: number },
): CardRef {
  const ap = slotStats?.ap ?? 3;
  const dp = slotStats?.dp ?? 3;
  const dmg = slotStats?.dmg ?? 1;
  return {
    instanceId,
    cardNo: instanceId,
    name: instanceId,
    owner,
    cardType: "character",
    sameNameKey: instanceId,
    ap,
    dp,
    dmg,
    power: ap,
    damage: dmg,
    hp: dp,
    support: slotStats?.support ?? 0,
    bonus: slotStats?.bonus ?? 0,
    isTapped: false,
    canAttack: true,
    canBlock: true,
    revealed: false,
    location: "deck",
  };
}

function makeDeck(owner: PlayerID, prefix: string, overrides?: Partial<Record<number, CardRef>>): CardRef[] {
  const deck: CardRef[] = [];
  while (deck.length < 60) {
    const i = deck.length + 1;
    const override = overrides?.[i];
    if (override) {
      deck.push({
        ...override,
        owner,
        location: "deck",
        isTapped: false,
        revealed: false,
      });
    } else {
      deck.push(makeCharacter(`${prefix}_${String(i).padStart(3, "0")}`, owner));
    }
  }
  return deck;
}

function buildReadyToMainState(firstPlayer: PlayerID, p1Deck: CardRef[], p2Deck: CardRef[]): GameState {
  const state0 = createInitialGameState({ p1Deck, p2Deck, leaderEnabled: false });
  const state1 = reduceGameState(state0, { type: "START_GAME", firstPlayer, leaderEnabled: false });
  const state2 = reduceGameState(state1, { type: "KEEP_STARTING_HAND", playerId: "P1" });
  const state3 = reduceGameState(state2, { type: "KEEP_STARTING_HAND", playerId: "P2" });
  const state4 = reduceGameState(state3, { type: "FINALIZE_STARTUP" });
  const state5 = reduceGameState(state4, { type: "START_TURN" });
  return reduceGameState(state5, { type: "ADVANCE_PHASE" });
}

function getFirstHandCharacterId(state: GameState, playerId: PlayerID): string {
  const card = state.players[playerId].hand.find((c) => c.cardType === "character");
  if (!card) throw new Error(`${playerId} hand has no character`);
  return card.instanceId;
}

function declareCharacterFromHand(state: GameState, playerId: PlayerID, sourceCardId: string, slot: FieldSlot): GameState {
  return reduceGameState(state, {
    type: "DECLARE_ACTION",
    playerId,
    kind: "useCharacter",
    sourceCardId,
    targetSlots: [slot],
    targetingMode: "declareTime",
  });
}

function resolveLatestDeclarationByDoublePass(state: GameState): GameState {
  const state1 = reduceGameState(state, { type: "PASS_PRIORITY", playerId: state.turn.priorityPlayer });
  return reduceGameState(state1, { type: "PASS_PRIORITY", playerId: state1.turn.priorityPlayer });
}

function putCharacterOnField(state: GameState, playerId: PlayerID, slot: FieldSlot): { state: GameState; cardId: string } {
  const cardId = getFirstHandCharacterId(state, playerId);
  const declared = declareCharacterFromHand(state, playerId, cardId, slot);
  const resolved = resolveLatestDeclarationByDoublePass(declared);
  return { state: resolved, cardId };
}

function passCurrentMainPhaseToNextTurn(state: GameState): GameState {
  const state1 = reduceGameState(state, { type: "ADVANCE_PHASE" });
  const state2 = reduceGameState(state1, { type: "ADVANCE_PHASE" });
  return reduceGameState(state2, { type: "ADVANCE_PHASE" });
}

function declareAttack(state: GameState, attackerPlayerId: PlayerID, attackerCardId: string): GameState {
  return reduceGameState(state, {
    type: "DECLARE_ACTION",
    playerId: attackerPlayerId,
    kind: "attack",
    sourceCardId: attackerCardId,
  });
}

function passAttackResponses(state: GameState): GameState {
  const s1 = reduceGameState(state, { type: "PASS_PRIORITY", playerId: state.battle.priorityPlayer ?? "P2" });
  return reduceGameState(s1, { type: "PASS_PRIORITY", playerId: s1.battle.priorityPlayer ?? "P1" });
}

function resolveBattleByDoublePass(state: GameState): GameState {
  const s1 = reduceGameState(state, { type: "PASS_PRIORITY", playerId: state.battle.priorityPlayer ?? "P1" });
  return reduceGameState(s1, { type: "PASS_PRIORITY", playerId: s1.battle.priorityPlayer ?? "P2" });
}

describe("BattleCalculationExtended", () => {
  it("support increases attacker battle AP", () => {
    const p1Deck = makeDeck("P1", "P1", {
      1: makeCharacter("P1_ATK_SUPPORT", "P1", { ap: 2, dp: 3, dmg: 1, support: 2 }),
    });
    const p2Deck = makeDeck("P2", "P2", {
      1: makeCharacter("P2_DEF_BASIC", "P2", { ap: 1, dp: 3, dmg: 1 }),
    });

    const ready = buildReadyToMainState("P1", p1Deck, p2Deck);
    const attackerEntered = putCharacterOnField(ready, "P1", "AF_LEFT");
    const p2Main = passCurrentMainPhaseToNextTurn(attackerEntered.state);
    const defenderEntered = putCharacterOnField(p2Main, "P2", "DF_LEFT");
    const backToP1Main = passCurrentMainPhaseToNextTurn(defenderEntered.state);

    const declared = declareAttack(backToP1Main, "P1", attackerEntered.cardId);
    const inBattle = passAttackResponses(declared);
    const withDefender = reduceGameState(inBattle, {
      type: "SET_DEFENDER",
      playerId: "P2",
      defenderCardId: defenderEntered.cardId,
    });
    const next = resolveBattleByDoublePass(withDefender);

    expect(next.players.P2.field.DF_LEFT.card).toBeNull();
    expect(next.logs.some((log) => log.includes("[BATTLE] attacker 4 vs defender 3"))).toBe(true);
  });

  it("bonus increases defender DP and can prevent down", () => {
    const p1Deck = makeDeck("P1", "P1", {
      1: makeCharacter("P1_ATK_BASIC", "P1", { ap: 3, dp: 3, dmg: 1 }),
    });
    const p2Deck = makeDeck("P2", "P2", {
      1: makeCharacter("P2_DEF_BONUS", "P2", { ap: 1, dp: 3, dmg: 1, bonus: 1 }),
    });

    const ready = buildReadyToMainState("P1", p1Deck, p2Deck);
    const attackerEntered = putCharacterOnField(ready, "P1", "AF_LEFT");
    const p2Main = passCurrentMainPhaseToNextTurn(attackerEntered.state);
    const defenderEntered = putCharacterOnField(p2Main, "P2", "DF_LEFT");
    const backToP1Main = passCurrentMainPhaseToNextTurn(defenderEntered.state);

    const declared = declareAttack(backToP1Main, "P1", attackerEntered.cardId);
    const inBattle = passAttackResponses(declared);
    const withDefender = reduceGameState(inBattle, {
      type: "SET_DEFENDER",
      playerId: "P2",
      defenderCardId: defenderEntered.cardId,
    });
    const next = resolveBattleByDoublePass(withDefender);

    expect(next.players.P2.field.DF_LEFT.card?.instanceId).toBe(defenderEntered.cardId);
    expect(next.logs.some((log) => log.includes("[BATTLE] attacker 3 vs defender 4"))).toBe(true);
  });

  it("bonus also increases counterattack AP", () => {
    const p1Deck = makeDeck("P1", "P1", {
      1: makeCharacter("P1_ATK_WEAK", "P1", { ap: 3, dp: 3, dmg: 1 }),
    });
    const p2Deck = makeDeck("P2", "P2", {
      1: makeCharacter("P2_DEF_COUNTER", "P2", { ap: 2, dp: 5, dmg: 1, bonus: 2 }),
    });

    const ready = buildReadyToMainState("P1", p1Deck, p2Deck);
    const attackerEntered = putCharacterOnField(ready, "P1", "AF_LEFT");
    const p2Main = passCurrentMainPhaseToNextTurn(attackerEntered.state);
    const defenderEntered = putCharacterOnField(p2Main, "P2", "DF_LEFT");
    const backToP1Main = passCurrentMainPhaseToNextTurn(defenderEntered.state);

    const declared = declareAttack(backToP1Main, "P1", attackerEntered.cardId);
    const inBattle = passAttackResponses(declared);
    const withDefender = reduceGameState(inBattle, {
      type: "SET_DEFENDER",
      playerId: "P2",
      defenderCardId: defenderEntered.cardId,
    });
    const next = resolveBattleByDoublePass(withDefender);

    expect(next.players.P1.field.AF_LEFT.card).toBeNull();
    expect(next.logs.some((log) => log.includes("defender 4 vs attacker 3"))).toBe(true);
  });
});
'@
Set-Content -Path $testPath -Value $testContent -Encoding UTF8

Write-Host "Battle calculation patch applied."
