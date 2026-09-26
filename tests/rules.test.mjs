// SDR 3.5 — tests/rules.test.mjs
// node:test + node:assert coverage for every export of scripts/rules.mjs.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  abilityMod,
  armorPenaltyFor,
  babForTrack,
  bonusSpells,
  calcAc,
  characterLevel,
  grappleTotal,
  hpMaxTotal,
  initiativeTotal,
  iterativeAttacks,
  maxRanks,
  meleeAttack,
  multiplyDamage,
  rangedAttack,
  saveBaseForTrack,
  saveTotal,
  sizeAcAttackMod,
  sizeGrappleMod,
  skillTotal,
  totalBab,
  totalSaveBase,
} from '../scripts/rules.mjs';
import { itemsArray } from '../scripts/utils.mjs';

describe('abilityMod', () => {
  it('maps the handoff spot values', () => {
    assert.equal(abilityMod(1), -5);
    assert.equal(abilityMod(3), -4);
    assert.equal(abilityMod(9), -1);
    assert.equal(abilityMod(10), 0);
    assert.equal(abilityMod(11), 0);
    assert.equal(abilityMod(18), 4);
    assert.equal(abilityMod(25), 7);
  });
});

describe('babForTrack', () => {
  it('good = level', () => assert.equal(babForTrack('good', 7), 7));
  it('average = floor(3/4)', () => {
    assert.equal(babForTrack('average', 4), 3);
    assert.equal(babForTrack('average', 5), 3);
  });
  it('poor = floor(1/2)', () => {
    assert.equal(babForTrack('poor', 5), 2);
    assert.equal(babForTrack('poor', 1), 0);
  });
  it('unknown track = 0', () => assert.equal(babForTrack('epic', 10), 0));
});

describe('saveBaseForTrack', () => {
  it('good = 2 + level/2', () => {
    assert.equal(saveBaseForTrack('good', 1), 2);
    assert.equal(saveBaseForTrack('good', 6), 5);
  });
  it('poor = level/3', () => {
    assert.equal(saveBaseForTrack('poor', 1), 0);
    assert.equal(saveBaseForTrack('poor', 6), 2);
  });
});

describe('multiclass sums', () => {
  const classes = [
    { level: 4, bab: 'good', saves: { fort: 'good', ref: 'poor', will: 'poor' } },
    { level: 3, bab: 'average', saves: { fort: 'poor', ref: 'good', will: 'poor' } },
  ];
  it('characterLevel adds levels', () => assert.equal(characterLevel(classes), 7));
  it('totalBab adds each track on its own level', () => {
    assert.equal(totalBab(classes), 4 + 2);
  });
  it('totalSaveBase adds each save on its own level', () => {
    assert.equal(totalSaveBase(classes, 'fort'), 4 + 1);
    assert.equal(totalSaveBase(classes, 'ref'), 1 + 3);
  });
});

describe('iterativeAttacks', () => {
  it('bab 6 -> [6, 1]', () => assert.deepEqual(iterativeAttacks(6), [6, 1]));
  it('bab 16 -> [16, 11, 6, 1]', () => assert.deepEqual(iterativeAttacks(16), [16, 11, 6, 1]));
  it('bab 5 -> [5]', () => assert.deepEqual(iterativeAttacks(5), [5]));
  it('bab 1 -> [1]', () => assert.deepEqual(iterativeAttacks(1), [1]));
  it('bab 11 -> [11, 6, 1]', () => assert.deepEqual(iterativeAttacks(11), [11, 6, 1]));
});

describe('maxRanks', () => {
  it('class = level + 3', () => assert.equal(maxRanks(5, true), 8));
  it('cross-class = half', () => assert.equal(maxRanks(5, false), 4));
});

describe('skillTotal', () => {
  it('floors half ranks and adds parts', () => {
    assert.equal(skillTotal({ ranks: 4.5, abilityMod: 3, misc: 2, armorPenalty: -2 }), 7);
  });
});

describe('armorPenaltyFor', () => {
  it('applies to listed skills', () => assert.equal(armorPenaltyFor('climb', -3), -3));
  it('doubles for swim', () => assert.equal(armorPenaltyFor('swim', -3), -6));
  it('ignores other skills', () => assert.equal(armorPenaltyFor('spot', -3), 0));
});

