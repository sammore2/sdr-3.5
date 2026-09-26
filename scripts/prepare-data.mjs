// SDR 3.5 — scripts/prepare-data.mjs
// Derived-data pass: mergeDefaults with the schema default, then compute
// ability mods, level/BBA from embedded class items, defenses, skills and
// spell-slot bonuses via the pure helpers in rules.mjs.

import { mergeDefaults } from './utils.mjs';
import { getDefaultData } from './schema.mjs';
import { ABILITY_KEYS, SAVE_KEYS, SKILL_ABILITIES } from './config.mjs';
import {
  abilityMod,
  armorPenaltyFor,
  bonusSpells,
  calcAc,
  characterLevel,
  grappleTotal,
  hpMaxTotal,
  initiativeTotal,
  meleeAttack,
  rangedAttack,
  saveTotal,
  sizeAcAttackMod,
  sizeGrappleMod,
  skillTotal,
  totalBab,
  totalSaveBase,
} from './rules.mjs';

function itemData(item) {
  return item?.systemData ?? item?.data ?? {};
}

function classEntries(items) {
  return (items || [])
    .filter((i) => i?.type === 'class')
    .map((i) => {
      const d = itemData(i);
      return { level: d.level ?? 1, bab: d.bab ?? 'poor', saves: d.saves ?? {} };
    });
}

export function prepareActorRow(row) {
  const sd = row?.systemData;
  if (!sd) return row;
  mergeDefaults(sd, getDefaultData(row.type));
  if (row.type !== 'character' && row.type !== 'npc') return row;

  // Ability modifiers.
  const mods = {};
  for (const key of ABILITY_KEYS) {
    const entry = sd.abilities?.[key] ?? {};
    mods[key] = abilityMod(entry.value);
    entry.mod = mods[key];
  }

  // Level and base attack from embedded class items (multiclass = sum).
  const classes = classEntries(row.items);
  const level = characterLevel(classes);
  const bab = totalBab(classes) + (Number(sd.combat?.babMisc) || 0);
  sd.level = level;
  sd.bab = bab;

  // Hit points: rolled base + Con x level + bonus.
  if (sd.hp) {
    sd.hp.maxTotal = hpMaxTotal({
      base: sd.hp.max, conMod: mods.con ?? 0, level, bonus: sd.hp.bonus,
    });
  }

  // Protection class.
  const size = sd.size || 'medium';
  const sizeMod = sizeAcAttackMod(size);
  if (sd.ac) {
    const { total, touch, flatFooted } = calcAc({
      armor: sd.ac.armor, shield: sd.ac.shield, dexMod: mods.dex ?? 0,
      maxDex: sd.ac.maxDex, size, natural: sd.ac.natural,
      deflection: sd.ac.deflection, dodge: sd.ac.dodge, misc: sd.ac.misc,
    });
    sd.ac.total = total;
    sd.ac.touch = touch;
    sd.ac.flatFooted = flatFooted;
  }

  // Saves: class base + editable base + ability + misc.
  const saveAbility = { fort: mods.con ?? 0, ref: mods.dex ?? 0, will: mods.wis ?? 0 };
  for (const key of SAVE_KEYS) {
    const entry = sd.saves?.[key];
    if (!entry) continue;
    entry.total = saveTotal(
      totalSaveBase(classes, key) + (Number(entry.base) || 0),
      saveAbility[key],
      entry.misc,
    );
  }

  // Initiative and attacks.
  if (sd.initiative) {
    sd.initiative.total = initiativeTotal(mods.dex ?? 0, sd.initiative.misc);
  }
  const meleeMisc = Number(sd.combat?.meleeMisc) || 0;
  const rangedMisc = Number(sd.combat?.rangedMisc) || 0;
  const grappleMisc = Number(sd.combat?.grappleMisc) || 0;
  sd.offense = {
    melee: meleeAttack(bab, mods.str ?? 0, sizeMod, meleeMisc),
    ranged: rangedAttack(bab, mods.dex ?? 0, sizeMod, rangedMisc),
    grapple: grappleTotal(bab, mods.str ?? 0, sizeGrappleMod(size), grappleMisc),
  };

  // Skills.
  const checkPenalty = Number(sd.ac?.checkPenalty) || 0;
  for (const [key, ability] of Object.entries(SKILL_ABILITIES)) {
    const entry = sd.skills?.[key];
    if (!entry) continue;
    entry.total = skillTotal({
      ranks: entry.ranks,
      abilityMod: ability ? (mods[ability] ?? 0) : 0,
      misc: entry.misc,
      armorPenalty: armorPenaltyFor(key, checkPenalty),
    });
  }

  // Bonus spell slots from each casting class, summed per spell level.
  if (sd.spells?.slots) {
    const bonus = Array.from({ length: 10 }, () => 0);
    const casting = (row.items || [])
      .filter((i) => i?.type === 'class')
      .map((i) => itemData(i).spellcastingAbility)
      .filter((a) => a && mods[a] !== undefined);
    for (const ability of casting) {
      for (let lv = 1; lv < 10; lv++) bonus[lv] += bonusSpells(mods[ability], lv);
    }
    sd.spells.slots.forEach((slot, lv) => {
      if (slot) slot.bonus = bonus[lv] ?? 0;
    });
  }

  return row;
}

// Fetches an actor WITH its embedded items (the API only includes them with
// ?populate=true) and runs the derived-data pass on a clone.
export async function fetchPreparedActor(id) {
  const { api } = await import('/_loom/sdk/index.js');
  const raw = await api.get(`/actors/${id}?populate=true`);
  if (!raw) return null;
  const row = JSON.parse(JSON.stringify(raw));
  row.items = raw.items || [];
  return prepareActorRow(row);
}
