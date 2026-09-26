// SDR 3.5 — scripts/api.mjs
// Public surface bound to window.SRD35 by the entry point, for handoff 03 sheets.

import {
  srd35Roll,
  rollCheck,
  rollAbility,
  rollSkill,
  rollSave,
  rollInitiative,
  rollAttack,
  rollConfirmCrit,
  rollDamage,
  rollGrapple,
} from './roll-engine.mjs';

export const Srd35Api = {
  srd35Roll,
  rollCheck,
  rollAbility,
  rollSkill,
  rollSave,
  rollInitiative,
  rollAttack,
  rollConfirmCrit,
  rollDamage,
  rollGrapple,
};
