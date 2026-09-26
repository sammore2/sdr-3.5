// SDR 3.5 — scripts/config.mjs
// Shared constants: ability keys, skill table, size modifiers, conditions,
// item-type maps. Pure data, no imports — every other module depends on this.

export const SYSTEM_ID = 'srd35';

export const ABILITY_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

export const ABILITY_LABELS = {
  str: 'Strength', dex: 'Dexterity', con: 'Constitution',
  int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma',
};

// Skill key -> ability key. `null` = no ability applies.
export const SKILL_ABILITIES = {
  appraise: 'int', balance: 'dex', bluff: 'cha', climb: 'str', concentration: 'con',
  craft: 'int', decipherScript: 'int', diplomacy: 'cha', disableDevice: 'int',
  disguise: 'cha', escapeArtist: 'dex', forgery: 'int', gatherInformation: 'cha',
  handleAnimal: 'cha', heal: 'wis', hide: 'dex', intimidate: 'cha', jump: 'str',
  knowledge: 'int', listen: 'wis', moveSilently: 'dex', openLock: 'dex',
  perform: 'cha', profession: 'wis', ride: 'dex', search: 'int', senseMotive: 'wis',
  sleightOfHand: 'dex', speakLanguage: null, spellcraft: 'int', spot: 'wis',
  survival: 'wis', swim: 'str', tumble: 'dex', useMagicDevice: 'cha', useRope: 'dex',
};

export const SKILL_KEYS = Object.keys(SKILL_ABILITIES);

// Skills that accept multiple entries with a subtitle.
export const SUBTITLED_SKILLS = ['craft', 'knowledge', 'perform', 'profession'];

// Skills hindered by worn protection (check penalty applies).
export const ARMOR_CHECK_SKILLS = [
  'balance', 'climb', 'escapeArtist', 'hide', 'jump',
  'moveSilently', 'sleightOfHand', 'tumble',
];
// Swim applies double the check penalty.
export const DOUBLE_PENALTY_SKILLS = ['swim'];

export const SAVE_KEYS = ['fort', 'ref', 'will'];

export const SAVE_LABELS = {
  fort: 'Fortitude', ref: 'Reflex', will: 'Will',
};

export const SIZE_KEYS = [
  'fine', 'diminutive', 'tiny', 'small', 'medium',
  'large', 'huge', 'gargantuan', 'colossal',
];

// Applied to protection class and attack rolls.
export const SIZE_AC_ATTACK_MOD = {
  fine: 8, diminutive: 4, tiny: 2, small: 1, medium: 0,
  large: -1, huge: -2, gargantuan: -4, colossal: -8,
};

// Special size modifier used only for grapple checks.
export const SIZE_GRAPPLE_MOD = {
  fine: -16, diminutive: -12, tiny: -8, small: -4, medium: 0,
  large: 4, huge: 8, gargantuan: 12, colossal: 16,
};

export const SIZE_LABELS = {
  fine: 'Fine', diminutive: 'Diminutive', tiny: 'Tiny', small: 'Small',
  medium: 'Medium', large: 'Large', huge: 'Huge', gargantuan: 'Gargantuan',
  colossal: 'Colossal',
};

// Condition markers a GM can drop on a token from the core status UI.
// Identifier + short label only, no rule text.
export const CONDITIONS = [
  { id: 'blinded', label: 'Blinded', icon: 'fa-solid fa-eye-slash', color: 0x616161 },
  { id: 'confused', label: 'Confused', icon: 'fa-solid fa-question', color: 0x9c27b0 },
  { id: 'cowering', label: 'Cowering', icon: 'fa-solid fa-person-falling', color: 0x795548 },
  { id: 'dazed', label: 'Dazed', icon: 'fa-solid fa-star', color: 0xffc107 },
  { id: 'dazzled', label: 'Dazzled', icon: 'fa-solid fa-sun', color: 0xffeb3b },
  { id: 'deafened', label: 'Deafened', icon: 'fa-solid fa-ear-deaf', color: 0x8a8a8a },
  { id: 'disabled', label: 'Disabled', icon: 'fa-solid fa-heart-crack', color: 0xe53935 },
  { id: 'dying', label: 'Dying', icon: 'fa-solid fa-skull', color: 0xb71c1c },
  { id: 'entangled', label: 'Entangled', icon: 'fa-solid fa-spider', color: 0x388e3c },
  { id: 'exhausted', label: 'Exhausted', icon: 'fa-solid fa-battery-empty', color: 0x5d4037 },
  { id: 'fascinated', label: 'Fascinated', icon: 'fa-solid fa-eye', color: 0x00bcd4 },
  { id: 'fatigued', label: 'Fatigued', icon: 'fa-solid fa-battery-quarter', color: 0x8d6e63 },
  { id: 'flatFooted', label: 'Flat-Footed', icon: 'fa-solid fa-shoe-prints', color: 0x607d8b },
  { id: 'frightened', label: 'Frightened', icon: 'fa-solid fa-ghost', color: 0x9b59b6 },
  { id: 'grappling', label: 'Grappling', icon: 'fa-solid fa-hand-fist', color: 0x795548 },
  { id: 'helpless', label: 'Helpless', icon: 'fa-solid fa-person-falling-burst', color: 0x424242 },
  { id: 'invisible', label: 'Invisible', icon: 'fa-solid fa-ghost', color: 0xb0bec5 },
  { id: 'nauseated', label: 'Nauseated', icon: 'fa-solid fa-face-dizzy', color: 0x7cb342 },
  { id: 'panicked', label: 'Panicked', icon: 'fa-solid fa-person-running', color: 0xd32f2f },
  { id: 'paralyzed', label: 'Paralyzed', icon: 'fa-solid fa-ban', color: 0xffc107 },
  { id: 'petrified', label: 'Petrified', icon: 'fa-solid fa-gem', color: 0x9e9e9e },
  { id: 'pinned', label: 'Pinned', icon: 'fa-solid fa-thumbtack', color: 0x6d4c41 },
  { id: 'prone', label: 'Prone', icon: 'fa-solid fa-person-falling', color: 0x8d6e63 },
  { id: 'shaken', label: 'Shaken', icon: 'fa-solid fa-wind', color: 0x78909c },
  { id: 'sickened', label: 'Sickened', icon: 'fa-solid fa-face-frown', color: 0x689f38 },
  { id: 'stable', label: 'Stable', icon: 'fa-solid fa-heart-pulse', color: 0x43a047 },
  { id: 'staggered', label: 'Staggered', icon: 'fa-solid fa-person-walking', color: 0xfb8c00 },
  { id: 'stunned', label: 'Stunned', icon: 'fa-solid fa-bolt', color: 0xff9800 },
  { id: 'unconscious', label: 'Unconscious', icon: 'fa-solid fa-bed', color: 0x1a1614 },
];

export const ITEM_TYPE_ICON = {
  race: '🧬', class: '📜', feat: '🎖️', 'class-feature': '⭐', spell: '✨',
  weapon: '🗡️', armor: '🛡️', shield: '🛡️', equipment: '🎒', consumable: '🧪',
};

export const ITEM_TYPE_LABEL = {
  race: 'Races', class: 'Classes', feat: 'Feats', 'class-feature': 'Class Features',
  spell: 'Spells', weapon: 'Weapons', armor: 'Armor', shield: 'Shields',
  equipment: 'Equipment', consumable: 'Consumables',
};
