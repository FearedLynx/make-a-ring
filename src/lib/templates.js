// Layouts split the band width into zones. `from`/`to` are fractions of the band width,
// measured from the left edge of the ring as seen in the studio.

export const LAYOUTS = {
  trio: {
    name: 'Trio',
    hint: 'Middle pattern framed by two side borders',
    zones: [
      { id: 'sideL', from: 0, to: 0.24 },
      { id: 'middle', from: 0.24, to: 0.76 },
      { id: 'sideR', from: 0.76, to: 1 },
    ],
    dividers: [0.24, 0.76],
  },
  rails: {
    name: 'Twin Rails',
    hint: 'Two side borders around a plain, polished centre',
    zones: [
      { id: 'sideL', from: 0, to: 0.3 },
      { id: 'sideR', from: 0.7, to: 1 },
    ],
    dividers: [],
  },
  center: {
    name: 'Centre Line',
    hint: 'One middle pattern with clean polished edges',
    zones: [{ id: 'middle', from: 0.16, to: 0.84 }],
    dividers: [0.16, 0.84],
  },
  wrap: {
    name: 'Full Wrap',
    hint: 'One pattern across the whole band',
    zones: [{ id: 'middle', from: 0, to: 1 }],
    dividers: [],
  },
};

// How big the sides (or plain edges) are, as a fraction of the band width. Adjustable per layout.
export const SPLIT = {
  trio: { def: 0.24, min: 0.1, max: 0.4, label: 'Side borders', unit: 'each side' },
  rails: { def: 0.3, min: 0.12, max: 0.44, label: 'Rail width', unit: 'each rail' },
  center: { def: 0.16, min: 0.04, max: 0.36, label: 'Plain edges', unit: 'each edge' },
};

export const getSplit = (design) => design.splits?.[design.layout] ?? SPLIT[design.layout]?.def ?? 0;

/** Zones and divider positions for a design, honouring its custom proportions. */
export function layoutZones(design) {
  const s = getSplit(design);
  switch (design.layout) {
    case 'trio':
      return { zones: [{ id: 'sideL', from: 0, to: s }, { id: 'middle', from: s, to: 1 - s }, { id: 'sideR', from: 1 - s, to: 1 }], dividers: [s, 1 - s], handles: [s, 1 - s] };
    case 'rails':
      return { zones: [{ id: 'sideL', from: 0, to: s }, { id: 'sideR', from: 1 - s, to: 1 }], dividers: [], handles: [s, 1 - s] };
    case 'center':
      return { zones: [{ id: 'middle', from: s, to: 1 - s }], dividers: [s, 1 - s], handles: [s, 1 - s] };
    default:
      return { zones: [{ id: 'middle', from: 0, to: 1 }], dividers: [], handles: [] };
  }
}

export function splitPatch(design, value) {
  const cfg = SPLIT[design.layout];
  if (!cfg) return {};
  const v = Math.round(Math.min(cfg.max, Math.max(cfg.min, value)) * 100) / 100;
  return { splits: { ...(design.splits || {}), [design.layout]: v } };
}

export const hasZone = (layoutId, zoneId) => LAYOUTS[layoutId].zones.some((z) => z.id === zoneId);
export const hasSides = (layoutId) => hasZone(layoutId, 'sideL');
export const hasMiddle = (layoutId) => hasZone(layoutId, 'middle');

const base = {
  sizeUS: 7,
  thickness: 1.8,
  relief: 0.35,
  style: 'raised',
  finish: 'polished',
  plating: 'none',
  linked: true,
  repeats: { middle: 0, side: 0 },
};

export const TEMPLATES = [
  {
    id: 'heritage',
    name: 'Heritage',
    blurb: 'A lattice heart framed by filigree. The ring from the first sketch.',
    layout: 'trio',
    patterns: { middle: 'lattice', sideL: 'filigree', sideR: 'filigree' },
    width: 7, profile: 'domed', materialId: 'silver', finish: 'antique',
  },
  {
    id: 'twin-rails',
    name: 'Twin Rails',
    blurb: 'Scalloped borders, mirror-polished centre.',
    layout: 'rails',
    patterns: { middle: null, sideL: 'scallop', sideR: 'scallop' },
    width: 6, profile: 'flat', materialId: 'gold-yellow',
  },
  {
    id: 'solitaire',
    name: 'Solitaire Line',
    blurb: 'A single row of diamonds on a slim comfort band.',
    layout: 'center',
    patterns: { middle: 'diamonds', sideL: null, sideR: null },
    width: 4.5, profile: 'comfort', materialId: 'gold-white', thickness: 1.6,
  },
  {
    id: 'everwrap',
    name: 'Everwrap',
    blurb: 'An endless wave, edge to edge.',
    layout: 'wrap',
    patterns: { middle: 'wave', sideL: null, sideR: null },
    width: 5, profile: 'domed', materialId: 'gold-rose',
  },
  {
    id: 'nordic',
    name: 'Nordic',
    blurb: 'Feathered centre with Morse-code rails. Bold and wide.',
    layout: 'trio',
    patterns: { middle: 'feather', sideL: 'morse', sideR: 'morse' },
    width: 8, profile: 'flat', materialId: 'titanium', thickness: 2, style: 'engraved',
  },
  {
    id: 'botanica',
    name: 'Botanica',
    blurb: 'Leaves on a vine, with laurel borders.',
    layout: 'trio',
    patterns: { middle: 'botanica', sideL: 'laurel', sideR: 'laurel' },
    width: 7.5, profile: 'domed', materialId: 'gold-yellow',
  },
  {
    id: 'duet',
    name: 'Duet',
    blurb: 'Two different sides, two people, one ring.',
    layout: 'trio',
    patterns: { middle: 'hearts', sideL: 'pearls', sideR: 'sawtooth' },
    linked: false,
    width: 7, profile: 'comfort', materialId: 'resin', plating: 'gold',
  },
  {
    id: 'blank',
    name: 'Blank Band',
    blurb: 'Start from nothing and draw your own.',
    layout: 'wrap',
    patterns: { middle: null, sideL: null, sideR: null },
    width: 6, profile: 'comfort', materialId: 'silver', finish: 'polished',
  },
];

export function designFromTemplate(id, keep = {}) {
  const t = TEMPLATES.find((x) => x.id === id) || TEMPLATES[0];
  const { blurb, name, ...rest } = t;
  return {
    ...base,
    ...rest,
    templateId: t.id,
    repeats: { ...base.repeats },
    patterns: { ...t.patterns },
    ...keep,
  };
}
