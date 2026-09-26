// SDR 3.5 — scripts/character-sheet.mjs
// Ledger-style character sheet ("livro-razao do aventureiro").
// Lifecycle/save/drop shape mirrors the engine's reference actor sheet;
// layout, classes and text are original to this ruleset.

import { LoomHandlebarsMixin, LoomActorSheet, api, windowManager } from '/_loom/sdk/index.js';
import {
  ABILITY_KEYS,
  SKILL_ABILITIES,
  SAVE_KEYS,
  SIZE_KEYS,
  SUBTITLED_SKILLS,
  ITEM_TYPE_ICON,
} from './config.mjs';
import { fmtMod, itemsArray, setPathValue, readDropPayload } from './utils.mjs';
import { getDefaultData } from './schema.mjs';
import { prepareActorRow } from './prepare-data.mjs';
import { iterativeAttacks, maxRanks, sizeAcAttackMod, xpProgress } from './rules.mjs';
import {
  rollAbility,
  rollSkill,
  rollSave,
  rollInitiative,
  rollAttack,
  rollConfirmCrit,
  rollDamage,
  rollGrapple,
} from './roll-engine.mjs';
import { Srd35ItemSheet } from './item-sheet.mjs';

function itemData(item) {
  return item?.systemData ?? item?.data ?? {};
}

function cloneRow(row) {
  return JSON.parse(JSON.stringify(row));
}

export class Srd35CharacterSheet extends LoomHandlebarsMixin(LoomActorSheet) {
  static DEFAULT_OPTIONS = { position: { width: 900, height: 860 } };

  _activeTab = 'overview';
  _adjusting = false;
  _formSaveTimer;
  _pendingFields = new Map();
  _restoreFocusName = null;
  _hasDropListener = false;

  constructor(props) {
    super({
      ...props,
      id: props.id || `actor-sheet-${props.actorId}`,
      documentId: props.actorId,
      title: props.title && props.title !== 'undefined' ? props.title : 'SDR 3.5',
      showFooter: false,
      resizable: true,
      allowOverflow: true,
      classes: ['srd35-sheet', 'srd35-character-sheet', 'srd35-ledger-ui'],
    });
  }

  static PARTS = { main: { template: '/marketplace/rulesets/srd35/templates/character-sheet.hbs' } };

  get title() {
    const n = this.document?.name;
    return n && n !== 'undefined' ? n : 'SDR 3.5';
  }

  get documentName() { return 'actor'; }
  get apiRoute() { return '/actors'; }
  get dataKey() { return 'systemData'; }

  async mount() {
    await super.mount();
    this._applyActiveTab();
    this._attachDropListener();
  }

  _postRender() {
    if (typeof super._postRender === 'function') super._postRender();
    this._applyActiveTab();
    this._restoreFocus();
  }

