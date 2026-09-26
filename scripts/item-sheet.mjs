// SDR 3.5 — scripts/item-sheet.mjs
// Single item sheet for every item type: header plus the type's own
// fields in two columns, description at the bottom. Class items also
// show their computed progression row (base attack and base saves)
// as read-only text for cross-checking.

import { LoomHandlebarsMixin, LoomItemSheet, api } from '/_loom/sdk/index.js';
import { ITEM_TYPE_ICON } from './config.mjs';
import { setPathValue } from './utils.mjs';
import { babForTrack, saveBaseForTrack } from './rules.mjs';

const BAB_TRACKS = ['poor', 'average', 'good'];
const SAVE_TRACKS = ['poor', 'good'];
const WEAPON_CATEGORIES = ['', 'melee', 'ranged'];

function itemValues(doc) {
  return doc?.systemData ?? doc?.data ?? {};
}

function field(key, label, type, value, extra = {}) {
  return { key, label, type, value: value ?? '', ...extra };
}

function trackOptions(tracks, current) {
  return tracks.map((value) => ({ value, selected: value === current }));
}

function fieldsFor(type, v) {
  switch (type) {
    case 'race':
      return [
        field('size', 'sheet.size', 'text', v.size),
        field('speed', 'sheet.speed', 'number', v.speed),
        field('favoredClass', 'sheet.favoredClass', 'text', v.favoredClass),
      ];
    case 'class':
      return [
        field('level', 'sheet.level', 'number', v.level),
        field('hitDie', 'sheet.hitDie', 'text', v.hitDie),
        field('bab', 'sheet.babTrack', 'select', v.bab, { options: trackOptions(BAB_TRACKS, v.bab) }),
        field('saves.fort', 'sheet.saveFortTrack', 'select', v.saves?.fort, { options: trackOptions(SAVE_TRACKS, v.saves?.fort) }),
        field('saves.ref', 'sheet.saveRefTrack', 'select', v.saves?.ref, { options: trackOptions(SAVE_TRACKS, v.saves?.ref) }),
        field('saves.will', 'sheet.saveWillTrack', 'select', v.saves?.will, { options: trackOptions(SAVE_TRACKS, v.saves?.will) }),
        field('skillPoints', 'sheet.skillPoints', 'number', v.skillPoints),
        field('spellcastingAbility', 'sheet.spellcastingAbility', 'text', v.spellcastingAbility),
        field('classSkills', 'sheet.classSkills', 'csv', (v.classSkills || []).join(', ')),
      ];
    case 'feat':
      return [
        field('prerequisites', 'sheet.prerequisites', 'text', v.prerequisites),
        field('type', 'sheet.subtype', 'text', v.type),
      ];
    case 'class-feature':
      return [
        field('class', 'sheet.className', 'text', v.class),
        field('level', 'sheet.level', 'number', v.level),
      ];
    case 'spell':
      return [
        field('level', 'sheet.spellLevel', 'number', v.level),
        field('school', 'sheet.school', 'text', v.school),
        field('components', 'sheet.components', 'text', v.components),
        field('castingTime', 'sheet.castingTime', 'text', v.castingTime),
        field('range', 'sheet.range', 'text', v.range),
        field('duration', 'sheet.duration', 'text', v.duration),
        field('save', 'sheet.save', 'text', v.save),
        field('spellResistance', 'sheet.spellResistance', 'text', v.spellResistance),
      ];
    case 'weapon':
      return [
        field('damage', 'sheet.damage', 'text', v.damage),
        field('critRange', 'sheet.critRange', 'number', v.critRange),
        field('critMultiplier', 'sheet.critMultiplier', 'number', v.critMultiplier),
        field('damageType', 'sheet.damageType', 'text', v.damageType),
        field('rangeIncrement', 'sheet.rangeIncrement', 'number', v.rangeIncrement),
        field('category', 'sheet.category', 'select', v.category, { options: trackOptions(WEAPON_CATEGORIES, v.category) }),
      ];
    case 'armor':
      return [
        field('armorBonus', 'sheet.armorBonus', 'number', v.armorBonus),
        field('maxDex', 'sheet.maxDex', 'text', v.maxDex ?? ''),
        field('checkPenalty', 'sheet.checkPenalty', 'number', v.checkPenalty),
        field('spellFailure', 'sheet.spellFailure', 'number', v.spellFailure),
        field('category', 'sheet.category', 'text', v.category),
      ];
    case 'shield':
      return [
        field('shieldBonus', 'sheet.shieldBonus', 'number', v.shieldBonus),
        field('checkPenalty', 'sheet.checkPenalty', 'number', v.checkPenalty),
        field('spellFailure', 'sheet.spellFailure', 'number', v.spellFailure),
      ];
    case 'equipment':
    case 'consumable':
      return [
        field('quantity', 'sheet.quantity', 'number', v.quantity),
        field('weight', 'sheet.weight', 'number', v.weight),
        field('price', 'sheet.price', 'text', v.price),
      ];
    default:
      return [];
  }
}

