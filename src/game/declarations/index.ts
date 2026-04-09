import type { GameState, LegacyDeclaration } from "../GameTypes";
import { resolveAttack } from "./resolveAttack";
import { resolveChargeCharacter } from "./resolveChargeCharacter";
import { resolveUseAbility } from "./resolveUseAbility";
import { resolveUseCharacter } from "./resolveUseCharacter";

type LegacyDeclarationResolver = (state: GameState, declaration: LegacyDeclaration) => void;

const resolvers: Partial<Record<LegacyDeclaration["kind"], LegacyDeclarationResolver>> = {
  useCharacter: resolveUseCharacter,
  useAbility: resolveUseAbility,
  attack: resolveAttack,
  chargeCharacter: resolveChargeCharacter,
};

export function resolveLegacyDeclaration(state: GameState, declaration: LegacyDeclaration): void {
  const resolver = resolvers[declaration.kind];
  if (!resolver) return;
  resolver(state, declaration);
}
