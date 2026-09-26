// SDR 3.5 — scripts/roll-engine.mjs
// Client rolls. Every check is `1d20 + modifier` through the shared dialog
// (used here for its situational bonus and roll-mode pick — this game has no
// advantage mechanic, so the die is always 1d20) plus dispatchRoll, which is
// fire-and-forget: presentation data travels in `meta`.

import { showRollDialog } from './roll-dialog.mjs';
import { fetchPreparedActor } from './prepare-data.mjs';
import { iterativeAttacks, multiplyDamage, sizeAcAttackMod } from './rules.mjs';

export async function srd35Roll({ label, modifier = 0, actor, dc = null, extraMeta = {} }) {
  const choice = await showRollDialog({
    title: label,
    parts: [{ label: 'Modifier', value: Number(modifier) || 0 }],
  });
  if (!choice) return null;
  const total = (Number(modifier) || 0) + (Number(choice.situational) || 0);
  const formula = total !== 0 ? `1d20 + ${total}` : '1d20';
  const meta = { label, system: 'srd35', ...extraMeta };
  if (dc !== null && dc !== undefined) meta.dc = dc;
  if (choice.situational) meta.situational = choice.situational;
  window.Loom.dispatchRoll({
    formula,
    actorId: actor?.id,
    mode: choice.rollMode || 'public',
    meta,
  });
  return true;
}

async function prepared(actor) {
  if (actor?.systemData) return actor;
  if (actor?.id) return (await fetchPreparedActor(actor.id)) ?? actor;
  return actor;
}

function sdOf(actor) {
  return actor?.systemData ?? {};
}

export async function rollCheck(actor, { label = 'Check', modifier = 0, dc = null } = {}) {
  return srd35Roll({ label, modifier, actor, dc, extraMeta: { rollType: 'check' } });
}

export async function rollAbility(actor, key) {
  const row = await prepared(actor);
  const mod = Number(sdOf(row).abilities?.[key]?.mod) || 0;
  return srd35Roll({ label: key, modifier: mod, actor: row, extraMeta: { rollType: 'ability', ability: key } });
}

export async function rollSkill(actor, key) {
  const row = await prepared(actor);
  const mod = Number(sdOf(row).skills?.[key]?.total) || 0;
  return srd35Roll({ label: key, modifier: mod, actor: row, extraMeta: { rollType: 'skill', skill: key } });
}

export async function rollSave(actor, key) {
  const row = await prepared(actor);
  const mod = Number(sdOf(row).saves?.[key]?.total) || 0;
  return srd35Roll({ label: key, modifier: mod, actor: row, extraMeta: { rollType: 'save', save: key } });
}

export async function rollInitiative(actor) {
  const row = await prepared(actor);
  const mod = Number(sdOf(row).initiative?.total) || 0;
  return srd35Roll({ label: 'Initiative', modifier: mod, actor: row, extraMeta: { rollType: 'initiative' } });
}

function weaponData(item) {
  return item?.systemData ?? item?.data ?? {};
}

function attackBonusAt(row, item, attackIndex = 0) {
  const sd = sdOf(row);
  const iteratives = iterativeAttacks(Number(sd.bab) || 0);
  const babStep = iteratives[Math.min(Math.max(0, attackIndex), iteratives.length - 1)] ?? 0;
  const d = weaponData(item);
  const isRanged = String(d.category || '').toLowerCase() === 'ranged';
  const ab = isRanged ? Number(sd.abilities?.dex?.mod) || 0 : Number(sd.abilities?.str?.mod) || 0;
  const sizeMod = sizeAcAttackMod(sd.size || 'medium');
  return babStep + ab + sizeMod;
}

export async function rollAttack(actor, item, attackIndex = 0) {
  const row = await prepared(actor);
  const d = weaponData(item);
  const modifier = attackBonusAt(row, item, attackIndex);
  return srd35Roll({
    label: d.name || item?.name || 'Attack',
    modifier,
    actor: row,
    extraMeta: {
      rollType: 'attack', itemId: item?.id, attackIndex,
      critRange: Number(d.critRange) || 20,
      critMultiplier: Number(d.critMultiplier) || 2,
    },
  });
}

export async function rollConfirmCrit(actor, item, attackIndex = 0) {
  const row = await prepared(actor);
  const d = weaponData(item);
  const modifier = attackBonusAt(row, item, attackIndex);
  return srd35Roll({
    label: 'Confirm Critical',
    modifier,
    actor: row,
    extraMeta: { rollType: 'confirmCrit', itemId: item?.id, attackIndex },
  });
}

export async function rollDamage(actor, item, { critical = false, bonus = null } = {}) {
  const row = await prepared(actor);
  const sd = sdOf(row);
  const d = weaponData(item);
  const base = String(d.damage || '1d6');
  const isRanged = String(d.category || '').toLowerCase() === 'ranged';
  const ab = bonus !== null && bonus !== undefined
    ? Number(bonus) || 0
    : (isRanged ? 0 : Number(sd.abilities?.str?.mod) || 0);
  const withBonus = ab !== 0 ? `${base}${ab >= 0 ? '+' : ''}${ab}` : base;
  const formula = critical ? multiplyDamage(withBonus, Number(d.critMultiplier) || 2) : withBonus;
  window.Loom.dispatchRoll({
    formula,
    actorId: row?.id,
    mode: 'public',
    meta: {
      label: 'Damage', system: 'srd35', rollType: 'damage',
      itemId: item?.id, critical: !!critical,
    },
  });
  return true;
}

export async function rollGrapple(actor) {
  const row = await prepared(actor);
  const mod = Number(sdOf(row).offense?.grapple) || 0;
  return srd35Roll({ label: 'Grapple', modifier: mod, actor: row, extraMeta: { rollType: 'grapple' } });
}
