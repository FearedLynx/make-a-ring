// Pattern editor: draw one tile, let symmetry and stamps do the heavy lifting,
// and see it wrap around the ring when you lift the pen.
import { Component } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { html } from '../lib/html.js';
import { Icon, Modal, Segmented, Slider } from './ui.js';
import { RingView } from './ring-view.js';
import { BandMap } from './pattern-art.js';
import { thinStroke, circlePoints } from '../lib/patterns.js';
import { hasMiddle, hasSides, layoutZones, getSplit, splitPatch } from '../lib/templates.js';
import { resolveZones, lineWidthMM, MIN_LINE_MM } from '../lib/band.js';
import { getMaterial } from '../lib/materials.js';
import { bendAt, rimFade } from '../lib/ringGeometry.js';
import { STAMPS, stampStroke, GENERATORS, generate, SYMMETRY, symMats, applyM, applyV, inv, steady, recognise, constrain } from '../lib/shapes.js';
import { store, patternById, saveCustomPattern, setPattern, setDesign, toast, showTip, startTour, tourDone } from '../state.js';

const DRAFT = '__draft';
const GRID = 12;
const MAX_LINE_MM = 1.2;
const ZOOM_MIN = 1, ZOOM_MAX = 6;
const TOOLS = [
  { id: 'pen', icon: 'pen', label: 'Pen', key: 'P' },
  { id: 'line', icon: 'line', label: 'Line', key: 'L' },
  { id: 'square', icon: 'square', label: 'Square', key: 'S' },
  { id: 'circle', icon: 'circle', label: 'Circle', key: 'C' },
  { id: 'dot', icon: 'dot', label: 'Dot', key: 'D' },
  { id: 'stamp', icon: 'sparkle', label: 'Stamp', key: 'T' },
  { id: 'move', icon: 'move', label: 'Move', key: 'V' },
  { id: 'eraser', icon: 'eraser', label: 'Eraser', key: 'E' },
];
const TABS = [
  { id: 'line', label: 'Line' },
  { id: 'steady', label: 'Steady' },
  { id: 'stamps', label: 'Stamps' },
  { id: 'generate', label: 'Generate' },
];

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const copyStrokes = (list) => list.map((s) => ({ ...s, pts: s.pts.map((p) => [...p]) }));
const I = [1, 0, 0, 1];
let groupSeq = 1;

/** Skips re-rendering heavy children (3D preview, band map) unless their inputs change. */
class Pure extends Component {
  shouldComponentUpdate(next) {
    for (const k in next) if (k !== 'render' && next[k] !== this.props[k]) return true;
    return false;
  }
  render({ render }) {
    return render();
  }
}

// Strokes placed with symmetry on share a group `g` and carry `sym: true`; each copy keeps its
// transform `t`. Generated pieces share a group too, but without `sym`, and always act as one piece.
// Saved patterns keep their groups, so reopening one gets fresh group ids to avoid clashes.
const loadStrokes = (list) => {
  const ids = new Map();
  return copyStrokes(list).map((s) => {
    if (!s.g) return s;
    if (!ids.has(s.g)) ids.set(s.g, groupSeq++);
    return { ...s, g: ids.get(s.g) };
  });
};

/** True when acting on stroke `s` should also act on the other copies in its group. */
const linkedTo = (s, symOn) => !!s?.g && (!s.sym || symOn);

/** Indices of `idx` plus every copy linked to them. */
function withPartners(strokes, idx, symOn) {
  const out = new Set(idx);
  const groups = new Set([...idx].map((i) => strokes[i]).filter((s) => linkedTo(s, symOn)).map((s) => s.g));
  if (groups.size) strokes.forEach((s, j) => groups.has(s.g) && out.add(j));
  return out;
}

function moveStrokes(strokes, sel, delta, symOn) {
  const out = strokes.slice();
  const done = new Set();
  const shift = (s, [dx, dy]) => ({ ...s, pts: s.pts.map(([x, y]) => [x + dx, y + dy]) });
  for (const i of sel) {
    const s = strokes[i];
    if (!s) continue;
    if (linkedTo(s, symOn)) {
      if (done.has(s.g)) continue;
      done.add(s.g);
      const base = applyV(inv(s.t || I), delta);
      strokes.forEach((o, j) => o.g === s.g && (out[j] = shift(o, applyV(o.t || I, base))));
    } else out[i] = shift(s, delta);
  }
  return out;
}

/** True on phone-width screens; follows rotation and resizing. */
function useNarrow(query = '(max-width: 760px)') {
  const [on, setOn] = useState(() => matchMedia(query).matches);
  useEffect(() => {
    const mq = matchMedia(query);
    const onChange = () => setOn(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);
  return on;
}

function distToStroke(p, s) {
  let best = Infinity;
  const n = s.pts.length;
  for (let i = 0; i < n; i++) {
    const a = s.pts[i], b = s.pts[i + 1] || (s.closed ? s.pts[0] : a);
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const t = dx || dy ? clamp(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy), 0, 1) : 0;
    best = Math.min(best, Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy)));
  }
  if (s.fill && s.closed) {
    let inside = false;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const [xi, yi] = s.pts[i], [xj, yj] = s.pts[j];
      if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
    }
    if (inside) return 0;
  }
  return best;
}

