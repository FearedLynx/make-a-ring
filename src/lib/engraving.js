// Inside engraving: short text cut into the inner surface, in a clean sans that prints reliably.
// Everything here is in millimetres. The text is drawn into a heightmap of the unrolled inner
// surface, which ringGeometry.js cuts into the mesh, so the preview and the exported file match.
import { usToCircumference } from './sizes.js';
import { blur } from './heightmap.js';

export const ENGRAVE_DEPTH = 0.25; // how deep the letters are cut
export const ENGRAVE_MARGIN = 0.7; // clear metal kept above and below the letters
export const LETTER_MIN = 1.5, LETTER_MAX = 4, LETTER_DEFAULT = 2.4;
// Stem thickness of the semi-bold sans relative to its cap height. Sets how small letters can go
// before their strokes fall under what the material can resolve.
export const STROKE_RATIO = 0.16;
export const MAX_CUSTOM = 24;
const FONT = '600 100px Inter, Archivo, system-ui, sans-serif';

export const ENGRAVE_KINDS = [
  { id: 'none', label: 'None' },
  { id: 'initials', label: 'Initials', hint: 'Just yours, e.g. FK' },
  { id: 'for', label: 'A for B', hint: 'e.g. FK for BW' },
  { id: 'heart', label: 'A ♥ B', hint: 'e.g. FK ♥ BW' },
  { id: 'love', label: 'love', hint: 'The word “love”' },
  { id: 'custom', label: 'Custom', hint: `Up to ${MAX_CUSTOM} characters` },
];

export const DEFAULT_ENGRAVING = { kind: 'none', a: 'FK', b: 'BW', text: '', size: LETTER_DEFAULT };
export const getEngraving = (design) => ({ ...DEFAULT_ENGRAVING, ...(design.engraving || {}) });

/** Initials: letters only, upper case, at most three. */
export const cleanInitials = (s) => (s || '').toUpperCase().replace(/[^A-ZÀ-ÖØ-Þ]/g, '').slice(0, 3);
/** Custom text: letters, digits and a few marks that hold up when printed small. */
export const cleanCustom = (s) => (s || '').replace(/[^\p{L}\p{N} .,&'+\-♥]/gu, '').replace(/\s+/g, ' ').slice(0, MAX_CUSTOM);

export function engravingText(design) {
  const e = getEngraving(design);
  const a = cleanInitials(e.a), b = cleanInitials(e.b);
  switch (e.kind) {
    case 'initials': return a;
    case 'for': return a && b ? `${a} for ${b}` : a || b;
    case 'heart': return a && b ? `${a} ♥ ${b}` : a || b;
    case 'love': return 'love';
    case 'custom': return cleanCustom(e.text).trim();
    default: return '';
  }
}

let measureCtx;
function measure(text) {
  measureCtx ||= document.createElement('canvas').getContext('2d');
  measureCtx.font = FONT;
  const cap = measureCtx.measureText('H').actualBoundingBoxAscent || 72;
  return { cap, width: measureCtx.measureText(text).width };
}

/** Physical size of the engraving on this ring, and whether it fits. */
export function engravingLayout(design) {
  const text = engravingText(design);
  if (!text) return null;
  const e = getEngraving(design);
  const h = e.size;
  const { cap, width } = measure(text);
  const lengthMM = (width / cap) * h;
  const innerCirc = usToCircumference(design.sizeUS);
  return {
    text,
    h,
    lengthMM,
    strokeMM: h * STROKE_RATIO,
    maxH: Math.max(0, +(design.width - 2 * ENGRAVE_MARGIN).toFixed(1)),
    maxLength: innerCirc * 0.85, // keep a clear gap so the text does not run into itself
    innerCirc,
  };
}

const cache = { key: '', map: null };

/**
 * Heightmap of the inner surface: u runs around the inside, v across the band (0 at s = -1).
 * Text is centred at u = 0.5 and reads correctly from inside the ring.
 */
export function buildEngravingMap(design) {
  const L = engravingLayout(design);
  if (!L) return null;
  const key = `${L.text}|${L.h}|${design.sizeUS}|${design.width}`;
  if (cache.key === key) return cache.map;
  const W = 2048;
  const pxPerMM = W / L.innerCirc;
  const H = Math.max(48, Math.min(512, Math.round(design.width * pxPerMM)));
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  const { cap } = measure(L.text);
  const scale = (L.h * pxPerMM) / cap;
  ctx.save();
  ctx.translate(W / 2, H / 2);
  // Canvas row 0 is the bottom edge of the ring, and seen from inside, u runs to the viewer's right.
  // So only a vertical flip is needed for the letters to read upright, left to right, from inside.
  ctx.scale(scale, -scale);
  ctx.font = FONT;
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(L.text, 0, cap / 2);
  ctx.restore();
  const img = ctx.getImageData(0, 0, W, H).data;
  let data = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) data[i] = img[i * 4] / 255;
  data = blur(data, W, H); // soften letter edges over a couple of mesh vertices so they do not stair-step
  cache.key = key;
  cache.map = { data, W, H };
  return cache.map;
}