describe('size modifiers', () => {
  it('attack/AC table', () => {
    assert.equal(sizeAcAttackMod('fine'), 8);
    assert.equal(sizeAcAttackMod('small'), 1);
    assert.equal(sizeAcAttackMod('medium'), 0);
    assert.equal(sizeAcAttackMod('colossal'), -8);
  });
  it('grapple table', () => {
    assert.equal(sizeGrappleMod('fine'), -16);
    assert.equal(sizeGrappleMod('medium'), 0);
    assert.equal(sizeGrappleMod('colossal'), 16);
  });
});

describe('calcAc', () => {
  it('full suit example', () => {
    const ac = calcAc({
      armor: 5, shield: 2, dexMod: 3, maxDex: null, size: 'medium',
      natural: 1, deflection: 1, dodge: 1, misc: 0,
    });
    assert.equal(ac.total, 23);
    assert.equal(ac.touch, 15);
    assert.equal(ac.flatFooted, 19);
  });
  it('caps Dex at the worn limit', () => {
    const ac = calcAc({ armor: 5, dexMod: 4, maxDex: 2, size: 'medium' });
    assert.equal(ac.total, 17);
  });
  it('small size adds +1', () => {
    const ac = calcAc({ dexMod: 2, size: 'small' });
    assert.equal(ac.total, 13);
  });
});

describe('saveTotal', () => {
  it('adds base, ability and misc', () => assert.equal(saveTotal(5, 3, 1), 9));
});

describe('initiativeTotal', () => {
  it('dex + misc', () => assert.equal(initiativeTotal(3, 2), 5));
});

describe('attacks', () => {
  it('melee = bab + str + size', () => assert.equal(meleeAttack(6, 3, 1, 0), 10));
  it('ranged = bab + dex + size', () => assert.equal(rangedAttack(6, 4, -1, 0), 9));
  it('grapple = bab + str + special size', () => assert.equal(grappleTotal(6, 3, 4, 0), 13));
});

describe('hpMaxTotal', () => {
  it('base + con x level + bonus', () => {
    assert.equal(hpMaxTotal({ base: 32, conMod: 2, level: 5, bonus: 3 }), 45);
  });
});

describe('bonusSpells', () => {
  it('cantrips never grant extra', () => assert.equal(bonusSpells(6, 0), 0));
  it('needs mod >= spell level', () => assert.equal(bonusSpells(2, 3), 0));
  it('table values', () => {
    assert.equal(bonusSpells(4, 1), 1);
    assert.equal(bonusSpells(6, 2), 2);
    assert.equal(bonusSpells(8, 1), 2);
  });
});

describe('multiplyDamage', () => {
  it('1d8+3 x2 -> 2d8+6', () => assert.equal(multiplyDamage('1d8+3', 2), '2d8+6'));
  it('plain die x3', () => assert.equal(multiplyDamage('2d6', 3), '6d6'));
  it('keeps negative flats negative', () => assert.equal(multiplyDamage('1d8-2', 2), '2d8-4'));
  it('x1 returns the formula untouched', () => assert.equal(multiplyDamage('1d8+3', 1), '1d8+3'));
});

describe('itemsArray', () => {
  it('passes arrays through untouched', () => {
    const arr = [{ id: 'a' }];
    assert.equal(itemsArray(arr), arr);
  });
  it('unwraps engine collection objects via contents', () => {
    const inner = [{ id: 'a', type: 'weapon' }];
    assert.equal(itemsArray({ contents: inner, size: 1 }), inner);
  });
  it('returns [] for undefined, null and bare objects', () => {
    assert.deepEqual(itemsArray(undefined), []);
    assert.deepEqual(itemsArray(null), []);
    assert.deepEqual(itemsArray({}), []);
  });
  it('survives JSON clone like the sheet cloneRow does', () => {
    const cloned = JSON.parse(JSON.stringify({ contents: [{ id: 'a', type: 'feat' }] }));
    assert.equal(itemsArray(cloned).filter((i) => i?.type === 'feat').length, 1);
  });
});

import { xpForLevel, xpProgress } from '../scripts/rules.mjs';
describe('xpForLevel', () => {
  it('follows the SRD advancement table', () => {
    assert.equal(xpForLevel(1), 0);
    assert.equal(xpForLevel(2), 1000);
    assert.equal(xpForLevel(3), 3000);
    assert.equal(xpForLevel(4), 6000);
    assert.equal(xpForLevel(20), 190000);
  });
});
describe('xpProgress', () => {
  it('measures progress inside the current level band', () => {
    assert.deepEqual(xpProgress(2000, 2), { value: 2000, floor: 1000, next: 3000, pct: 50, ready: false });
    assert.equal(xpProgress(3000, 2).ready, true);
    assert.equal(xpProgress(0, 1).pct, 0);
  });
});
