// SDR 3.5 — scripts/npc-sheet.mjs
// Compact single-column stat block for non-player characters.
// Same lifecycle/save/drop shape as the character sheet; no tabs.

import { LoomHandlebarsMixin, LoomActorSheet, api, windowManager } from '/_loom/sdk/index.js';
import { ABILITY_KEYS, SKILL_ABILITIES, SAVE_KEYS, SIZE_KEYS } from './config.mjs';
import { fmtMod, itemsArray, setPathValue, readDropPayload } from './utils.mjs';
import { getDefaultData } from './schema.mjs';
import { prepareActorRow } from './prepare-data.mjs';
import { iterativeAttacks, sizeAcAttackMod } from './rules.mjs';
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

export class Srd35NpcSheet extends LoomHandlebarsMixin(LoomActorSheet) {
  static DEFAULT_OPTIONS = { position: { width: 620, height: 700 } };

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
      classes: ['srd35-sheet', 'srd35-npc-sheet', 'srd35-ledger-ui'],
    });
  }

  static PARTS = { main: { template: '/marketplace/rulesets/srd35/templates/npc-sheet.hbs' } };

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
      type: this.document?.type || 'npc',
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
    const iteratives = iterativeAttacks(bab);

    const weapons = items.filter((i) => i?.type === 'weapon').map((i) => {
      const d = itemData(i);
      return {
        id: i.id,
        name: i.name,
        damage: d.damage || '1d6',
        critRange: Number(d.critRange) || 20,
        critMultiplier: Number(d.critMultiplier) || 2,
        critLabel: `${Number(d.critRange) || 20}-20/x${Number(d.critMultiplier) || 2}`,
        attacks: iteratives.map((bonus, index) => ({ index, bonusFmt: fmtMod(bonus) })),
      };
    });

    const skills = Object.keys(SKILL_ABILITIES)
      .map((key) => ({
        key,
        ability: (SKILL_ABILITIES[key] || '').toUpperCase(),
        ranks: base.skills?.[key]?.ranks ?? 0,
        total: prepared.skills?.[key]?.total ?? 0,
        totalFmt: fmtMod(prepared.skills?.[key]?.total ?? 0),
      }))
      .filter((s) => Number(s.ranks) > 0);

    const raceItem = items.find((i) => i?.type === 'race');
    const feats = items
      .filter((i) => i?.type === 'feat' || i?.type === 'class-feature')
      .map((i) => ({ id: i.id, name: i.name }));

    const sizeOptions = SIZE_KEYS.map((value) => ({
      value,
      selected: (base.size || 'medium') === value,
    }));

    return {
      ...context,
      name: this.document?.name && this.document.name !== 'undefined' ? this.document.name : '',
      systemData: base,
      _level: Number(prepared.level) || 0,
      _kind: raceItem ? raceItem.name : '',
      _abilities: abilities,
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
      _initiative: fmtMod(prepared.initiative?.total ?? 0),
      _ac: ac.total ?? 10,
      _acParts: acParts,
      _acTitle: acTitle,
      _touch: ac.touch ?? 10,
      _touchTitle: touchTitle,
      _flatFooted: ac.flatFooted ?? 10,
      _ffTitle: ffTitle,
      _babLabel: iteratives.map((b) => fmtMod(b)).join('/'),
      _grapple: fmtMod(prepared.offense?.grapple ?? 0),
      _saves: saves,
      _weapons: weapons,
      _skills: skills,
      _feats: feats,
      _move: base.movement?.land ?? 9,
      _size: base.size || 'medium',
      _sizeOptions: sizeOptions,
      _notes: base.details?.notes || '',
    };
  }

  onAction(action, id, target) {
    if (action === 'toggle-adjust') {
      this._adjusting = !this._adjusting;
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
