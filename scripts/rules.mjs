// SDR 3.5 — scripts/rules.mjs
// Pure rule functions. No SDK imports so this file runs in Node tests.

import {
  ARMOR_CHECK_SKILLS,
  DOUBLE_PENALTY_SKILLS,
  SIZE_AC_ATTACK_MOD,
  SIZE_GRAPPLE_MOD,
} from './config.mjs';

/** floor((score - 10) / 2) */
export function abilityMod(score) {
  return Math.floor(((Number(score) || 0) - 10) / 2);
}

/** Base attack for one class level: `good` = level, `average` = 3/4, `poor` = 1/2. */
export function babForTrack(track, level) {
  const lv = Math.max(0, Math.floor(Number(level) || 0));
  if (track === 'good') return lv;
  if (track === 'average') return Math.floor((lv * 3) / 4);
  if (track === 'poor') return Math.floor(lv / 2);
  return 0;
}

/** Base save for one class level: `good` = 2 + level/2, `poor` = level/3. */
export function saveBaseForTrack(track, level) {
  const lv = Math.max(0, Math.floor(Number(level) || 0));
  if (track === 'good') return 2 + Math.floor(lv / 2);
  if (track === 'poor') return Math.floor(lv / 3);
  return 0;
}

/**
 * Class list entries look like { level, bab, saves: { fort, ref, will } }.
 * Multiclass totals are the plain sum of each class on its own level.
 */
export function characterLevel(classes) {
  return (classes || []).reduce((sum, c) => sum + (Math.max(0, Math.floor(Number(c?.level) || 0))), 0);
}

export function totalBab(classes) {
  return (classes || []).reduce((sum, c) => sum + babForTrack(c?.bab, c?.level), 0);
}

export function totalSaveBase(classes, which) {
  return (classes || []).reduce((sum, c) => sum + saveBaseForTrack(c?.saves?.[which], c?.level), 0);
}

/** [bab, bab-5, bab-10, bab-15], keeping follow-ups only while >= 1. */
export function iterativeAttacks(bab) {
  const b = Math.floor(Number(bab) || 0);
  const out = [b];
  for (const next of [b - 5, b - 10, b - 15]) {
    if (next >= 1) out.push(next);
  }
  return out;
}

/** Class skill: level + 3; cross-class: half that. */
export function maxRanks(level, classSkill) {
  const lv = Math.max(0, Math.floor(Number(level) || 0));
  const full = lv + 3;
  return classSkill ? full : full / 2;
}

/** Skill check total. Ranks round down (half points allowed). */
export function skillTotal({ ranks = 0, abilityMod: ab = 0, misc = 0, armorPenalty = 0 } = {}) {
  return Math.floor(Number(ranks) || 0) + (Number(ab) || 0) + (Number(misc) || 0) + (Number(armorPenalty) || 0);
}

/** Check penalty applying to one skill: 0 unless the skill suffers from protection. */
export function armorPenaltyFor(skillKey, checkPenalty) {
  const p = Number(checkPenalty) || 0;
  if (!p) return 0;
  if (DOUBLE_PENALTY_SKILLS.includes(skillKey)) return p * 2;
  if (ARMOR_CHECK_SKILLS.includes(skillKey)) return p;
  return 0;
}

export function sizeAcAttackMod(size) {
  return SIZE_AC_ATTACK_MOD[size] ?? 0;
}

export function sizeGrappleMod(size) {
  return SIZE_GRAPPLE_MOD[size] ?? 0;
}

/**
 * Protection class breakdown.
 * maxDex `null`/undefined = uncapped. Touch drops worn/natural layers.
 * Surprised drops positive Dex and the dodge layer.
 */
export function calcAc({
  armor = 0, shield = 0, dexMod = 0, maxDex = null,
  size = 'medium', natural = 0, deflection = 0, dodge = 0, misc = 0,
} = {}) {
  const dex = Number(dexMod) || 0;
  const capped = maxDex === null || maxDex === undefined ? dex : Math.min(dex, Number(maxDex));
  const sizeMod = sizeAcAttackMod(size);
  const n = (v) => Number(v) || 0;
  const total = 10 + n(armor) + n(shield) + capped + sizeMod + n(natural) + n(deflection) + n(dodge) + n(misc);
  const touch = 10 + capped + sizeMod + n(deflection) + n(dodge) + n(misc);
  const flatFooted = 10 + n(armor) + n(shield) + Math.min(capped, 0) + sizeMod + n(natural) + n(deflection) + n(misc);
  return { total, touch, flatFooted };
}

export function saveTotal(base, ab, misc = 0) {
  return (Number(base) || 0) + (Number(ab) || 0) + (Number(misc) || 0);
}

export function initiativeTotal(dexMod, misc = 0) {
  return (Number(dexMod) || 0) + (Number(misc) || 0);
}

export function meleeAttack(bab, strMod, sizeMod = 0, misc = 0) {
  return (Number(bab) || 0) + (Number(strMod) || 0) + (Number(sizeMod) || 0) + (Number(misc) || 0);
}

export function rangedAttack(bab, dexMod, sizeMod = 0, misc = 0) {
  return (Number(bab) || 0) + (Number(dexMod) || 0) + (Number(sizeMod) || 0) + (Number(misc) || 0);
}

export function grappleTotal(bab, strMod, grappleSizeMod = 0, misc = 0) {
  return (Number(bab) || 0) + (Number(strMod) || 0) + (Number(grappleSizeMod) || 0) + (Number(misc) || 0);
}

/** Hit point ceiling: rolled base + Con × level + extra bonus. */
export function hpMaxTotal({ base = 0, conMod = 0, level = 0, bonus = 0 } = {}) {
  return (Number(base) || 0) + (Number(conMod) || 0) * (Number(level) || 0) + (Number(bonus) || 0);
}

/** Extra daily slots for one spell level from a high casting score. */
export function bonusSpells(ab, spellLevel) {
  const mod = Math.floor(Number(ab) || 0);
  const lv = Math.floor(Number(spellLevel) || 0);
  if (lv <= 0) return 0;
  if (mod < lv) return 0;
  return Math.floor((mod - lv) / 4) + 1;
}

/**
 * Multiply every die count and flat modifier in a damage formula.
 * '1d8+3' x2 -> '2d8+6'. Used for confirmed critical hits.
 */
export function multiplyDamage(formula, mult) {
  const m = Math.max(1, Math.floor(Number(mult) || 1));
  const clean = String(formula ?? '').replace(/\s+/g, '');
  if (!clean || m === 1) return clean;
  const dice = clean.replace(/(\d+)[dD](\d+)/g, (_, n, sides) => `${Number(n) * m}d${sides}`);
  return dice.replace(/(?<![\ddD])(\d+)(?![\ddD])/g, (g) => String(Number(g) * m));
}

// Experience: total XP needed to reach level L is L*(L-1)/2 * 1000 (SRD advancement table).
export function xpForLevel(level) {
  const l = Math.max(1, Math.floor(Number(level) || 1));
  return (l * (l - 1) / 2) * 1000;
}
export function xpProgress(xp, level) {
  const value = Math.max(0, Number(xp) || 0);
  const l = Math.max(1, Math.floor(Number(level) || 1));
  const floor = xpForLevel(l);
  const next = xpForLevel(l + 1);
  const pct = Math.max(0, Math.min(100, Math.round(((value - floor) / (next - floor)) * 100)));
  return { value, floor, next, pct, ready: value >= next };
}
