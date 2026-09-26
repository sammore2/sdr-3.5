// SDR 3.5 — scripts/schema.mjs
// Default systemData for actor and item types (handoff 02 MVP).

import { ABILITY_KEYS, SKILL_KEYS } from './config.mjs';

function defaultAbilities() {
  const out = {};
  for (const key of ABILITY_KEYS) out[key] = { value: 10, mod: 0 };
  return out;
}

function defaultSaves() {
  return {
    fort: { base: 0, misc: 0, total: 0 },
    ref: { base: 0, misc: 0, total: 0 },
    will: { base: 0, misc: 0, total: 0 },
  };
}

function defaultSkills() {
  const out = {};
  for (const key of SKILL_KEYS) {
    out[key] = { ranks: 0, classSkill: false, misc: 0, sub: '', total: 0 };
  }
  return out;
}

function defaultSpellSlots() {
  return Array.from({ length: 10 }, () => ({ value: 0, max: 0, bonus: 0 }));
}

function defaultActor() {
  return {
    xp: { value: 0 },
    abilities: defaultAbilities(),
    hp: { value: 0, max: 0, bonus: 0, temp: 0, maxTotal: 0 },
    ac: {
      armor: 0, shield: 0, natural: 0, deflection: 0, dodge: 0, misc: 0,
      maxDex: null, checkPenalty: 0,
      total: 10, touch: 10, flatFooted: 10,
    },
    saves: defaultSaves(),
    initiative: { misc: 0, total: 0 },
    size: 'medium',
    movement: { land: 9 },
    level: 0,
    bab: 0,
    iterative: [0],
    combat: { babMisc: 0, meleeMisc: 0, rangedMisc: 0, grappleMisc: 0 },
    offense: { melee: 0, ranged: 0, grapple: 0 },
    skills: defaultSkills(),
    spells: { ability: '', slots: defaultSpellSlots() },
    details: { notes: '' },
  };
}

function withDescription(extra = {}) {
  return { description: '', ...extra };
}

export function getDefaultData(type) {
  switch (type) {
    case 'character':
    case 'npc':
      return defaultActor();
    case 'race':
      return withDescription({
        size: 'medium', speed: 9, abilityAdjustments: {}, favoredClass: '',
      });
    case 'class':
      return withDescription({
        level: 1, hitDie: 'd8', bab: 'average',
        saves: { fort: 'poor', ref: 'poor', will: 'poor' },
        skillPoints: 0, classSkills: [], spellcastingAbility: '',
      });
    case 'feat':
      return withDescription({ prerequisites: '', type: '' });
    case 'class-feature':
      return withDescription({ class: '', level: 1 });
    case 'spell':
      return withDescription({
        level: 0, school: '', components: '', castingTime: '',
        range: '', duration: '', save: '', spellResistance: '',
      });
    case 'weapon':
      return withDescription({
        damage: '1d6', critRange: 20, critMultiplier: 2,
        damageType: '', rangeIncrement: 0, category: '',
      });
    case 'armor':
      return withDescription({
        armorBonus: 0, maxDex: null, checkPenalty: 0, spellFailure: 0, category: '',
      });
    case 'shield':
      return withDescription({ shieldBonus: 0, checkPenalty: 0, spellFailure: 0 });
    case 'equipment':
    case 'consumable':
      return withDescription({ quantity: 1, weight: 0, price: '' });
    default:
      return {};
  }
}
