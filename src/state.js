import { createStore } from './lib/store.js';
import { PATTERNS, fitsZone } from './lib/patterns.js';
import { designFromTemplate, sanitizeDesign, hasZone, hasSides, hasMiddle } from './lib/templates.js';
import { MATERIALS, getMaterial } from './lib/materials.js';
import { onFontLoaded } from './lib/engraving.js';
import { panel as panelSound, stamp } from './lib/sound.js';

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
let sharedLinkBroken = false;
function designFromUrl() {
  const d = new URLSearchParams(location.search).get('d');
  if (!d) return null;
  try {
    const json = decodeURIComponent(escape(atob(d.replace(/-/g, '+').replace(/_/g, '/'))));
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== 'object' || !parsed.design) throw new Error('no design');
    return parsed;
  } catch {
    sharedLinkBroken = true; // told to the person once the app is up (see the end of this file)
    return null;
  }
}

const MATERIAL_IDS = MATERIALS.map((m) => m.id);
export const cleanDesign = (d) => sanitizeDesign(d, MATERIAL_IDS);
/** Custom patterns from storage or links: keep only well-formed ones. */
const cleanPatterns = (list) =>
  (Array.isArray(list) ? list : []).filter((p) => p && typeof p.id === 'string' && Array.isArray(p.strokes) && p.strokes.every((st) => st && Array.isArray(st.pts)));

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
const storedCustom = cleanPatterns(load('mar.custom', []));
const sharedCustom = cleanPatterns(shared?.custom);
const custom = [...storedCustom, ...sharedCustom.filter((p) => !storedCustom.some((c) => c.id === p.id))];

/** Saved designs from storage: keep only well-formed entries, each design sanitized. */
const cleanSaved = (list) =>
  (Array.isArray(list) ? list : [])
    .filter((x) => x && typeof x.id === 'string' && x.design && typeof x.design === 'object')
    .map((x) => ({ id: x.id, name: String(x.name || 'My ring').slice(0, 40), design: cleanDesign(x.design), savedAt: +x.savedAt || 0 }));
const storedDesign = load('mar.design', null); // read before the store starts saving over it

