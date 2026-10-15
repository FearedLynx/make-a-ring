import { createStore } from './lib/store.js';
import { PATTERNS, fitsZone } from './lib/patterns.js';
import { designFromTemplate, hasZone, hasSides, hasMiddle } from './lib/templates.js';

const SCREENS = ['landing', 'start', 'studio', 'tryon', 'review'];

const load = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};
const save = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
};

function screenFromHash() {
  const s = location.hash.replace(/^#\/?/, '').split('?')[0];
  return SCREENS.includes(s) ? s : 'landing';
}

// A shared link carries the design (and any custom patterns it uses) in ?d=
function designFromUrl() {
  try {
    const d = new URLSearchParams(location.search).get('d');
    if (!d) return null;
    const json = decodeURIComponent(escape(atob(d.replace(/-/g, '+').replace(/_/g, '/'))));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

// Side panels: content widths (the 44 px category strip comes on top) and the open category.
// Smaller screens start with slimmer panels so the stage gets the room; the resizer still widens them.
export const RAIL_DEFAULTS = matchMedia('(max-width: 1440px)').matches ? { lib: 240, spec: 268 } : { lib: 256, spec: 296 };
function loadRails() {
  const r = load('mar.rails', null);
  const base = { ...RAIL_DEFAULTS, libOpen: true, specOpen: true, libCat: 'patterns', specCat: 'size', v: 2 };
  if (!r) return base;
  // Before the category strips, widths included everything; keep the panels the same overall size.
  if (r.v !== 2) return { ...base, ...r, lib: Math.max(240, r.lib - 44), spec: Math.max(240, r.spec - 44), v: 2 };
  return { ...base, ...r };
}

const shared = designFromUrl();
const storedCustom = load('mar.custom', []);
const custom = shared?.custom
  ? [...storedCustom, ...shared.custom.filter((p) => !storedCustom.some((c) => c.id === p.id))]
  : storedCustom;

export const store = createStore({
  screen: screenFromHash(),
  design: shared?.design || load('mar.design', null) || designFromTemplate('heritage'),
  ringName: shared?.name || load('mar.name', 'My first ring'),
  customPatterns: custom,
  activeSide: 'sideL',
  libZone: 'all',
  editor: null, // { zone: 'middle' | 'side', base?: pattern }
  sizeFinderOpen: false,
  shortcutsOpen: false,
  exportOpen: false,
  toast: null,
  announce: '',
  tryOn: { tone: 1, build: 'slender', finger: 'ring', close: true, mode: 'illustration', photo: null, pos: { x: 0.5, y: 0.5, scale: 1, rot: 0 } },
  theme: document.documentElement.dataset.theme || 'beige',
  grid: document.documentElement.dataset.grid !== 'off',
  rails: loadRails(),
  tip: null, // { id, text }
  tour: null, // { id, step }
});

if (shared) history.replaceState(null, '', location.pathname + location.hash);

store.subscribe((s) => {
  save('mar.design', s.design);
  save('mar.custom', s.customPatterns);
  save('mar.name', s.ringName);
  save('mar.rails', s.rails);
});

// ── Theme ─────────────────────────────────────────────────────
export const THEMES = [
  { id: 'beige', name: 'Beige', swatch: '#a8792a', bg: '#f3efe7' },
  { id: 'blue', name: 'Blue', swatch: '#1f5fd1', bg: '#eaf0f7' },
  { id: 'gray', name: 'Gray', swatch: '#3d3f42', bg: '#ececea' },
  { id: 'red', name: 'Red', swatch: '#c0261c', bg: '#f5ede9' },
];
export function setTheme(id) {
  document.documentElement.dataset.theme = id;
  try {
    localStorage.setItem('mar.theme', id);
  } catch {}
  store.set({ theme: id });
}

export function setGrid(on) {
  document.documentElement.dataset.grid = on ? 'on' : 'off';
  try {
    localStorage.setItem('mar.grid', on ? 'on' : 'off');
  } catch {}
  store.set({ grid: on });
}

// ── One-off tips ("don't show again") and guided tours ───────
const offTips = () => load('mar.tips.off', []);
export function showTip(id, text) {
  if (offTips().includes(id) || store.get().tour) return;
  store.set({ tip: { id, text } });
}
export function dismissTip(forever = false) {
  const t = store.get().tip;
  if (forever && t) save('mar.tips.off', [...offTips(), t.id]);
  store.set({ tip: null });
}
export const tourDone = (id) => load('mar.tours.done', []).includes(id);
const markTourSeen = (id) => save('mar.tours.done', [...new Set([...load('mar.tours.done', []), id])]);
// A tour counts as seen as soon as it starts: finished, skipped, or left by reloading, it never
// starts on its own again. The help menu still replays it.
export function startTour(id) {
  markTourSeen(id);
  store.set({ tour: { id, step: 0, snapshot: id === 'studio' ? store.get().design : null }, tip: null });
}
export function endTour() {
  const t = store.get().tour;
  if (t) markTourSeen(t.id);
  store.set({ tour: null });
}

export function setRails(patch) {
  store.set((s) => ({ rails: { ...s.rails, ...patch } }));
}

window.addEventListener('hashchange', () => {
  store.set({ screen: screenFromHash() });
  window.scrollTo(0, 0);
});

// ── Navigation ────────────────────────────────────────────────
export function go(screen) {
  if (location.hash !== `#/${screen}`) location.hash = `#/${screen}`;
  else store.set({ screen });
}

// ── Patterns ──────────────────────────────────────────────────
export function allPatterns(s = store.get()) {
  return [...PATTERNS, ...s.customPatterns];
}
export function patternById(id, s = store.get()) {
  if (!id) return null;
  return allPatterns(s).find((p) => p.id === id) || null;
}
/** Carousel order for a zone: plain first, then built-ins, then the user's own. */
export function patternsForZone(zone, s = store.get()) {
  return [null, ...allPatterns(s).filter((p) => fitsZone(p, zone)).map((p) => p.id)];
}

// ── Design actions ────────────────────────────────────────────
export function setDesign(patch) {
  store.set((s) => ({ design: { ...s.design, ...patch } }));
}

let toastTimer;
export function toast(msg, action) {
  clearTimeout(toastTimer);
  store.set({ toast: { msg, action, id: Date.now() } });
  toastTimer = setTimeout(() => store.set({ toast: null }), action ? 6000 : 3200);
}

export function announce(msg) {
  store.set({ announce: msg });
}

export function applyTemplate(id, { silent = false } = {}) {
  const prev = store.get().design;
  const next = designFromTemplate(id, { sizeUS: prev.sizeUS, ...(prev.engraving ? { engraving: prev.engraving } : {}) }); // size and engraving are personal, keep them
  store.set({ design: next, activeSide: 'sideL' });
  if (!silent) toast('Template applied', { label: 'Undo', run: () => store.set({ design: prev }) });
}

export function setPattern(zone, id) {
  const s = store.get();
  const d = s.design;
  const patterns = { ...d.patterns };
  if (zone === 'middle') patterns.middle = id;
  else if (d.linked) patterns.sideL = patterns.sideR = id;
  else patterns[zone] = id;
  setDesign({ patterns });
  const name = patternById(id)?.name || 'Plain';
  const label = zone === 'middle' ? 'Middle' : d.linked ? 'Sides' : zone === 'sideL' ? 'Left side' : 'Right side';
  announce(`${label}: ${name}`);
}

/** Step through the carousel. axis 'middle' | 'side'; dir -1 or +1. */
export function cyclePattern(axis, dir) {
  const s = store.get();
  const d = s.design;
  if (axis === 'middle' && !hasMiddle(d.layout)) return;
  if (axis === 'side' && !hasSides(d.layout)) return;
  const zone = axis === 'middle' ? 'middle' : d.linked ? 'sideL' : s.activeSide;
  const list = patternsForZone(zone, s);
  const i = list.indexOf(d.patterns[zone] ?? null);
  const next = list[(i + dir + list.length) % list.length];
  setPattern(zone, next);
}

export function neighbours(zone, offset, s = store.get()) {
  const list = patternsForZone(zone, s);
  const i = Math.max(0, list.indexOf(s.design.patterns[zone] ?? null));
  return list[(i + offset + list.length * 4) % list.length];
}

export function setLinked(linked) {
  const d = store.get().design;
  const patterns = { ...d.patterns };
  if (linked) patterns.sideR = patterns[store.get().activeSide];
  setDesign({ linked, patterns });
  announce(linked ? 'Sides linked: both sides match' : 'Sides unlinked: style each side on its own');
}

export function saveCustomPattern(p) {
  store.set((s) => ({ customPatterns: [...s.customPatterns.filter((c) => c.id !== p.id), p] }));
}

export function deleteCustomPattern(id) {
  const s = store.get();
  const removed = s.customPatterns.find((c) => c.id === id);
  const prevDesign = s.design;
  const patterns = { ...s.design.patterns };
  for (const k of Object.keys(patterns)) if (patterns[k] === id) patterns[k] = null;
  store.set({ customPatterns: s.customPatterns.filter((c) => c.id !== id), design: { ...s.design, patterns } });
  toast(`Deleted “${removed?.name}”`, {
    label: 'Undo',
    run: () => store.set((st) => ({ customPatterns: [...st.customPatterns, removed], design: prevDesign })),
  });
}

export function zoneIsActive(zone, s = store.get()) {
  return hasZone(s.design.layout, zone);
}

export function shareUrl() {
  const s = store.get();
  const used = Object.values(s.design.patterns);
  const payload = {
    design: s.design,
    name: s.ringName,
    custom: s.customPatterns.filter((p) => used.includes(p.id)),
  };
  const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(payload))))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `${location.origin}${location.pathname}?d=${b64}#/studio`;
}
