// Inside engraving: short text cut into the inner surface, in one of five fonts.
// Everything here is in millimetres. The text is drawn into a heightmap of the unrolled inner
// surface, which ringGeometry.js cuts into the mesh, so the preview and the exported file match.
import { usToCircumference } from './sizes.js';
import { blur } from './heightmap.js';

export const ENGRAVE_DEPTH = 0.25; // default cut depth
export const DEPTH_MIN = 0.1, DEPTH_MAX = 0.5;
export const ENGRAVE_MARGIN = 0.7; // clear metal kept above and below the letters
export const LETTER_MIN = 1.5, LETTER_MAX = 4, LETTER_DEFAULT = 2.4;
export const MAX_CUSTOM = 24;

// `stroke` is each font's thinnest stem relative to its cap height. It sets how small letters can go before
// their strokes fall under what the material can resolve, so delicate fonts need bigger letters.
export const ENGRAVE_FONTS = [
  { id: 'sans', label: 'Sans', family: 'Inter, system-ui, sans-serif', css: '600 100px Inter, system-ui, sans-serif', stroke: 0.16, hint: 'Clean and the most robust' },
  { id: 'block', label: 'Block', family: 'Archivo, sans-serif', css: '800 expanded 100px Archivo, sans-serif', stroke: 0.2, hint: 'Wide and bold; reads from far' },
  { id: 'serif', label: 'Serif', family: 'Lora, Georgia, serif', css: '600 100px Lora, Georgia, serif', stroke: 0.12, hint: 'Classic, with finer hairlines' },
  { id: 'script', label: 'Script', family: '"Dancing Script", cursive', css: '600 100px "Dancing Script", cursive', stroke: 0.11, hint: 'Handwritten; needs bigger letters' },
  { id: 'mono', label: 'Mono', family: '"IBM Plex Mono", monospace', css: '600 100px "IBM Plex Mono", monospace', stroke: 0.15, hint: 'Even spacing, technical' },
];
export const getFont = (id) => ENGRAVE_FONTS.find((f) => f.id === id) || ENGRAVE_FONTS[0];
/** Kept for callers that only know the default font. */
export const STROKE_RATIO = ENGRAVE_FONTS[0].stroke;

// Canvas text silently falls back to another font until the web font has loaded. Load on demand and tell
// listeners, so the ring is rebuilt with the real letterforms.
const fontListeners = new Set();
export const onFontLoaded = (fn) => (fontListeners.add(fn), () => fontListeners.delete(fn));
const requested = new Set();
function ensureFont(font) {
  if (!document.fonts || document.fonts.check(font.css, 'Hg♥')) return true;
  if (!requested.has(font.id)) {
    requested.add(font.id);
    document.fonts.load(font.css, 'Hg♥').then(() => fontListeners.forEach((fn) => fn(font.id)), () => {});
  }
  return false;
}

export const ENGRAVE_KINDS = [
  { id: 'none', label: 'None' },
  { id: 'initials', label: 'Initials', hint: 'Just yours, e.g. FK' },
  { id: 'for', label: 'A for B', hint: 'e.g. FK for BW' },
  { id: 'heart', label: 'A ♥ B', hint: 'e.g. FK ♥ BW' },
  { id: 'love', label: 'love', hint: 'The word “love”' },
  { id: 'custom', label: 'Custom', hint: `Up to ${MAX_CUSTOM} characters` },
];

export const DEFAULT_ENGRAVING = { kind: 'none', a: 'FK', b: 'BW', text: '', size: LETTER_DEFAULT, depth: ENGRAVE_DEPTH, font: 'sans' };
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
function measure(text, font) {
  measureCtx ||= document.createElement('canvas').getContext('2d');
  measureCtx.font = font.css;
  const cap = measureCtx.measureText('H').actualBoundingBoxAscent || 72;
  return { cap, width: measureCtx.measureText(text).width };
}

/** Physical size of the engraving on this ring, and whether it fits. */
export function engravingLayout(design) {
  const text = engravingText(design);
  if (!text) return null;
  const e = getEngraving(design);
  const font = getFont(e.font);
  const fontReady = ensureFont(font);
  const h = e.size;
  const depth = Math.min(DEPTH_MAX, Math.max(DEPTH_MIN, +e.depth || ENGRAVE_DEPTH));
  const { cap, width } = measure(text, font);
  const lengthMM = (width / cap) * h;
  const innerCirc = usToCircumference(design.sizeUS);
  return {
    text,
    h,
    depth,
    font,
    fontReady,
    lengthMM,
    capEm: cap / 100, // cap height as a fraction of the font size, for drawing previews at true scale
    strokeMM: h * font.stroke,
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
  const key = `${L.text}|${L.h}|${L.font.id}|${L.fontReady}|${design.sizeUS}|${design.width}`;
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
  const { cap } = measure(L.text, L.font);
  const scale = (L.h * pxPerMM) / cap;
  ctx.save();
  ctx.translate(W / 2, H / 2);
  // Canvas row 0 is the bottom edge of the ring, and seen from inside, u runs to the viewer's right.
  // So only a vertical flip is needed for the letters to read upright, left to right, from inside.
  ctx.scale(scale, -scale);
  ctx.font = L.font.css;
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