export const store = createStore({
  screen: screenFromHash(),
  design: cleanDesign(shared?.design || storedDesign),
  ringName: (typeof shared?.name === 'string' && shared.name.slice(0, 40)) || load('mar.name', 'My ring'),
  customPatterns: custom,
  savedDesigns: cleanSaved(load('mar.saved', [])),
  currentSaved: load('mar.current', null), // id in savedDesigns of the design being edited, or null
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

// Mark the page this visit opened on (a shared link drops its ?d= too), so goBack() knows there is no earlier app page.
history.replaceState({ entry: true }, '', shared || sharedLinkBroken ? location.pathname + location.hash : location.href);

store.subscribe((s) => {
  save('mar.design', s.design);
  save('mar.custom', s.customPatterns);
  save('mar.name', s.ringName);
  save('mar.rails', s.rails);
  save('mar.saved', s.savedDesigns);
  save('mar.current', s.currentSaved);
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
  const r = store.get().rails;
  const opened = ['libOpen', 'specOpen'].find((k) => k in patch && !!patch[k] !== !!r[k]);
  if (opened) panelSound(!!patch[opened]);
  store.set((s) => ({ rails: { ...s.rails, ...patch } }));
}

// ── Page transitions ──────────────────────────────────────────
// Screens sit in a row, landing → start → studio → try on → review. A curtain (page colour, drafting grid, an
// accent leading edge) sweeps in from the side you are heading to, rests while the new page renders, then sweeps
// on out the other side. The content itself never animates, so text and images cannot flicker. Clicking again
// mid-sweep closes it at once and swaps once more.
const ORDER = ['landing', 'start', 'studio', 'tryon', 'review'];
const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
// Building a screen (its 3D viewer, shaders, first ring) holds the main thread for 0.1–0.6 s, so the curtain cannot
// pass straight through at full speed: it would freeze mid-swing. Both moves start and end at rest instead, so that
// pause reads as the curtain settling, however long it is.
const HALF = 240, EASE = 'cubic-bezier(0.65, 0, 0.35, 1)';
let curtain = null, phase = 'idle', pending = null, timer = 0, cycle = 0;

function getCurtain() {
  if (curtain) return curtain;
  curtain = document.createElement('div');
  curtain.className = 'curtain';
  curtain.setAttribute('aria-hidden', 'true');
  document.body.appendChild(curtain);
  return curtain;
}
/** Slide the curtain, then call `done` once: when the animation finishes, or after a fallback delay if the
 *  browser holds frames back (a background tab), so a page change can never get stuck behind it. */
function slide(from, to, duration, easing, done) {
  const c = curtain, mine = ++cycle;
  c.getAnimations().forEach((a) => a.cancel());
  c.style.transform = `translateX(${to})`;
  const a = c.animate([{ transform: `translateX(${from})` }, { transform: `translateX(${to})` }], { duration, easing });
  let called = false;
  const once = () => !called && mine === cycle && ((called = true), clearTimeout(timer), done());
  a.finished.then(once, () => {});
  clearTimeout(timer);
  timer = setTimeout(() => {
    try {
      a.finish(); // jump to the end first, so the page never swaps behind a half-closed curtain
    } catch {}
    once();
  }, duration + 250);
}

/** Change what is on screen behind a curtain that wipes in from the right ('forward') or the left ('back'). */
export function transition(dir, update) {
  if (calm()) return void update();
  const c = getCurtain();
  pending = update;
  if (phase === 'covering') return; // the swap at full cover runs the latest request
  c.dataset.dir = dir;
  if (phase === 'idle') {
    phase = 'covering';
    c.classList.add('on');
    slide(dir === 'forward' ? '100%' : '-100%', '0%', HALF, EASE, () => swap(dir));
  } else {
    // covered or already wiping away: close it again at once and swap
    ++cycle;
    clearTimeout(timer);
    c.getAnimations().forEach((a) => a.cancel());
    c.style.transform = 'translateX(0%)';
    swap(dir);
  }
}

function swap(dir) {
  phase = 'covered';
  const run = pending, mine = cycle;
  pending = null;
  run?.();
  // Reveal once the new page has painted and its effects (3D viewer, first build) have run, so that work happens
  // behind the curtain instead of during the sweep. A newer click (cycle moved on) takes over from here.
  requestAnimationFrame(() => setTimeout(() => requestAnimationFrame(() => {
    if (mine !== cycle) return;
    phase = 'revealing';
    slide('0%', dir === 'forward' ? '-100%' : '100%', HALF, EASE, () => {
      phase = 'idle';
      curtain.classList.remove('on');
    });
  })));
}

window.addEventListener('hashchange', () => {
  const next = screenFromHash(), prev = store.get().screen;
  if (next === prev) return;
  transition(ORDER.indexOf(next) >= ORDER.indexOf(prev) ? 'forward' : 'back', () => {
    store.set({ screen: screenFromHash() }); // the address at swap time, in case it changed again mid-sweep
    window.scrollTo(0, 0);
  });
});

// ── Navigation ────────────────────────────────────────────────
export function go(screen) {
  if (location.hash !== `#/${screen}`) location.hash = `#/${screen}`;
  else store.set({ screen });
}

/** Back to the page you came from. On the first page of a visit (a shared link, a bookmark) it goes one step back in the flow instead of leaving the site. */
export function goBack() {
  if (!history.state?.entry) return history.back();
  const prev = ORDER[Math.max(0, ORDER.indexOf(store.get().screen) - 1)];
  // Replace rather than push, so Back never bounces between two pages.
  history.replaceState({ entry: true }, '', `#/${prev}`);
  window.dispatchEvent(new HashChangeEvent('hashchange'));
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
  store.set((s) => ({ design: normalize({ ...s.design, ...patch }) }));
}

// Keep combinations honest: an antique patina is a metal finish, so a plain printed polymer goes back to polished
// (and the patina leaves the price). Plating gives polymers a metal skin, so plated prints keep it.
function normalize(d) {
  const m = getMaterial(d.materialId);
  if (d.finish === 'antique' && !m.metalness && (!m.platable || d.plating === 'none')) return { ...d, finish: 'polished' };
  return d;
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

/** Name a ring gets until you rename it. */
export const DEFAULT_RING_NAME = 'My ring';

/** Start a new ring from a template: a fresh name and no engraving; only your ring size carries over. */
export function applyTemplate(id, { silent = false } = {}) {
  const s = store.get();
  const prev = { design: s.design, ringName: s.ringName, currentSaved: s.currentSaved };
  const next = designFromTemplate(id, { sizeUS: s.design.sizeUS });
  store.set({ design: next, ringName: DEFAULT_RING_NAME, activeSide: 'sideL', currentSaved: null }); // built-in templates are never saved over
  if (!silent) toast('New ring from the template', { label: 'Undo', run: () => store.set(prev) });
}

// Linked sides move together.
const withPattern = (d, zone, id) =>
  ({ ...d.patterns, ...(zone === 'middle' ? { middle: id } : d.linked ? { sideL: id, sideR: id } : { [zone]: id }) });

export function setPattern(zone, id) {
  const s = store.get();
  const d = s.design;
  setDesign({ patterns: withPattern(d, zone, id) });
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

/** The design one carousel step away (null if the layout has no such zone), so the studio can build its ring early. */
export function steppedDesign(axis, dir, s = store.get()) {
  const d = s.design;
  if (axis === 'middle' ? !hasMiddle(d.layout) : !hasSides(d.layout)) return null;
  const zone = axis === 'middle' ? 'middle' : d.linked ? 'sideL' : s.activeSide;
  return normalize({ ...d, patterns: withPattern(d, zone, neighbours(zone, dir, s)) });
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

// ── My designs: rings saved on this device, reopened from the template pickers ──
// Built-in templates are never written to; saving either updates the design you opened from My designs,
// or adds a new entry.
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function currentSavedEntry(s = store.get()) {
  return s.savedDesigns.find((x) => x.id === s.currentSaved) || null;
}
/** True when the open design differs from its saved copy (or has never been saved). */
export function hasUnsavedChanges(s = store.get()) {
  const e = currentSavedEntry(s);
  return !e || !same(e.design, s.design) || e.name !== s.ringName;
}

function uniqueName(base, list) {
  if (!list.some((x) => x.name === base)) return base;
  let n = 2;
  while (list.some((x) => x.name === `${base} ${n}`)) n++;
  return `${base} ${n}`;
}

export function saveDesign({ asNew = false } = {}) {
  const s = store.get();
  const now = Date.now();
  const existing = !asNew && currentSavedEntry(s);
  if (existing) {
    store.set({ savedDesigns: s.savedDesigns.map((x) => (x.id === existing.id ? { ...x, name: s.ringName, design: s.design, savedAt: now } : x)) });
    stamp();
    toast(`Updated “${s.ringName}” in My designs`);
    return;
  }
  const name = uniqueName((s.ringName || '').trim() || 'My ring', s.savedDesigns);
  const entry = { id: `mine-${now}`, name, design: s.design, savedAt: now };
  store.set({ savedDesigns: [entry, ...s.savedDesigns], currentSaved: entry.id, ringName: name });
  stamp();
  toast(`Saved “${name}” to My designs`);
}

export function openSavedDesign(id, { silent = false } = {}) {
  const s = store.get();
  const e = s.savedDesigns.find((x) => x.id === id);
  if (!e) return;
  const prev = { design: s.design, ringName: s.ringName, currentSaved: s.currentSaved };
  store.set({ design: cleanDesign(e.design), ringName: e.name, currentSaved: e.id, activeSide: 'sideL' });
  if (!silent) toast(`Opened “${e.name}”`, { label: 'Undo', run: () => store.set(prev) });
}

export function duplicateSavedDesign(id) {
  const s = store.get();
  const e = s.savedDesigns.find((x) => x.id === id);
  if (!e) return;
  const now = Date.now();
  const copy = { id: `mine-${now}`, name: uniqueName(`${e.name.slice(0, 34)} copy`, s.savedDesigns), design: e.design, savedAt: now };
  const i = s.savedDesigns.indexOf(e);
  store.set({ savedDesigns: [...s.savedDesigns.slice(0, i + 1), copy, ...s.savedDesigns.slice(i + 1)] });
  toast(`Duplicated as “${copy.name}”`, { label: 'Undo', run: () => store.set({ savedDesigns: store.get().savedDesigns.filter((x) => x.id !== copy.id) }) });
}

export function deleteSavedDesign(id) {
  const s = store.get();
  const e = s.savedDesigns.find((x) => x.id === id);
  if (!e) return;
  const prev = { savedDesigns: s.savedDesigns, currentSaved: s.currentSaved };
  store.set({ savedDesigns: s.savedDesigns.filter((x) => x.id !== id), currentSaved: s.currentSaved === id ? null : s.currentSaved });
  toast(`Deleted “${e.name}”`, { label: 'Undo', run: () => store.set(prev) });
}

// Opening a share link replaces the ring on screen. Keep the one you had in My designs first, so nothing is lost.
if (shared && storedDesign) {
  const mine = cleanDesign(storedDesign);
  if (!same(mine, store.get().design)) {
    const s = store.get();
    let keptId = s.savedDesigns.find((x) => same(x.design, mine))?.id;
    if (!keptId) {
      keptId = `mine-${Date.now()}`;
      const name = uniqueName(`${String(load('mar.name', 'My ring')).slice(0, 30)} (kept)`, s.savedDesigns);
      store.set({ savedDesigns: [{ id: keptId, name, design: mine, savedAt: Date.now() }, ...s.savedDesigns] });
    }
    store.set({ currentSaved: null });
    setTimeout(() => toast('Opened a shared ring. Yours is kept in My designs.', { label: 'Back to mine', run: () => openSavedDesign(keptId, { silent: true }) }), 600);
  }
}

if (sharedLinkBroken) setTimeout(() => toast('That share link is damaged or cut short, so your own ring was kept.'), 600);

// Engraving fonts load on demand; once one arrives, rebuild the ring if it uses it (the letters were drawn in a fallback).
onFontLoaded((id) => {
  const e = store.get().design.engraving;
  if (e && e.kind !== 'none' && (e.font || 'sans') === id) store.set((st) => ({ design: { ...st.design } }));
});