  _applyActiveTab() {
    const root = this.element;
    if (!root) return;
    const tab = this._activeTab || 'overview';
    root.querySelectorAll('.srd35-tab-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    root.querySelectorAll('[data-tab-content]').forEach((panel) => {
      panel.style.display = panel.dataset.tabContent === tab ? '' : 'none';
    });
    root.querySelector('.srd35-ledger')?.classList.toggle('is-adjusting', this._adjusting);
  }

  _restoreFocus() {
    if (!this._restoreFocusName || !this.element) return;
    const name = this._restoreFocusName;
    this._restoreFocusName = null;
    const el = this.element.querySelector(`[name="${name}"]`);
    if (!el || typeof el.focus !== 'function') return;
    el.focus();
    try {
      const end = (el.value ?? '').length;
      if (typeof el.setSelectionRange === 'function' && el.type !== 'number') {
        el.setSelectionRange(end, end);
      }
    } catch { /* focus only */ }
  }

  _attachDropListener() {
    if (!this.element || this._hasDropListener) return;
    this._hasDropListener = true;
    this.element.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    });
    this.element.addEventListener('drop', (e) => void this._onDropItem(e));
  }

  async _onDropItem(event) {
    event.preventDefault();
    if (!this.document) return;
    const data = readDropPayload(event);
    if (!data) return;
    const itemId = data.id || data.itemId;
    if (!itemId && !data.data) return;
    try {
      let source = data.data;
      if (!source && itemId) source = await api.get(`/items/${itemId}`);
      if (!source) return;
      const itemType = source.type || 'item';
      await api.post('/items', {
        worldId: window.Loom?.world?.id || this.document.worldId,
        name: source.name,
        type: itemType,
        imgUrl: source.imgUrl || source.img || '',
        data: source.system || source.data || getDefaultData(itemType),
        actorId: this.document.id,
      });
      await this._reloadDocument();
    } catch (err) {
      console.error('Failed to drop item:', err);
    }
  }

  _onChangeForm(event) {
    const target = event.target;
    if (!target || !target.name) return;
    if (target.name !== 'name' && !target.name.startsWith('sd:')) return;
    let value;
    if (target.type === 'checkbox') value = target.checked;
    else if (target.type === 'number') value = target.value === '' ? '' : Number(target.value);
    else value = target.value;
    // Empty maxDex means uncapped (null), not zero.
    if (target.name.endsWith('maxDex') && value === '') value = null;
    this._pendingFields.set(target.name, value);
    clearTimeout(this._formSaveTimer);
    this._formSaveTimer = setTimeout(() => void this._flushPendingFields(), 300);
  }

  async _flushPendingFields() {
    if (!this.document || this._pendingFields.size === 0) return;
    const pending = this._pendingFields;
    this._pendingFields = new Map();
    const sd = this.document.systemData || {};
    let name;
    for (const [key, value] of pending) {
      if (key === 'name') name = value;
      else setPathValue(sd, key.slice(3), value === '' ? 0 : value);
    }
    const submitData = { systemData: sd };
    if (name !== undefined) submitData.name = name;
    await api.put(`${this.apiRoute}/${this.document.id}`, submitData);
    await this._reloadDocument();
  }

  async _reloadDocument() {
    const active = this.element?.ownerDocument?.activeElement;
    this._restoreFocusName = active?.name && (active.name === 'name' || active.name.startsWith('sd:'))
      ? active.name
      : null;
    if (typeof super._reloadDocument === 'function') await super._reloadDocument();
  }

  async _prepareContext() {
    const context = await super._prepareContext();
    const base = this.document?.systemData || {};
    const prepared = prepareActorRow(cloneRow({
      type: this.document?.type || 'character',
      systemData: cloneRow(base),
      items: itemsArray(this.document?.items),
    })).systemData || {};
    const items = itemsArray(this.document?.items);

    const abilities = ABILITY_KEYS.map((key) => ({
      key,
      value: base.abilities?.[key]?.value ?? 10,
      mod: prepared.abilities?.[key]?.mod ?? 0,
      modFmt: fmtMod(prepared.abilities?.[key]?.mod ?? 0),
    }));

    const ac = prepared.ac || {};
    // Ledger breakdown of the AC total, same terms as rules.calcAc (display only).
    const num = (v) => Number(v) || 0;
    const dexMod = num(prepared.abilities?.dex?.mod);
    const maxDexRaw = base.ac?.maxDex;
    const cappedDex = maxDexRaw === '' || maxDexRaw === null || maxDexRaw === undefined
      ? dexMod : Math.min(dexMod, num(maxDexRaw));
    const acParts = [
      ['base', 10], ['armor', num(base.ac?.armor)], ['shield', num(base.ac?.shield)],
      ['dexShort', cappedDex], ['size', sizeAcAttackMod(base.size || 'medium')],
      ['natural', num(base.ac?.natural)], ['deflection', num(base.ac?.deflection)],
      ['dodge', num(base.ac?.dodge)], ['misc', num(base.ac?.misc)],
    ].filter(([key, value]) => key === 'base' || value !== 0)
      .map(([key, value], i) => ({ key, value: i === 0 ? String(value) : fmtMod(value) }));
    const acTitle = `10 + ${base.ac?.armor || 0} armor + ${base.ac?.shield || 0} shield`
      + ` + ${prepared.abilities?.dex?.mod ?? 0} Dex + ${base.ac?.natural || 0} natural`
      + ` + ${base.ac?.deflection || 0} deflection + ${base.ac?.dodge || 0} dodge`
      + ` + ${base.ac?.misc || 0} misc`;
    const touchTitle = `10 + ${prepared.abilities?.dex?.mod ?? 0} Dex`
      + ` + ${base.ac?.deflection || 0} deflection + ${base.ac?.dodge || 0} dodge + ${base.ac?.misc || 0} misc`;
    const ffTitle = `10 + ${base.ac?.armor || 0} armor + ${base.ac?.shield || 0} shield`
      + ` + ${base.ac?.natural || 0} natural + ${base.ac?.deflection || 0} deflection + ${base.ac?.misc || 0} misc`;

    const saves = SAVE_KEYS.map((key) => {
      const entry = base.saves?.[key] || {};
      return {
        key,
        base: entry.base ?? 0,
        total: prepared.saves?.[key]?.total ?? 0,
        totalFmt: fmtMod(prepared.saves?.[key]?.total ?? 0),
        title: `${entry.base || 0} base + ${fmtMod(prepared.abilities?.[key === 'fort' ? 'con' : key === 'ref' ? 'dex' : 'wis']?.mod ?? 0)} ability + ${entry.misc || 0} misc`,
      };
    });

    const bab = Number(prepared.bab) || 0;
    const iteratives = iterativeAttacks(bab).map((bonus, index) => ({
      index,
      bonus,
      bonusFmt: fmtMod(bonus),
    }));

    const classes = items.filter((i) => i?.type === 'class').map((i) => ({
      id: i.id,
      name: i.name,
      level: itemData(i).level ?? 1,
    }));

    const weapons = items.filter((i) => i?.type === 'weapon').map((i) => {
      const d = itemData(i);
      return {
        id: i.id,
        name: i.name,
        damage: d.damage || '1d6',
        critRange: Number(d.critRange) || 20,
        critMultiplier: Number(d.critMultiplier) || 2,
        critLabel: `${Number(d.critRange) || 20}-20/x${Number(d.critMultiplier) || 2}`,
        attacks: iteratives,
      };
    });

    const level = Number(prepared.level) || 0;
    let ranksUsed = 0;
    const skills = Object.keys(SKILL_ABILITIES).map((key) => {
      const entry = base.skills?.[key] || {};
      const ranks = Number(entry.ranks) || 0;
      ranksUsed += ranks;
      return {
        key,
        ability: (SKILL_ABILITIES[key] || '').toUpperCase(),
        ranks: entry.ranks ?? 0,
        classSkill: !!entry.classSkill,
        misc: entry.misc ?? 0,
        attrMod: fmtMod(prepared.abilities?.[SKILL_ABILITIES[key]]?.mod ?? 0),
        total: prepared.skills?.[key]?.total ?? 0,
        totalFmt: fmtMod(prepared.skills?.[key]?.total ?? 0),
        subtitled: SUBTITLED_SKILLS.includes(key),
        sub: entry.sub || '',
      };
    });

    const slots = (prepared.spells?.slots || []).map((slot, lv) => ({
      level: lv,
      value: base.spells?.slots?.[lv]?.value ?? 0,
      max: base.spells?.slots?.[lv]?.max ?? 0,
      maxTitle: `${base.spells?.slots?.[lv]?.max ?? 0} base + ${slot?.bonus ?? 0} bonus`,
    }));

    const castingClasses = items
      .filter((i) => i?.type === 'class' && itemData(i).spellcastingAbility)
      .map((i) => ({ id: i.id, name: i.name, ability: itemData(i).spellcastingAbility }));

    const spellsByLevel = Array.from({ length: 10 }, (_, lv) => ({
      level: lv,
      spells: items
        .filter((i) => i?.type === 'spell' && Number(itemData(i).level) === lv)
        .map((i) => ({ id: i.id, name: i.name })),
    })).filter((g) => g.spells.length > 0);

    const byType = (type) => items.filter((i) => i?.type === type).map((i) => ({
      id: i.id,
      name: i.name,
      icon: ITEM_TYPE_ICON[i.type] || '',
      quantity: itemData(i).quantity,
      weight: itemData(i).weight,
    }));
    const feats = byType('feat');
    const features = byType('class-feature');
    const gearGroups = ['armor', 'shield', 'equipment', 'consumable'].map((type) => ({
      type,
      items: byType(type),
    })).filter((g) => g.items.length > 0);
    let totalWeight = 0;
    for (const g of gearGroups) {
      for (const it of g.items) totalWeight += (Number(it.weight) || 0) * (Number(it.quantity) || 1);
    }

    const sizeOptions = SIZE_KEYS.map((value) => ({
      value,
      selected: (base.size || 'medium') === value,
    }));

    const raceItem = items.find((i) => i?.type === 'race');

    return {
      ...context,
      name: this.document?.name && this.document.name !== 'undefined' ? this.document.name : '',
      systemData: base,
      _raceName: raceItem ? raceItem.name : '',
      _level: level,
      _bab: fmtMod(bab),
      _babLabel: iterativeAttacks(bab).map((b) => fmtMod(b)).join('/'),
      _iteratives: iteratives,
      _abilities: abilities,
      _ac: ac.total ?? 10,
      _acParts: acParts,
      _xp: xpProgress(base.xp?.value, level),
      _acTitle: acTitle,
      _touch: ac.touch ?? 10,
      _touchTitle: touchTitle,
      _flatFooted: ac.flatFooted ?? 10,
      _ffTitle: ffTitle,
      _saves: saves,
      _initiative: fmtMod(prepared.initiative?.total ?? 0),
      _grapple: fmtMod(prepared.offense?.grapple ?? 0),
      _avatar: this.document?.avatarUrl || '',
      _adjusting: this._adjusting,
      _hp: {
        pct: Math.max(0, Math.min(100, Math.round(((Number(base.hp?.value) || 0) / Math.max(1, Number(prepared.hp?.maxTotal) || 0)) * 100))),
        value: base.hp?.value ?? 0,
        max: base.hp?.max ?? 0,
        temp: base.hp?.temp ?? 0,
        bonus: base.hp?.bonus ?? 0,
        maxTotal: prepared.hp?.maxTotal ?? 0,
      },
      _move: base.movement?.land ?? 9,
      _size: base.size || 'medium',
      _sizeOptions: sizeOptions,
      _classes: classes,
      _weapons: weapons,
      _skills: skills,
      _ranksUsed: ranksUsed,
      _maxClass: maxRanks(level, true),
      _maxCross: maxRanks(level, false),
      _castingClasses: castingClasses,
      _slots: slots,
      _spellsByLevel: spellsByLevel,
      _feats: feats,
      _features: features,
      _gearGroups: gearGroups,
      _totalWeight: totalWeight,
    };
  }

  onAction(action, id, target) {
    if (action === 'toggle-adjust') {
      this._adjusting = !this._adjusting;
      this._applyActiveTab();
      return;
    }
    if (action === 'tab') {
      const tab = target?.dataset?.tab;
      if (!tab) return;
      this._activeTab = tab;
      this._applyActiveTab();
      return;
    }
    if (!this.document) return;
    if (action === 'roll-ability') {
      const key = target?.dataset?.key;
      if (key) void rollAbility(this.document, key);
      return;
    }
    if (action === 'roll-save') {
      const key = target?.dataset?.key;
      if (key) void rollSave(this.document, key);
      return;
    }
    if (action === 'roll-skill') {
      const key = target?.dataset?.key;
      if (key) void rollSkill(this.document, key);
      return;
    }
    if (action === 'roll-initiative') {
      void rollInitiative(this.document);
      return;
    }
    if (action === 'roll-grapple') {
      void rollGrapple(this.document);
      return;
    }
    if (action === 'roll-attack') {
      const item = itemsArray(this.document?.items).find((i) => i.id === id);
      if (item) void rollAttack(this.document, item, Number(target?.dataset?.attackIndex) || 0);
      return;
    }
    if (action === 'roll-confirm') {
      const item = itemsArray(this.document?.items).find((i) => i.id === id);
      if (item) void rollConfirmCrit(this.document, item, Number(target?.dataset?.attackIndex) || 0);
      return;
    }
    if (action === 'roll-damage') {
      const item = itemsArray(this.document?.items).find((i) => i.id === id);
      if (item) void rollDamage(this.document, item, { critical: false });
      return;
    }
    if (action === 'roll-damage-crit') {
      const item = itemsArray(this.document?.items).find((i) => i.id === id);
      if (item) void rollDamage(this.document, item, { critical: true });
      return;
    }
    if (action === 'open-item') {
      void this._openItem(id);
      return;
    }
    if (action === 'delete-item') {
      void this._deleteItem(id);
      return;
    }
    if (action === 'create-item') {
      const type = target?.dataset?.itemType || 'equipment';
      void this._createItem(type);
      return;
    }
    if (action === 'focus-sub') {
      const key = target?.dataset?.key;
      const input = key ? this.element?.querySelector(`[name="sd:skills.${key}.sub"]`) : null;
      if (input && typeof input.focus === 'function') input.focus();
      return;
    }
    if (typeof super.onAction === 'function') super.onAction(action, id, target);
  }

  async _openItem(itemId) {
    if (!itemId) return;
    windowManager.open(`item-sheet-${itemId}`, Srd35ItemSheet, { itemId });
  }

  async _deleteItem(itemId) {
    if (!itemId) return;
    await api.delete(`/items/${itemId}`);
    await this._reloadDocument();
  }

  async _createItem(type = 'equipment') {
    if (!this.document) return;
    await api.post('/items', {
      worldId: window.Loom?.world?.id || this.document.worldId,
      name: `New ${type}`,
      type,
      data: getDefaultData(type),
      actorId: this.document.id,
    });
    await this._reloadDocument();
  }
}