export class Srd35ItemSheet extends LoomHandlebarsMixin(LoomItemSheet) {
  static DEFAULT_OPTIONS = { position: { width: 440, height: 520 } };

  _formSaveTimer;
  _pendingFields = new Map();
  _activeItemTab = 'details';

  constructor(props) {
    super({
      ...props,
      id: props.id || `item-sheet-${props.itemId}`,
      documentId: props.itemId,
      title: props.title && props.title !== 'undefined' ? props.title : 'Item',
      showFooter: false,
      resizable: true,
      classes: ['srd35-sheet', 'srd35-item-sheet', 'srd35-ledger-ui'],
    });
  }

  get dataKey() { return 'data'; }

  static PARTS = { main: { template: '/marketplace/rulesets/srd35/templates/item-sheet.hbs' } };

  async mount() {
    await super.mount();
    this._applyActiveItemTab();
  }

  _postRender() {
    if (typeof super._postRender === 'function') super._postRender();
    this._applyActiveItemTab();
  }

  _applyActiveItemTab() {
    const root = this.element;
    if (!root) return;
    const tab = this._activeItemTab || 'details';
    root.querySelectorAll('.srd35-tab-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    root.querySelectorAll('[data-tab-content]').forEach((panel) => {
      panel.style.display = panel.dataset.tabContent === tab ? '' : 'none';
    });
  }

  onAction(action, id, target) {
    if (action === 'tab') {
      const tab = target?.dataset?.tab;
      if (!tab) return;
      this._activeItemTab = tab;
      this._applyActiveItemTab();
      return;
    }
    if (action === 'pick-icon') {
      void this._pickIcon();
      return;
    }
    if (typeof super.onAction === 'function') super.onAction(action, id, target);
  }

  async _pickIcon() {
    if (!this.document) return;
    const FilePicker = window.Loom?.applications?.apps?.FilePicker?.implementation;
    if (!FilePicker) return;
    const path = await new FilePicker({ type: 'image', current: this.document.imgUrl || '' }).browse();
    if (!path) return;
    await api.put(`${this.apiRoute}/${this.document.id}`, { imgUrl: path });
    await this._reloadDocument();
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

  _csvFieldKeys() {
    const type = this.document?.type;
    if (type === 'class') return new Set(['classSkills']);
    return new Set();
  }

  async _flushPendingFields() {
    if (!this.document || this._pendingFields.size === 0) return;
    const pending = this._pendingFields;
    this._pendingFields = new Map();
    const data = this.document.data || {};
    const csvKeys = this._csvFieldKeys();
    let name;
    for (const [key, value] of pending) {
      if (key === 'name') { name = value; continue; }
      const path = key.slice(3);
      if (csvKeys.has(path)) {
        setPathValue(data, path, String(value).split(',').map((s) => s.trim()).filter(Boolean));
      } else if (value === '') {
        setPathValue(data, path, path.endsWith('maxDex') ? null : 0);
      } else {
        setPathValue(data, path, value);
      }
    }
    const submitData = { data };
    if (name !== undefined) submitData.name = name;
    await api.put(`${this.apiRoute}/${this.document.id}`, submitData);
    await this._reloadDocument();
  }

  async _prepareContext() {
    const context = await super._prepareContext();
    const type = this.document?.type || 'equipment';
    const values = itemValues(this.document);
    const rawFields = fieldsFor(type, values);
    const fields = rawFields.map((f) => ({
      ...f,
      isText: f.type === 'text',
      isNumber: f.type === 'number',
      isTextarea: f.type === 'textarea',
      isSelect: f.type === 'select',
      isCsv: f.type === 'csv',
    }));

    let progression = null;
    if (type === 'class') {
      const level = Math.max(0, Math.floor(Number(values.level) || 0));
      progression = {
        level,
        bab: babForTrack(values.bab, level),
        fort: saveBaseForTrack(values.saves?.fort, level),
        ref: saveBaseForTrack(values.saves?.ref, level),
        will: saveBaseForTrack(values.saves?.will, level),
      };
    }

    return {
      ...context,
      name: this.document?.name && this.document.name !== 'undefined' ? this.document.name : '',
      type,
      icon: ITEM_TYPE_ICON[type] || '',
      imgUrl: this.document?.imgUrl || '',
      description: values.description || '',
      fields,
      progression,
    };
  }
}