const pathD = (pts, TW, TH, closed) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${(x * TW).toFixed(2)} ${(y * TH).toFixed(2)}`).join('') + (closed ? 'Z' : '');

export function PatternEditor() {
  const editor = store.use((s) => s.editor);
  const design = store.use((s) => s.design);
  const open = !!editor;
  const mat = getMaterial(design.materialId);
  const minLw = Math.max(MIN_LINE_MM, Math.ceil(mat.minDetail * 20) / 20);

  const [zone, setZone] = useState('middle');
  const [name, setName] = useState('');
  const [aspect, setAspect] = useState(1);
  const [lw, setLw] = useState(minLw);
  const [tool, setTool] = useState('pen');
  const [sym, setSym] = useState('mx');
  const [snap, setSnap] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [showBends, setShowBends] = useState(true);
  const [stead, setStead] = useState({ on: true, amt: 60, shapes: true });
  const [stamp, setStamp] = useState({ id: 'leaf', size: 0.45, angle: 0, fill: false });
  const [gen, setGen] = useState({ kind: 'wave', cycles: 1, amp: 0.3, double: false });
  const [tab, setTab] = useState('line');
  const [hist, setHist] = useState({ past: [], present: [], future: [] });
  const [live, setLive] = useState(null); // line / square / circle previews
  const [cursor, setCursor] = useState(null);
  const [sel, setSel] = useState(new Set());
  const [view, setView] = useState({ z: 1, cx: null, cy: null });
  const [flash, setFlash] = useState('');
  const svg = useRef();
  const liveG = useRef(); // pen strokes are drawn straight into the DOM while dragging (no re-render)
  const drag = useRef(null);
  const toolClicks = useRef(0);
  const spaceDown = useRef(false);
  const narrow = useNarrow();

  // (Re)initialise whenever the editor opens.
  useEffect(() => {
    if (!editor) return;
    const base = editor.base;
    setZone(base ? (base.zone === 'side' ? 'side' : 'middle') : editor.zone || 'middle');
    setName(base?.custom ? base.name : base ? `${base.name} remix` : `My pattern ${store.get().customPatterns.length + 1}`);
    setAspect(base?.aspect ?? 1);
    setLw(base?.lw ?? minLw);
    setHist({ past: [], present: base ? loadStrokes(base.strokes) : [], future: [] });
    setLive(null);
    setSel(new Set());
    setTool('pen');
    setTab('line');
    setView({ z: 1, cx: null, cy: null });
    toolClicks.current = 0;
    if (!tourDone('editor')) setTimeout(() => startTour('editor'), 500);
  }, [editor]);

  // The tour can switch the side panel tab.
  useEffect(() => {
    const onTab = (e) => setTab(e.detail);
    addEventListener('mar:edtab', onTab);
    return () => removeEventListener('mar:edtab', onTab);
  }, []);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(''), 1800);
    return () => clearTimeout(t);
  }, [flash]);

  const strokes = hist.present;
  const commit = (next) => setHist((h) => ({ past: [...h.past.slice(-80), h.present], present: next, future: [] }));
  const undo = () => setHist((h) => (h.past.length ? { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] } : h));
  const redo = () => setHist((h) => (h.future.length ? { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) } : h));
  const mats = symMats(sym, aspect);
  const symOn = sym !== 'none';
  const withSymmetry = (s) => {
    const g = groupSeq++;
    const placedOnSymmetry = mats.length > 1;
    return mats.map((m) => ({ ...s, g, t: m, sym: placedOnSymmetry, pts: s.pts.map((p) => applyM(m, p)) }));
  };
  const addStroke = (s) => commit([...strokes, ...withSymmetry(s)]);

  // ── Preview design (only committed strokes, so drawing never rebuilds the 3D ring) ──
  const preview = useMemo(() => {
    let layout = design.layout;
    if (zone === 'middle' && !hasMiddle(layout)) layout = 'trio';
    if (zone === 'side' && !hasSides(layout)) layout = 'trio';
    const patterns = { ...design.patterns };
    if (zone === 'middle') patterns.middle = DRAFT;
    else patterns.sideL = patterns.sideR = DRAFT;
    return { ...design, layout, patterns, repeats: { middle: 0, side: 0 } };
  }, [design, zone]);
  const zoneBox = layoutZones(preview).zones.find((z) => z.id === (zone === 'middle' ? 'middle' : 'sideL'));
  const zh = (zoneBox.to - zoneBox.from) * preview.width;
  const draft = useMemo(
    () => ({ id: DRAFT, name: name || 'Draft', zone: zone === 'middle' ? 'middle' : 'side', tags: ['custom'], aspect, lw, sw: lw / zh, strokes, custom: true }),
    [strokes, aspect, lw, zh, zone, name]
  );
  const getP = (id) => (id === DRAFT ? draft : patternById(id));
  const lineMM = lineWidthMM(draft, zh);
  const swTile = lineMM / zh;
  const tileW = aspect * zh;

  // ── View: zoom & pan ──
  const TW = aspect * 100, TH = 100, pad = 14;
  // Phones show the tile with a sliver of each neighbour instead of three whole tiles, so the tile is big enough to draw on.
  const side = narrow ? 0.18 * TW : TW;
  const base = { x: -side - pad, y: -pad - 10, w: TW + 2 * side + 2 * pad, h: TH + 2 * pad + 20 };
  const cx = view.cx ?? TW / 2, cy = view.cy ?? TH / 2;
  const vw = base.w / view.z, vh = base.h / view.z;
  const vb = { x: cx - vw / 2, y: cy - vh / 2, w: vw, h: vh };
  const setZoom = (z, at) => {
    const nz = clamp(z, ZOOM_MIN, ZOOM_MAX);
    if (nz === 1) return setView({ z: 1, cx: null, cy: null });
    const ax = at ? at[0] : cx, ay = at ? at[1] : cy;
    setView({ z: nz, cx: ax + (cx - ax) * (view.z / nz), cy: ay + (cy - ay) * (view.z / nz) });
  };
  const pan = (dx, dy) => view.z > 1 && setView((v) => ({ ...v, cx: (v.cx ?? TW / 2) + dx, cy: (v.cy ?? TH / 2) + dy }));

  const svgPoint = (e) => {
    const pt = svg.current.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    return pt.matrixTransform(svg.current.getScreenCTM().inverse());
  };
  const toTile = (e) => {
    const p = svgPoint(e);
    return [clamp(p.x / TW, -0.5, 1.5), clamp(p.y / TH, 0, 1)];
  };
  const snapPt = ([x, y]) => (snap ? [Math.round(x * GRID * aspect) / (GRID * aspect), Math.round(y * GRID) / GRID] : [x, y]);
  const snapDelta = ([dx, dy]) => (snap ? [Math.round(dx * GRID * aspect) / (GRID * aspect), Math.round(dy * GRID) / GRID] : [dx, dy]);

  // ── Seam guides: where a line leaves one tile edge it must re-enter on the other ──
  const seam = useMemo(() => {
    const ends = [];
    strokes.forEach((s) => {
      if (s.closed || s.pts.length < 2) return;
      [s.pts[0], s.pts[s.pts.length - 1]].forEach((p) => {
        if (p[0] < 0.03) ends.push({ side: 0, y: p[1] });
        else if (p[0] > 0.97) ends.push({ side: 1, y: p[1] });
      });
    });
    return ends.map((e) => ({ x: e.side ? 0 : 1, y: e.y, matched: ends.some((o) => o.side !== e.side && Math.abs(o.y - e.y) < 0.025) }));
  }, [strokes]);
  const seamSnap = (p) => {
    if (!snap) return p;
    let [x, y] = p;
    if (x < 0.04 || x > 0.96) {
      x = x < 0.5 ? 0 : 1;
      const g = seam.find((s) => s.x === x && !s.matched && Math.abs(s.y - y) < 0.06);
      if (g) y = g.y;
    }
    return [x, y];
  };

  const hitIndex = (p) => {
    let best = -1, bd = Infinity;
    strokes.forEach((s, i) => {
      const d = distToStroke(p, s);
      if (d < bd) (bd = d), (best = i);
    });
    return bd <= swTile / 2 + 0.04 ? best : -1;
  };

  const finishLine = () => {
    if (live && live.pts.length > 1 && tool === 'line') addStroke({ pts: live.pts.map(seamSnap) });
    setLive(null);
  };
  const pickTool = (id, fromClick) => {
    finishLine();
    setTool(id);
    if (id !== 'move') setSel(new Set());
    if (id === 'stamp') setTab('stamps');
    if (id === 'pen' && tab === 'stamps') setTab('steady');
    if (fromClick && ++toolClicks.current === 3)
      showTip('editor-keys', 'Tip: every tool has a one-key shortcut. P pen, L line, S square, C circle, D dot, T stamp, V move, E eraser. Press ? for the full list.');
  };

  const drawLivePen = (pts) => {
    if (!liveG.current) return;
    liveG.current.innerHTML = mats
      .map((m) => `<path d="${pathD(pts.map((p) => applyM(m, p)), TW, TH)}" class="ed-stroke live" stroke-width="${swTile * TH}" fill="none"/>`)
      .join('');
  };
  const currentStamp = (at) => stampStroke(STAMPS.find((s) => s.id === stamp.id), at[0], at[1], stamp.size, stamp.angle, aspect, stamp.fill);

  const onDown = (e) => {
    if (e.button === 1 || (e.button === 0 && spaceDown.current)) {
      e.preventDefault();
      svg.current.setPointerCapture(e.pointerId);
      drag.current = { pan: true, x: e.clientX, y: e.clientY, cx, cy, scale: svg.current.getScreenCTM().a };
      return;
    }
    if (e.button !== 0) return;
    svg.current.setPointerCapture(e.pointerId);
    const p = toTile(e);
    if (tool === 'pen') {
      drag.current = { pts: [seamSnap(p)] };
      drawLivePen(drag.current.pts);
    } else if (tool === 'circle') drag.current = { c: snapPt(p), r: 0 };
    else if (tool === 'square') drag.current = { s: snapPt(p) };
    else if (tool === 'dot') addStroke({ pts: circlePoints(aspect, ...snapPt(p), Math.max(0.04, swTile * 0.9), 18), closed: true, fill: true });
    else if (tool === 'stamp') addStroke(currentStamp(snapPt(p)));
    else if (tool === 'eraser') erase(p);
    else if (tool === 'move') {
      const i = hitIndex(p);
      let next = sel;
      if (i < 0) next = new Set();
      else if (e.shiftKey) (next = new Set(sel)), next.has(i) ? next.delete(i) : next.add(i);
      else if (!sel.has(i)) next = new Set([i]);
      setSel(next);
      if (i >= 0 && next.size) drag.current = { move: true, start: p, orig: strokes, sel: next, moved: false, symOn };
    } else if (tool === 'line') {
      let q = seamSnap(snapPt(p));
      if (e.shiftKey && live?.pts.length) q = constrain(live.pts[live.pts.length - 1], q, aspect);
      if (live?.pts.length > 2 && Math.hypot(q[0] - live.pts[0][0], q[1] - live.pts[0][1]) < 0.04) {
        addStroke({ pts: live.pts, closed: true });
        setLive(null);
      } else setLive({ pts: [...(live?.pts || []), q] });
    }
  };
  const squarePts = (s, p, free) => {
    let dx = (p[0] - s[0]) * aspect, dy = p[1] - s[1];
    if (!free) {
      const side = Math.max(Math.abs(dx), Math.abs(dy));
      dx = Math.sign(dx || 1) * side;
      dy = Math.sign(dy || 1) * side;
    }
    const x1 = s[0] + dx / aspect, y1 = clamp(s[1] + dy, 0, 1);
    return [[s[0], s[1]], [x1, s[1]], [x1, y1], [s[0], y1]];
  };
  const onMove = (e) => {
    const d = drag.current;
    if (d?.pan) {
      setView((v) => ({ ...v, cx: d.cx - (e.clientX - d.x) / d.scale, cy: d.cy - (e.clientY - d.y) / d.scale }));
      return;
    }
    const p = toTile(e);
    if (tool === 'pen' && d) {
      const last = d.pts[d.pts.length - 1];
      if (Math.hypot(p[0] - last[0], p[1] - last[1]) > 0.004) {
        d.pts.push(p);
        drawLivePen(d.pts);
      }
      return; // no React state while drawing: this is what keeps the pen smooth
    }
    let c = snapPt(p);
    if (tool === 'line' && e.shiftKey && live?.pts.length) c = constrain(live.pts[live.pts.length - 1], c, aspect);
    setCursor(c);
    if (!d) {
      if (tool === 'eraser' && e.buttons === 1) erase(p);
      return;
    }
    if (tool === 'circle') {
      const [ccx, ccy] = d.c;
      d.r = Math.hypot((p[0] - ccx) * aspect, p[1] - ccy);
      setLive({ pts: circlePoints(aspect, ccx, ccy, d.r, 40), closed: true });
    } else if (tool === 'square') {
      d.pts = squarePts(d.s, snapPt(p), e.shiftKey);
      setLive({ pts: d.pts, closed: true });
    } else if (d.move) {
      const delta = snapDelta([p[0] - d.start[0], p[1] - d.start[1]]);
      d.moved = delta[0] || delta[1];
      setHist((h) => ({ ...h, present: moveStrokes(d.orig, d.sel, delta, d.symOn) }));
    }
  };
  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.pan) return;
    if (tool === 'pen') {
      if (liveG.current) liveG.current.innerHTML = '';
      const raw = thinStroke(d.pts, 0.004);
      if (raw.length < 2) return;
      const shape = stead.on && stead.shapes ? recognise(raw, aspect) : null;
      if (shape) {
        setFlash(shape.kind === 'line' ? 'Straightened into a line' : `Cleaned up into a ${shape.kind}`);
        addStroke({ ...shape.stroke, pts: shape.stroke.closed ? shape.stroke.pts : shape.stroke.pts.map(seamSnap) });
        return;
      }
      let pts = stead.on ? steady(raw, stead.amt, aspect) : raw;
      pts = [seamSnap(pts[0]), ...pts.slice(1, -1), seamSnap(pts[pts.length - 1])];
      addStroke({ pts });
    } else if (tool === 'circle') {
      const r = snap ? Math.max(1 / GRID, Math.round(d.r * GRID) / GRID) : d.r;
      if (d.r > 0.02) addStroke({ pts: circlePoints(aspect, d.c[0], d.c[1], r, 40), closed: true });
      setLive(null);
    } else if (tool === 'square') {
      const pts = d.pts;
      if (pts && Math.abs(pts[1][0] - pts[0][0]) > 0.01 && Math.abs(pts[2][1] - pts[1][1]) > 0.01) addStroke({ pts, closed: true });
      setLive(null);
    } else if (d.move && d.moved) {
      setHist((h) => ({ past: [...h.past.slice(-80), d.orig], present: h.present, future: [] }));
      if (!d.symOn && [...d.sel].some((i) => d.orig[i]?.sym)) setFlash('Symmetry is off, so only this copy moved');
    }
  };
  const erase = (p) => {
    const hit = new Set();
    strokes.forEach((s, i) => distToStroke(p, s) <= swTile / 2 + 0.035 && hit.add(i));
    if (!hit.size) return;
    const gone = withPartners(strokes, hit, symOn);
    commit(strokes.filter((_, i) => !gone.has(i)));
    setSel(new Set());
    if (gone.size > hit.size) setFlash(`Erased ${gone.size} symmetric copies`);
  };
  const onWheel = (e) => {
    e.preventDefault();
    if (tool === 'stamp' && e.altKey) return setStamp((s) => ({ ...s, angle: (s.angle + (e.deltaY > 0 ? 15 : -15) + 360) % 360 }));
    if (e.ctrlKey || e.metaKey) {
      const p = svgPoint(e);
      setZoom(view.z * (e.deltaY < 0 ? 1.15 : 1 / 1.15), [p.x, p.y]);
    } else {
      const k = 1 / svg.current.getScreenCTM().a;
      pan((e.shiftKey ? e.deltaY : e.deltaX) * k, (e.shiftKey ? 0 : e.deltaY) * k);
    }
  };

  const deleteSel = () => {
    if (!sel.size) return;
    const gone = withPartners(strokes, sel, symOn);
    commit(strokes.filter((_, i) => !gone.has(i)));
    setSel(new Set());
  };
  const smoothSel = () => {
    if (!sel.size) return;
    const pick = withPartners(strokes, sel, symOn);
    commit(strokes.map((s, i) => (pick.has(i) && !s.fill && !s.closed ? { ...s, pts: steady(s.pts, Math.max(50, stead.amt), aspect) } : s)));
    setFlash('Smoothed');
  };
  const addGenerated = () => {
    const g = groupSeq++;
    commit([...strokes, ...generate(gen.kind, gen, aspect).map((s) => ({ ...s, g, t: I }))]);
    setFlash(`${GENERATORS.find((x) => x.id === gen.kind).name} added. Move it as one piece with the move tool`);
  };

  // Keyboard: tools, undo, view, stamps, and a grid cursor for drawing without a mouse.
  const onKey = (e) => {
    if (e.target.closest('input, select, textarea')) return;
    const k = e.key.toLowerCase();
    if (e.key === ' ') spaceDown.current = true;
    if ((e.ctrlKey || e.metaKey) && k === 'z') return e.preventDefault(), e.shiftKey ? redo() : undo();
    if ((e.ctrlKey || e.metaKey) && k === 'y') return e.preventDefault(), redo();
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const t = TOOLS.find((x) => x.key.toLowerCase() === k);
    if (t) return pickTool(t.id);
    if (k === 'm') {
      const i = SYMMETRY.findIndex((s) => s.id === sym);
      return setSym(SYMMETRY[(i + 1) % SYMMETRY.length].id);
    }
    if (k === 'g') return setShowGrid(!showGrid);
    if (k === 'n') return setSnap(!snap);
    if (k === 'b') return setStead({ ...stead, on: !stead.on });
    if (k === ',' || k === '.') return setStamp((s) => ({ ...s, angle: (s.angle + (k === '.' ? 15 : -15) + 360) % 360 }));
    if (k === '[' || k === ']') return setStamp((s) => ({ ...s, size: clamp(+(s.size + (k === ']' ? 0.05 : -0.05)).toFixed(2), 0.1, 0.9) }));
    if (k === '+' || k === '=') return setZoom(view.z * 1.25);
    if (k === '-' || k === '_') return setZoom(view.z / 1.25);
    if (k === '0') return setZoom(1);
    if ((k === 'delete' || k === 'backspace') && sel.size) return e.preventDefault(), deleteSel();
  };
  const onKeyUp = (e) => e.key === ' ' && (spaceDown.current = false);
  const onCanvasKey = (e) => {
    const step = { arrowleft: [-1, 0], arrowright: [1, 0], arrowup: [0, -1], arrowdown: [0, 1] }[e.key.toLowerCase()];
    if (step) {
      e.preventDefault();
      e.stopPropagation();
      const d = [step[0] / (GRID * aspect), step[1] / GRID];
      if (tool === 'move' && sel.size) return commit(moveStrokes(strokes, sel, d, symOn));
      const c = cursor || [0.5, 0.5];
      setCursor([clamp(c[0] + d[0], 0, 1), clamp(c[1] + d[1], 0, 1)]);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const c = cursor || [0.5, 0.5];
      if (tool === 'dot' || tool === 'circle') addStroke({ pts: circlePoints(aspect, c[0], c[1], tool === 'dot' ? Math.max(0.04, swTile * 0.9) : 0.2, 32), closed: true, fill: tool === 'dot' });
      else if (tool === 'square') addStroke({ pts: squarePts(c, [c[0] + 0.2 / aspect, c[1] + 0.2], false), closed: true });
      else if (tool === 'stamp') addStroke(currentStamp(c));
      else {
        if (tool !== 'line') setTool('line');
        setLive({ pts: [...(live?.pts || []), c] });
      }
    } else if (e.key === 'Escape' && (live || sel.size)) {
      e.preventDefault();
      e.stopPropagation();
      if (live) finishLine();
      else setSel(new Set());
    }
  };

  const close = () => store.set({ editor: null });
  const save = () => {
    if (!strokes.length) return toast('Draw something first');
    const b = editor.base;
    const id = b?.custom ? b.id : `custom-${Date.now()}`;
    const p = { ...draft, id, name: name.trim() || 'My pattern', strokes: copyStrokes(strokes) };
    saveCustomPattern(p);
    if (zone === 'middle' && hasMiddle(design.layout)) setPattern('middle', id);
    if (zone === 'side' && hasSides(design.layout)) setPattern(design.linked ? 'sideL' : store.get().activeSide, id);
    close();
    toast(`“${p.name}” saved to My patterns`);
  };
  const remix = () => {
    const src = patternById(zone === 'middle' ? design.patterns.middle : design.patterns[design.linked ? 'sideL' : store.get().activeSide]);
    if (!src) return toast('That zone is plain. Pick a pattern first');
    setAspect(src.aspect);
    setLw(Math.max(minLw, +lineWidthMM(src, zh).toFixed(2)));
    commit(loadStrokes(src.strokes));
    if (!name || name.startsWith('My pattern')) setName(`${src.name} remix`);
  };

  // Making the zone bigger is the only real way to get finer-looking lines.
  const grow = (() => {
    const L = design.layout, s = getSplit(design);
    if (zone === 'middle' && (L === 'trio' || L === 'center') && s > 0.06) return { label: 'Widen the middle', run: () => setDesign(splitPatch(design, s - 0.04)) };
    if (zone === 'side' && (L === 'trio' || L === 'rails') && s < 0.42) return { label: 'Widen the sides', run: () => setDesign(splitPatch(design, s + 0.04)) };
    if (design.width < 12) return { label: 'Widen the band by 1 mm', run: () => setDesign({ width: Math.min(12, design.width + 1) }) };
    return null;
  })();

  // ── Bend shading: where the profile curves away and where the pattern fades at the rim ──
  const bends = useMemo(() => {
    const rows = [];
    const rim = rimFade(preview.width);
    const N = 32;
    let peak = { b: 0, y: 0 };
    for (let k = 0; k < N; k++) {
      const y = (k + 0.5) / N;
      const v = zoneBox.from + y * (zoneBox.to - zoneBox.from);
      const b = bendAt(preview.profile, 2 * v - 1);
      const r = v < rim || v > 1 - rim;
      rows.push({ y0: k / N, y1: (k + 1) / N, b, r });
      if (b > peak.b) peak = { b, y };
    }
    return { rows, peak };
  }, [preview.profile, preview.width, zoneBox.from, zoneBox.to]);

  // ── Rendering ──
  const selGroups = new Set([...sel].map((i) => strokes[i]).filter((s) => linkedTo(s, symOn)).map((s) => s.g));
  const drawn = (list, extra = '', withSel = false) =>
    list.map((s, i) => html`<path d=${pathD(s.pts, TW, TH, s.closed)} stroke-width=${swTile * TH} fill=${s.fill ? 'currentColor' : 'none'}
      class=${'ed-stroke ' + extra + (withSel && sel.has(i) ? ' sel' : withSel && s.g && selGroups.has(s.g) ? ' twin' : '')} />`);
  const liveStrokes = live ? mats.map((m) => ({ ...live, pts: live.pts.map((p) => applyM(m, p)) })) : [];
  const ghostStamp = tool === 'stamp' && cursor ? mats.map((m) => { const s = currentStamp(cursor); return { ...s, pts: s.pts.map((p) => applyM(m, p)) }; }) : [];
  const cols = Math.round(GRID * aspect);
  const ratio = lineMM / zh;
  const lineNote =
    lw <= MIN_LINE_MM + 1e-6
      ? { level: 'warn', text: `${MIN_LINE_MM.toFixed(2)} mm is the thinnest line any process can make.${lw < mat.minDetail ? ` ${mat.name} needs ${mat.minDetail} mm, so it may not print.` : ''}` }
      : lw >= MAX_LINE_MM - 1e-6
        ? { level: 'info', text: `${MAX_LINE_MM} mm is the heaviest line. For bolder shapes, use a filled stamp or dot.` }
        : lineMM < mat.minDetail
          ? { level: 'warn', text: `${lineMM.toFixed(2)} mm is below the ${mat.minDetail} mm ${mat.name} can resolve. Fine details may not come out.` }
          : { level: 'ok', text: `${lineMM.toFixed(2)} mm lines print cleanly in ${mat.name} (limit ${mat.minDetail} mm).` };
  const symAxes = {
    mx: [[TW / 2, -6, TW / 2, TH + 6]],
    my: [[-6, TH / 2, TW + 6, TH / 2]],
    mxy: [[TW / 2, -6, TW / 2, TH + 6], [-6, TH / 2, TW + 6, TH / 2]],
    kal: [[TW / 2, -6, TW / 2, TH + 6], [-6, TH / 2, TW + 6, TH / 2], [0, 0, TW, TH], [TW, 0, 0, TH]],
  }[sym] || [];

  return html`<${Modal} open=${open} onClose=${close} title="Pattern editor" className="editor-modal" wide>
    <div class="editor" onKeyDown=${onKey} onKeyUp=${onKeyUp}>
      <div class="ed-top">
        <label class="field inline">Name
          <input value=${name} onInput=${(e) => setName(e.currentTarget.value)} maxlength="32" />
        </label>
        <${Segmented} label="Where this pattern goes" value=${zone} onChange=${setZone}
          options=${[{ value: 'middle', label: 'Middle' }, { value: 'side', label: 'Sides' }]} />
        <button class="btn ghost sm ed-remix" onClick=${remix} aria-label="Remix current pattern" title="Remix current"><${Icon} name="copy" size=${14} /> <span>Remix current</span></button>
        <button class="icon-btn" onClick=${() => startTour('editor')} aria-label="Editor tour" title="Editor tour"><${Icon} name="help" /></button>
        <div class="spacer"></div>
        <button class="btn ghost ed-cancel" onClick=${close}>Cancel</button>
        <button class="btn primary ed-save" onClick=${save} disabled=${!strokes.length}><${Icon} name="check" size=${16} /> Save<span class="ed-save-more"> & apply</span></button>
      </div>

      <div class="ed-body">
        <div class="ed-tools" role="toolbar" aria-label="Drawing tools">
          <div class="ed-tool-row">${TOOLS.map(
            (t) => html`<button class=${'tool' + (tool === t.id ? ' on' : '')} aria-pressed=${tool === t.id}
              onClick=${() => pickTool(t.id, true)} title=${`${t.label} (${t.key})`}>
              <${Icon} name=${t.icon} /><span>${t.label}</span><kbd class="tool-key">${t.key}</kbd>
            </button>`
          )}</div>
          <hr />
          <div class="ed-sym" role="radiogroup" aria-label="Symmetry">
            <span class="field-label">Symmetry <kbd>M</kbd></span>
            ${SYMMETRY.map(
              (s) => html`<button role="radio" aria-checked=${sym === s.id} class=${'sym-btn' + (sym === s.id ? ' on' : '')} title=${s.hint} onClick=${() => setSym(s.id)}>
                <${SymIcon} id=${s.id} /><span>${s.name}</span>
              </button>`
            )}
          </div>
          <hr />
          <div class="ed-edit-row">
          <button class="tool" onClick=${undo} disabled=${!hist.past.length} aria-label="Undo" title="Undo (Ctrl+Z)"><${Icon} name="undo" /><span>Undo</span></button>
          <button class="tool" onClick=${redo} disabled=${!hist.future.length} aria-label="Redo" title="Redo (Ctrl+Shift+Z)"><${Icon} name="redo" /><span>Redo</span></button>
          <button class="tool" onClick=${() => (commit([]), setSel(new Set()))} disabled=${!strokes.length} aria-label="Clear the tile" title="Clear"><${Icon} name="trash" /><span>Clear</span></button>
          </div>
        </div>

        <div class="ed-canvas-wrap">
          <div class="ed-view" role="toolbar" aria-label="View">
            <button class="icon-btn sm" onClick=${() => setZoom(view.z / 1.25)} disabled=${view.z <= ZOOM_MIN} aria-label="Zoom out" title="Zoom out (−)"><${Icon} name="minus" size=${16} /></button>
            <span class="ed-zoom" aria-live="polite">${Math.round(view.z * 100)}%</span>
            <button class="icon-btn sm" onClick=${() => setZoom(view.z * 1.25)} disabled=${view.z >= ZOOM_MAX} aria-label="Zoom in" title="Zoom in (+)"><${Icon} name="plus" size=${16} /></button>
            <button class="icon-btn sm" onClick=${() => setZoom(1)} aria-label="Fit tile" title="Fit (0)"><${Icon} name="fit" size=${16} /></button>
            <span class="ed-sep"></span>
            <button class=${'chip sm' + (showGrid ? ' on' : '')} aria-pressed=${showGrid} onClick=${() => setShowGrid(!showGrid)} title="Show grid (G)"><${Icon} name="grid" size=${14} /> Grid</button>
            <button class=${'chip sm' + (snap ? ' on' : '')} aria-pressed=${snap} onClick=${() => setSnap(!snap)} title="Snap to grid and seams (N)">Snap</button>
            <button class=${'chip sm' + (showBends ? ' on' : '')} aria-pressed=${showBends} onClick=${() => setShowBends(!showBends)} title="Show where the band bends">Bends</button>
            ${tool === 'move' && sel.size > 0 &&
            html`<span class="ed-sep"></span>
              <span class="ed-sel-count">${sel.size} selected</span>
              <button class="chip sm" onClick=${smoothSel}><${Icon} name="steady" size=${14} /> Smooth</button>
              <button class="chip sm" onClick=${deleteSel}><${Icon} name="trash" size=${14} /> Delete</button>`}
            <span class="spacer"></span>
            <span class="ed-hint">${tool === 'line' ? 'Shift locks 0° / 45° / 90°' : tool === 'square' ? 'Shift for a free rectangle' : tool === 'stamp' ? ', . rotate · [ ] size' : view.z > 1 ? 'Scroll or Space + drag to pan' : 'Ctrl + scroll to zoom'}</span>
          </div>
          <svg ref=${svg} class=${'ed-canvas tool-' + tool + (view.z > 1 ? ' zoomed' : '')} viewBox=${`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
            tabindex="0" role="application" aria-label=${`Drawing canvas, one tile. ${strokes.length} strokes. Arrow keys move the cursor, Enter places a point, Escape finishes a line.`}
            onPointerDown=${onDown} onPointerMove=${onMove} onPointerUp=${onUp} onPointerLeave=${() => setCursor(null)}
            onDblClick=${() => tool === 'line' && finishLine()} onKeyDown=${onCanvasKey} onWheel=${onWheel}
            onContextMenu=${(e) => e.preventDefault()}>
            <defs>
              <pattern id="ed-minor" width=${TH / GRID} height=${TH / GRID} patternUnits="userSpaceOnUse">
                <path d=${`M ${TH / GRID} 0 L 0 0 0 ${TH / GRID}`} class="ed-bg-grid" />
              </pattern>
              <pattern id="ed-hatch" width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <line x1="0" y1="0" x2="0" y2="3" class="ed-hatch-line" />
              </pattern>
            </defs>
            ${showGrid && html`<rect x=${base.x - 400} y=${base.y - 400} width=${base.w + 800} height=${base.h + 800} fill="url(#ed-minor)" />`}
            <g class="ed-ghost" transform=${`translate(${-TW} 0)`}>${drawn(strokes)}</g>
            <g class="ed-ghost" transform=${`translate(${TW} 0)`}>${drawn(strokes)}</g>
            <rect class="ed-tile" x="0" y="0" width=${TW} height=${TH} />
            ${showBends &&
            html`<g class="ed-bends" aria-hidden="true">
              ${bends.rows.map((r) => r.b > 0.01 && html`<rect x=${-TW} width=${TW * 3} y=${r.y0 * TH} height=${(r.y1 - r.y0) * TH + 0.2} class="ed-bend" style=${`opacity:${Math.min(0.55, r.b * 1.6)}`} />`)}
              ${bends.rows.map((r) => r.r && html`<rect x=${-TW} width=${TW * 3} y=${r.y0 * TH} height=${(r.y1 - r.y0) * TH + 0.2} fill="url(#ed-hatch)" />`)}
              ${bends.peak.b > 0.04 && html`<text class="ed-bend-label" x=${TW / 2} y=${clamp(bends.peak.y * TH, 6, TH - 3)}>${preview.profile === 'bevel' ? 'bevel: the pattern bends here' : 'curves away from view'}</text>`}
              ${bends.rows.some((r) => r.r) && html`<text class="ed-bend-label rim" x=${TW / 2} y=${bends.rows[0].r ? 5 : TH - 2}>rim: pattern fades out</text>`}
            </g>`}
            ${showGrid &&
            html`<g class="ed-grid">
              ${Array.from({ length: GRID - 1 }, (_, i) => html`<line x1="0" x2=${TW} y1=${((i + 1) * TH) / GRID} y2=${((i + 1) * TH) / GRID} class=${(i + 1) % 3 ? '' : 'major'} />`)}
              ${Array.from({ length: cols - 1 }, (_, i) => html`<line y1="0" y2=${TH} x1=${((i + 1) * TW) / cols} x2=${((i + 1) * TW) / cols} class=${(i + 1) % 3 ? '' : 'major'} />`)}
            </g>`}
            ${symAxes.map(([x1, y1, x2, y2]) => html`<line class="ed-axis" x1=${x1} y1=${y1} x2=${x2} y2=${y2} />`)}
            ${sym === 'rot' && html`<circle class="ed-axis-dot" cx=${TW / 2} cy=${TH / 2} r="1.6" />`}
            <g class="ed-main">${drawn(strokes, '', true)}${drawn(liveStrokes, 'live')}${drawn(ghostStamp, 'ghost-stamp')}</g>
            <g ref=${liveG}></g>
            ${seam.map((g) => html`<g class=${'ed-seam' + (g.matched ? ' ok' : '')}>
              <circle cx=${g.x * TW} cy=${g.y * TH} r="2.6" />
              ${!g.matched && html`<text x=${g.x * TW + (g.x ? -4 : 4)} y=${g.y * TH - 4} class=${g.x ? 'r' : ''}>continue here</text>`}
            </g>`)}
            ${live && tool === 'line' && cursor &&
            html`<line class="ed-rubber" x1=${live.pts[live.pts.length - 1][0] * TW} y1=${live.pts[live.pts.length - 1][1] * TH} x2=${cursor[0] * TW} y2=${cursor[1] * TH} />`}
            ${cursor && tool !== 'stamp' && html`<circle class="ed-cursor" cx=${cursor[0] * TW} cy=${cursor[1] * TH} r=${2.2 / view.z} />`}
            ${zone === 'side' && html`<text class="ed-edge" x=${TW / 2} y="-5">ring edge</text>`}
            ${!narrow && html`<text class="ed-tile-label" x=${-TW / 2} y=${TH + pad + 6}>repeats</text>
            <text class="ed-tile-label" x=${TW * 1.5} y=${TH + pad + 6}>repeats</text>`}
            <g class="ed-dims">
              <line x1="0" x2=${TW} y1=${TH + 8} y2=${TH + 8} /><line x1="0" x2="0" y1=${TH + 5} y2=${TH + 11} /><line x1=${TW} x2=${TW} y1=${TH + 5} y2=${TH + 11} />
              <text x=${TW / 2} y=${TH + 15}>${tileW.toFixed(2)} mm</text>
              <line x1=${TW + 8} x2=${TW + 8} y1="0" y2=${TH} /><line x1=${TW + 5} x2=${TW + 11} y1="0" y2="0" /><line x1=${TW + 5} x2=${TW + 11} y1=${TH} y2=${TH} />
              <text x=${TW + 12} y=${TH / 2} transform=${`rotate(90 ${TW + 12} ${TH / 2})`}>${zh.toFixed(2)} mm</text>
            </g>
          </svg>
          ${!strokes.length && !live && html`<p class="ed-empty">Draw <strong>one tile</strong>, or start from a stamp or the Generate tab. It repeats around the whole ring.</p>`}
          <div class="ed-status" aria-live="polite">
            <span class="ed-xy">X ${cursor ? (cursor[0] * tileW).toFixed(2) : '—'} mm</span>
            <span class="ed-xy">Y ${cursor ? (cursor[1] * zh).toFixed(2) : '—'} mm</span>
            <span>Tile ${tileW.toFixed(2)} × ${zh.toFixed(2)} mm</span>
            <span>${strokes.length} stroke${strokes.length === 1 ? '' : 's'}</span>
            ${flash && html`<span class="ed-flash"><${Icon} name="check" size=${12} /> ${flash}</span>`}
          </div>

          <div class="ed-panel">
            <div class="ed-tabs" role="tablist" aria-label="Editor options">
              ${TABS.map((t) => html`<button role="tab" aria-selected=${tab === t.id} class=${tab === t.id ? 'on' : ''} onClick=${() => setTab(t.id)}>${t.label}</button>`)}
            </div>
            ${tab === 'line' &&
            html`<div class="ed-tab-body two">
              <div class="ed-weight">
                <${Slider} label="Line weight" value=${lw} min=${MIN_LINE_MM} max=${MAX_LINE_MM} step=${0.05} unit="mm" format=${(v) => `${v.toFixed(2)} mm`}
                  onInput=${(v) => setLw(+v.toFixed(2))} />
                <p class=${'detail-note ' + lineNote.level} role="status">
                  <${Icon} name=${lineNote.level === 'ok' ? 'check' : lineNote.level === 'info' ? 'info' : 'alert'} size=${14} /> ${lineNote.text}
                </p>
                ${ratio > 0.08 && grow &&
                html`<div class="ed-grow">
                  <p>Lines are ${Math.round(ratio * 100)}% of this ${zh.toFixed(1)} mm zone, so they look bold. Printing sets the minimum, so a bigger zone is the way to a finer look.</p>
                  <button class="btn ghost sm" onClick=${grow.run}><${Icon} name="plus" size=${14} /> ${grow.label}</button>
                </div>`}
              </div>
              <div>
                <${Slider} label="Tile proportion" value=${aspect} min=${0.4} max=${2} step=${0.05} unit="" format=${(v) => `${v.toFixed(2)} : 1`} onInput=${setAspect} />
                <p class="hint">Wider tiles mean fewer repeats around the ring.</p>
              </div>
            </div>`}
            ${tab === 'steady' &&
            html`<div class="ed-tab-body two ed-steady">
              <div>
                <div class="ed-steady-head">
                  <span class="field-label">Steady</span>
                  <button class=${'chip sm' + (stead.on ? ' on' : '')} aria-pressed=${stead.on} onClick=${() => setStead({ ...stead, on: !stead.on })} title="Steady (B)">
                    <${Icon} name="steady" size=${14} /> ${stead.on ? 'On' : 'Off'}
                  </button>
                </div>
                <${Slider} label="Smoothing" value=${stead.amt} min=${0} max=${100} step=${5} unit="%" format=${(v) => `${v}%`}
                  onInput=${(v) => setStead({ ...stead, on: true, amt: v })} />
                <p class="hint">Applied when you lift the pen, so drawing never lags. 30% keeps character, 80% gives calm, flowing curves.</p>
              </div>
              <div>
                <label class="check-row"><input type="checkbox" checked=${stead.shapes} onChange=${() => setStead({ ...stead, shapes: !stead.shapes })} />
                  <span><strong>Recognise shapes</strong><br />A wobbly straight line becomes a clean line; a rough loop becomes a circle or ellipse.</span></label>
              </div>
            </div>`}
            ${tab === 'stamps' &&
            html`<div class="ed-tab-body">
              <div class="stamp-grid" role="radiogroup" aria-label="Stamp shape">
                ${STAMPS.map((s) => {
                  const pr = stampStroke(s, 0.5, 0.5, 0.8, 0, 1, stamp.fill);
                  return html`<button role="radio" aria-checked=${stamp.id === s.id} class=${'stamp-btn' + (stamp.id === s.id ? ' on' : '')}
                    onClick=${() => (setStamp({ ...stamp, id: s.id }), tool !== 'stamp' && pickTool('stamp'))} title=${s.name}>
                    <svg viewBox="0 0 100 100" aria-hidden="true"><path d=${pathD(pr.pts, 100, 100, pr.closed)} fill=${pr.fill ? 'currentColor' : 'none'} /></svg>
                    <span>${s.name}</span>
                  </button>`;
                })}
              </div>
              <div class="ed-tab-body two tight">
                <${Slider} label="Size" value=${stamp.size} min=${0.1} max=${0.9} step=${0.05} unit="" format=${(v) => `${(v * zh).toFixed(2)} mm`} onInput=${(v) => setStamp({ ...stamp, size: v })} />
                <${Slider} label="Angle" value=${stamp.angle} min=${0} max=${345} step=${15} unit="°" onInput=${(v) => setStamp({ ...stamp, angle: v })} />
              </div>
              <label class="check-row"><input type="checkbox" checked=${stamp.fill} onChange=${() => setStamp({ ...stamp, fill: !stamp.fill })} /> Filled (solid relief instead of an outline)</label>
            </div>`}
            ${tab === 'generate' &&
            html`<div class="ed-tab-body">
              <${Segmented} label="Base pattern" size="full" value=${gen.kind} onChange=${(v) => setGen({ ...gen, kind: v })}
                options=${GENERATORS.map((g) => ({ value: g.id, label: g.name }))} />
              <div class="ed-tab-body two tight">
                <${Slider} label="Repeats per tile" value=${gen.cycles} min=${1} max=${4} step=${1} unit="" onInput=${(v) => setGen({ ...gen, cycles: v })} />
                <${Slider} label="Height" value=${gen.amp} min=${0.05} max=${0.45} step=${0.01} unit="" format=${(v) => `${Math.round(v * 200)}%`} onInput=${(v) => setGen({ ...gen, amp: v })} />
              </div>
              <div class="ed-gen-actions">
                <label class="check-row"><input type="checkbox" checked=${gen.double} onChange=${() => setGen({ ...gen, double: !gen.double })} /> Add an offset copy (makes lattices and chains)</label>
                <span class="spacer"></span>
                <button class="btn primary sm" onClick=${addGenerated}><${Icon} name="plus" size=${14} /> Add to tile</button>
              </div>
              <p class="hint">Generated shapes always join seamlessly with the next tile. Decorate them with stamps or the pen.</p>
            </div>`}
          </div>
        </div>

        <div class="ed-preview">
          <span class="field-label">Live on your ring</span>
          <${Pure} a=${preview} b=${draft} render=${() => html`<${RingView} design=${preview} getPattern=${getP} mode="studio" className="ed-ring" />`} />
          <${Pure} a=${preview} b=${draft} z=${zone} render=${() => html`<${BandMap} design=${preview} getPattern=${getP} activeZones=${zone === 'middle' ? ['middle'] : ['sideL', 'sideR']} />`} />
          <p class="hint">The ring updates when you lift the pen.<span class="keys-only"> Press <kbd>?</kbd> for every shortcut.</span></p>
        </div>
      </div>
    </div>
  <//>`;
}

function SymIcon({ id }) {
  const leaf = 'M6 7c2-4 6-4 7-1';
  const copies = {
    none: [''],
    mx: ['', 'matrix(-1 0 0 1 24 0)'],
    my: ['', 'matrix(1 0 0 -1 0 24)'],
    mxy: ['', 'matrix(-1 0 0 1 24 0)', 'matrix(1 0 0 -1 0 24)', 'matrix(-1 0 0 -1 24 24)'],
    rot: ['', 'matrix(-1 0 0 -1 24 24)'],
    kal: ['', 'matrix(-1 0 0 1 24 0)', 'matrix(1 0 0 -1 0 24)', 'matrix(-1 0 0 -1 24 24)', 'matrix(0 1 1 0 0 0)', 'matrix(0 -1 1 0 0 24)', 'matrix(0 1 -1 0 24 0)', 'matrix(0 -1 -1 0 24 24)'],
  }[id];
  return html`<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" class="sym-ico">
    <rect x="2" y="2" width="20" height="20" rx="3" fill="none" stroke="currentColor" stroke-width="1" opacity=".35" />
    ${copies.map((t, k) => html`<path d=${leaf} transform=${t} fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" opacity=${k ? 0.55 : 1} />`)}
  </svg>`;
}
