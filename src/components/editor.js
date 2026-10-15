// Pattern editor: draw one tile, mirror it, watch it wrap around the ring live.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { html } from '../lib/html.js';
import { Icon, Modal, Segmented, Slider } from './ui.js';
import { RingView } from './ring-view.js';
import { BandMap } from './pattern-art.js';
import { smoothStroke, thinStroke, circlePoints } from '../lib/patterns.js';
import { hasMiddle, hasSides } from '../lib/templates.js';
import { resolveZones, lineWidthMM, MIN_LINE_MM } from '../lib/band.js';
import { getMaterial } from '../lib/materials.js';
import { store, patternById, saveCustomPattern, setPattern, toast, showTip, startTour, tourDone } from '../state.js';

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
  { id: 'move', icon: 'move', label: 'Move', key: 'V' },
  { id: 'eraser', icon: 'eraser', label: 'Eraser', key: 'E' },
];

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const copyStrokes = (list) => list.map((s) => ({ ...s, pts: s.pts.map((p) => [...p]) }));
let groupSeq = 1;

// Mirror copies remember their group and how they were flipped, so moving one moves its twins.
function mirrored(stroke, mx, my) {
  const g = groupSeq++;
  const out = [{ ...stroke, g, t: 'i' }];
  const map = (f, t) => ({ ...stroke, g, t, pts: stroke.pts.map(f) });
  if (mx) out.push(map(([x, y]) => [1 - x, y], 'x'));
  if (my) out.push(map(([x, y]) => [x, 1 - y], 'y'));
  if (mx && my) out.push(map(([x, y]) => [1 - x, 1 - y], 'xy'));
  return out;
}
const flip = ([dx, dy], t = 'i') => [t.includes('x') ? -dx : dx, t.includes('y') ? -dy : dy];

function moveStrokes(strokes, sel, delta) {
  const out = strokes.slice();
  const doneGroups = new Set();
  const shift = (s, [dx, dy]) => ({ ...s, pts: s.pts.map(([x, y]) => [x + dx, y + dy]) });
  for (const i of sel) {
    const s = strokes[i];
    if (!s) continue;
    if (s.g) {
      if (doneGroups.has(s.g)) continue;
      doneGroups.add(s.g);
      const base = flip(delta, s.t);
      strokes.forEach((o, j) => o.g === s.g && (out[j] = shift(o, flip(base, o.t))));
    } else out[i] = shift(s, delta);
  }
  return out;
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
    // Inside a filled shape counts as a hit.
    let inside = false;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const [xi, yi] = s.pts[i], [xj, yj] = s.pts[j];
      if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
    }
    if (inside) return 0;
  }
  return best;
}

// Steady: resample evenly, then relax each point toward its neighbours. Runs after the stroke ends.
function resample(pts, step = 0.008) {
  if (pts.length < 2) return pts;
  const out = [pts[0]];
  let carry = 0;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    const len = Math.hypot(x1 - x0, y1 - y0);
    let d = step - carry;
    while (d <= len) {
      const t = d / len;
      out.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t]);
      d += step;
    }
    carry = len - (d - step);
  }
  out.push(pts[pts.length - 1]);
  return out;
}
export function steadyStroke(pts, amount, closed = false) {
  if (pts.length < 3 || amount <= 0) return pts;
  let p = resample(pts);
  const iters = Math.round((amount / 100) * 24);
  for (let k = 0; k < iters; k++) {
    const n = p.length;
    p = p.map((pt, i) => {
      if (!closed && (i === 0 || i === n - 1)) return pt;
      const a = p[(i - 1 + n) % n], b = p[(i + 1) % n];
      return [pt[0] * 0.5 + (a[0] + b[0]) * 0.25, pt[1] * 0.5 + (a[1] + b[1]) * 0.25];
    });
  }
  return thinStroke(p, 0.01);
}

export function PatternEditor() {
  const editor = store.use((s) => s.editor);
  const design = store.use((s) => s.design);
  const open = !!editor;

  const [zone, setZone] = useState('middle');
  const [name, setName] = useState('');
  const [aspect, setAspect] = useState(1);
  const [lw, setLw] = useState(0.45);
  const [tool, setTool] = useState('pen');
  const [mx, setMx] = useState(true);
  const [my, setMy] = useState(false);
  const [snap, setSnap] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [steady, setSteady] = useState({ on: true, amt: 45 });
  const [hist, setHist] = useState({ past: [], present: [], future: [] });
  const [live, setLive] = useState(null);
  const [cursor, setCursor] = useState(null);
  const [sel, setSel] = useState(new Set());
  const [view, setView] = useState({ z: 1, cx: null, cy: null });
  const svg = useRef();
  const drag = useRef(null);
  const toolClicks = useRef(0);
  const spaceDown = useRef(false);

  // (Re)initialise whenever the editor opens.
  useEffect(() => {
    if (!editor) return;
    const base = editor.base;
    const z = base ? (base.zone === 'side' ? 'side' : 'middle') : editor.zone || 'middle';
    setZone(z);
    setName(base?.custom ? base.name : base ? `${base.name} remix` : `My pattern ${store.get().customPatterns.length + 1}`);
    setAspect(base?.aspect ?? 1);
    setLw(base?.lw ?? 0.45);
    setHist({ past: [], present: base ? copyStrokes(base.strokes) : [], future: [] });
    setLive(null);
    setSel(new Set());
    setTool('pen');
    setView({ z: 1, cx: null, cy: null });
    toolClicks.current = 0;
    if (!tourDone('editor')) setTimeout(() => startTour('editor'), 500);
  }, [editor]);

  const strokes = hist.present;
  const commit = (next) => setHist((h) => ({ past: [...h.past.slice(-80), h.present], present: next, future: [] }));
  const undo = () => setHist((h) => (h.past.length ? { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] } : h));
  const redo = () => setHist((h) => (h.future.length ? { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) } : h));
  const addStroke = (s) => commit([...strokes, ...mirrored(s, mx, my)]);

  // Draft pattern & preview design.
  const zhFor = (pv) => resolveZones(pv, (id) => (id === DRAFT ? { aspect, sw: 0.1, strokes: [] } : patternById(id))).find((z) => design.patterns && (z.id === 'middle' ? zone === 'middle' : zone === 'side'))?.heightMM;
  const preview = useMemo(() => {
    let layout = design.layout;
    if (zone === 'middle' && !hasMiddle(layout)) layout = 'trio';
    if (zone === 'side' && !hasSides(layout)) layout = 'trio';
    const patterns = { ...design.patterns };
    if (zone === 'middle') patterns.middle = DRAFT;
    else patterns.sideL = patterns.sideR = DRAFT;
    return { ...design, layout, patterns, repeats: { middle: 0, side: 0 } };
  }, [design, zone]);
  const zh = zhFor(preview) || design.width;
  const draft = useMemo(
    () => ({ id: DRAFT, name: name || 'Draft', zone: zone === 'middle' ? 'middle' : 'side', tags: ['custom'], aspect, lw, sw: lw / zh, strokes: live ? [...strokes, ...mirrored(live, mx, my)] : strokes, custom: true }),
    [strokes, aspect, lw, zh, zone, name, live, mx, my]
  );
  const getP = (id) => (id === DRAFT ? draft : patternById(id));
  const lineMM = lineWidthMM(draft, zh);
  const swTile = lineMM / zh; // stroke width in tile units
  const mat = getMaterial(design.materialId);

  // ── View: zoom & pan ──
  const TW = aspect * 100, TH = 100, pad = 14;
  const base = { x: -TW - pad, y: -pad - 10, w: 3 * TW + 2 * pad, h: TH + 2 * pad + 20 };
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
  const hitIndex = (p) => {
    let best = -1, bd = Infinity;
    strokes.forEach((s, i) => {
      const d = distToStroke(p, s);
      if (d < bd) (bd = d), (best = i);
    });
    return bd <= swTile / 2 + 0.04 ? best : -1;
  };

  const finishLine = () => {
    if (live && live.pts.length > 1 && tool === 'line') addStroke({ pts: live.pts });
    setLive(null);
  };
  const pickTool = (id, fromClick) => {
    finishLine();
    setTool(id);
    if (id !== 'move') setSel(new Set());
    if (fromClick && ++toolClicks.current === 3)
      showTip('editor-keys', 'Tip: every tool has a one-key shortcut. P pen, L line, S square, C circle, D dot, V move, E eraser. Press ? for the full list.');
  };

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
    if (tool === 'pen') drag.current = { pts: [p] };
    else if (tool === 'circle') drag.current = { c: snapPt(p), r: 0 };
    else if (tool === 'square') drag.current = { s: snapPt(p) };
    else if (tool === 'dot') addStroke({ pts: circlePoints(aspect, ...snapPt(p), Math.max(0.04, swTile * 0.9), 18), closed: true, fill: true });
    else if (tool === 'eraser') erase(p);
    else if (tool === 'move') {
      const i = hitIndex(p);
      let next = sel;
      if (i < 0) next = new Set();
      else if (e.shiftKey) (next = new Set(sel)), next.has(i) ? next.delete(i) : next.add(i);
      else if (!sel.has(i)) next = new Set([i]);
      setSel(next);
      if (i >= 0 && next.size) drag.current = { move: true, start: p, orig: strokes, sel: next, moved: false };
    } else if (tool === 'line') {
      const q = snapPt(p);
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
    setCursor(snapPt(p));
    if (!d) {
      if (tool === 'eraser' && e.buttons === 1) erase(p);
      return;
    }
    if (tool === 'pen') {
      const last = d.pts[d.pts.length - 1];
      if (Math.hypot(p[0] - last[0], p[1] - last[1]) > 0.004) {
        d.pts.push(p);
        setLive({ pts: [...d.pts] });
      }
    } else if (tool === 'circle') {
      const [ccx, ccy] = d.c;
      d.r = Math.hypot((p[0] - ccx) * aspect, p[1] - ccy);
      setLive({ pts: circlePoints(aspect, ccx, ccy, d.r, 40), closed: true });
    } else if (tool === 'square') {
      d.pts = squarePts(d.s, snapPt(p), e.shiftKey);
      setLive({ pts: d.pts, closed: true });
    } else if (d.move) {
      const delta = snapDelta([p[0] - d.start[0], p[1] - d.start[1]]);
      d.moved = delta[0] || delta[1];
      setHist((h) => ({ ...h, present: moveStrokes(d.orig, d.sel, delta) }));
    }
  };
  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.pan) return;
    if (tool === 'pen') {
      let pts = thinStroke(d.pts, 0.006);
      if (pts.length > 1) {
        pts = steady.on ? smoothStroke(steadyStroke(pts, steady.amt), 1) : smoothStroke(pts, 1);
        addStroke({ pts });
      }
      setLive(null);
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
    }
  };
  const erase = (p) => {
    const keep = strokes.filter((s) => distToStroke(p, s) > swTile / 2 + 0.035);
    if (keep.length !== strokes.length) commit(keep), setSel(new Set());
  };
  const onWheel = (e) => {
    e.preventDefault();
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
    commit(strokes.filter((_, i) => !sel.has(i)));
    setSel(new Set());
  };
  const smoothSel = () => {
    if (!sel.size) return;
    commit(strokes.map((s, i) => (sel.has(i) && !s.fill ? { ...s, pts: steadyStroke(s.pts, Math.max(30, steady.amt), s.closed) } : s)));
  };

  // Keyboard: tools, undo, view, and a grid cursor for drawing without a mouse.
  const onKey = (e) => {
    if (e.target.closest('input, select, textarea')) return;
    const k = e.key.toLowerCase();
    if (e.key === ' ') spaceDown.current = true;
    if ((e.ctrlKey || e.metaKey) && k === 'z') return e.preventDefault(), e.shiftKey ? redo() : undo();
    if ((e.ctrlKey || e.metaKey) && k === 'y') return e.preventDefault(), redo();
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const t = TOOLS.find((x) => x.key.toLowerCase() === k);
    if (t) return pickTool(t.id);
    if (k === 'm') return e.shiftKey ? setMy(!my) : setMx(!mx);
    if (k === 'g') return setShowGrid(!showGrid);
    if (k === 'n') return setSnap(!snap);
    if (k === 'b') return setSteady({ ...steady, on: !steady.on });
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
      if (tool === 'move' && sel.size) return commit(moveStrokes(strokes, sel, d));
      const c = cursor || [0.5, 0.5];
      setCursor([clamp(c[0] + d[0], 0, 1), clamp(c[1] + d[1], 0, 1)]);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const c = cursor || [0.5, 0.5];
      if (tool === 'dot' || tool === 'circle') addStroke({ pts: circlePoints(aspect, c[0], c[1], tool === 'dot' ? Math.max(0.04, swTile * 0.9) : 0.2, 32), closed: true, fill: tool === 'dot' });
      else if (tool === 'square') addStroke({ pts: squarePts(c, [c[0] + 0.2 / aspect, c[1] + 0.2], false), closed: true });
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
    const p = { ...draft, id, name: name.trim() || 'My pattern', strokes: strokes.map(({ g, t, ...s }) => s) };
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
    setLw(+lineWidthMM(src, zh).toFixed(2));
    commit(copyStrokes(src.strokes));
    if (!name || name.startsWith('My pattern')) setName(`${src.name} remix`);
  };

  // ── Rendering ──
  const strokePath = (s) => s.pts.map(([x, y], i) => `${i ? 'L' : 'M'}${(x * TW).toFixed(2)} ${(y * TH).toFixed(2)}`).join('') + (s.closed ? 'Z' : '');
  const selGroups = new Set([...sel].map((i) => strokes[i]?.g).filter(Boolean));
  const drawn = (list, extra = '', withSel = false) =>
    list.map((s, i) => html`<path d=${strokePath(s)} stroke-width=${swTile * TH} fill=${s.fill ? 'currentColor' : 'none'}
      class=${'ed-stroke ' + extra + (withSel && sel.has(i) ? ' sel' : withSel && s.g && selGroups.has(s.g) ? ' twin' : '')} />`);
  const liveStrokes = live ? mirrored(live, mx, my) : [];
  const cols = Math.round(GRID * aspect);
  const tileW = aspect * zh;
  const lineNote =
    lw <= MIN_LINE_MM + 1e-6
      ? { level: 'warn', text: `${MIN_LINE_MM.toFixed(2)} mm is the thinnest line any process can make. ${lw < mat.minDetail ? `${mat.name} needs ${mat.minDetail} mm, so it may not print.` : ''}` }
      : lw >= MAX_LINE_MM - 1e-6
        ? { level: 'info', text: `${MAX_LINE_MM} mm is the heaviest line. For bolder shapes, draw a filled dot or a closed shape.` }
        : lineMM < mat.minDetail
          ? { level: 'warn', text: `${lineMM.toFixed(2)} mm is below the ${mat.minDetail} mm ${mat.name} can resolve. Fine details may not come out.` }
          : { level: 'ok', text: `${lineMM.toFixed(2)} mm lines print cleanly in ${mat.name} (limit ${mat.minDetail} mm).` };

  return html`<${Modal} open=${open} onClose=${close} title="Pattern editor" className="editor-modal" wide>
    <div class="editor" onKeyDown=${onKey} onKeyUp=${onKeyUp}>
      <div class="ed-top">
        <label class="field inline">Name
          <input value=${name} onInput=${(e) => setName(e.currentTarget.value)} maxlength="32" />
        </label>
        <${Segmented} label="Where this pattern goes" value=${zone} onChange=${setZone}
          options=${[{ value: 'middle', label: 'Middle' }, { value: 'side', label: 'Sides' }]} />
        <button class="btn ghost sm" onClick=${remix}><${Icon} name="copy" size=${14} /> Remix current</button>
        <button class="icon-btn" onClick=${() => startTour('editor')} aria-label="Editor tour" title="Editor tour"><${Icon} name="help" /></button>
        <div class="spacer"></div>
        <button class="btn ghost" onClick=${close}>Cancel</button>
        <button class="btn primary" onClick=${save} disabled=${!strokes.length}><${Icon} name="check" size=${16} /> Save & apply</button>
      </div>

      <div class="ed-body">
        <div class="ed-tools" role="toolbar" aria-label="Drawing tools">
          ${TOOLS.map(
            (t) => html`<button class=${'tool' + (tool === t.id ? ' on' : '')} aria-pressed=${tool === t.id}
              onClick=${() => pickTool(t.id, true)} title=${`${t.label} (${t.key})`}>
              <${Icon} name=${t.icon} /><span>${t.label}</span><kbd class="tool-key">${t.key}</kbd>
            </button>`
          )}
          <hr />
          <button class=${'tool' + (mx ? ' on' : '')} aria-pressed=${mx} onClick=${() => setMx(!mx)} title="Mirror left–right (M)"><${Icon} name="mirrorH" /><span>Mirror ↔</span></button>
          <button class=${'tool' + (my ? ' on' : '')} aria-pressed=${my} onClick=${() => setMy(!my)} title="Mirror top–bottom (Shift+M)"><${Icon} name="mirrorV" /><span>Mirror ↕</span></button>
          <hr />
          <button class="tool" onClick=${undo} disabled=${!hist.past.length} title="Undo (Ctrl+Z)"><${Icon} name="undo" /><span>Undo</span></button>
          <button class="tool" onClick=${redo} disabled=${!hist.future.length} title="Redo (Ctrl+Shift+Z)"><${Icon} name="redo" /><span>Redo</span></button>
          <button class="tool" onClick=${() => (commit([]), setSel(new Set()))} disabled=${!strokes.length} title="Clear"><${Icon} name="trash" /><span>Clear</span></button>
        </div>

        <div class="ed-canvas-wrap">
          <div class="ed-view" role="toolbar" aria-label="View">
            <button class="icon-btn sm" onClick=${() => setZoom(view.z / 1.25)} disabled=${view.z <= ZOOM_MIN} aria-label="Zoom out" title="Zoom out (−)"><${Icon} name="minus" size=${16} /></button>
            <span class="ed-zoom" aria-live="polite">${Math.round(view.z * 100)}%</span>
            <button class="icon-btn sm" onClick=${() => setZoom(view.z * 1.25)} disabled=${view.z >= ZOOM_MAX} aria-label="Zoom in" title="Zoom in (+)"><${Icon} name="plus" size=${16} /></button>
            <button class="icon-btn sm" onClick=${() => setZoom(1)} aria-label="Fit tile" title="Fit (0)"><${Icon} name="fit" size=${16} /></button>
            <span class="ed-sep"></span>
            <button class=${'chip sm' + (showGrid ? ' on' : '')} aria-pressed=${showGrid} onClick=${() => setShowGrid(!showGrid)} title="Show grid (G)"><${Icon} name="grid" size=${14} /> Grid</button>
            <button class=${'chip sm' + (snap ? ' on' : '')} aria-pressed=${snap} onClick=${() => setSnap(!snap)} title="Snap to grid (N)">Snap</button>
            ${tool === 'move' && sel.size > 0 &&
            html`<span class="ed-sep"></span>
              <span class="ed-sel-count">${sel.size} selected</span>
              <button class="chip sm" onClick=${smoothSel}><${Icon} name="steady" size=${14} /> Smooth</button>
              <button class="chip sm" onClick=${deleteSel}><${Icon} name="trash" size=${14} /> Delete</button>`}
            <span class="spacer"></span>
            <span class="ed-hint">${view.z > 1 ? 'Scroll or Space + drag to pan' : 'Ctrl + scroll to zoom'}</span>
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
            </defs>
            ${showGrid && html`<rect x=${base.x - 400} y=${base.y - 400} width=${base.w + 800} height=${base.h + 800} fill="url(#ed-minor)" />`}
            <g class="ed-ghost" transform=${`translate(${-TW} 0)`}>${drawn(strokes)}</g>
            <g class="ed-ghost" transform=${`translate(${TW} 0)`}>${drawn(strokes)}</g>
            <rect class="ed-tile" x="0" y="0" width=${TW} height=${TH} />
            ${showGrid &&
            html`<g class="ed-grid">
              ${Array.from({ length: GRID - 1 }, (_, i) => html`<line x1="0" x2=${TW} y1=${((i + 1) * TH) / GRID} y2=${((i + 1) * TH) / GRID} class=${(i + 1) % 3 ? '' : 'major'} />`)}
              ${Array.from({ length: cols - 1 }, (_, i) => html`<line y1="0" y2=${TH} x1=${((i + 1) * TW) / cols} x2=${((i + 1) * TW) / cols} class=${(i + 1) % 3 ? '' : 'major'} />`)}
            </g>`}
            ${mx && html`<line class="ed-axis" x1=${TW / 2} x2=${TW / 2} y1="-6" y2=${TH + 6} />`}
            ${my && html`<line class="ed-axis" y1=${TH / 2} y2=${TH / 2} x1="-6" x2=${TW + 6} />`}
            <g class="ed-main">${drawn(strokes, '', true)}${drawn(liveStrokes, 'live')}</g>
            ${live && tool === 'line' && cursor &&
            html`<line class="ed-rubber" x1=${live.pts[live.pts.length - 1][0] * TW} y1=${live.pts[live.pts.length - 1][1] * TH} x2=${cursor[0] * TW} y2=${cursor[1] * TH} />`}
            ${cursor && html`<circle class="ed-cursor" cx=${cursor[0] * TW} cy=${cursor[1] * TH} r=${2.2 / view.z} />`}
            ${zone === 'side' && html`<text class="ed-edge" x=${TW / 2} y="-5">ring edge</text>`}
            <text class="ed-tile-label" x=${-TW / 2} y=${TH + pad + 6}>repeats</text>
            <text class="ed-tile-label" x=${TW * 1.5} y=${TH + pad + 6}>repeats</text>
            <g class="ed-dims">
              <line x1="0" x2=${TW} y1=${TH + 8} y2=${TH + 8} /><line x1="0" x2="0" y1=${TH + 5} y2=${TH + 11} /><line x1=${TW} x2=${TW} y1=${TH + 5} y2=${TH + 11} />
              <text x=${TW / 2} y=${TH + 15}>${tileW.toFixed(2)} mm</text>
              <line x1=${TW + 8} x2=${TW + 8} y1="0" y2=${TH} /><line x1=${TW + 5} x2=${TW + 11} y1="0" y2="0" /><line x1=${TW + 5} x2=${TW + 11} y1=${TH} y2=${TH} />
              <text x=${TW + 12} y=${TH / 2} class="vert" transform=${`rotate(90 ${TW + 12} ${TH / 2})`}>${zh.toFixed(2)} mm</text>
            </g>
          </svg>
          ${!strokes.length && !live && html`<p class="ed-empty">Draw <strong>one tile</strong>. It repeats around the whole ring. The faded copies show the neighbouring tiles.</p>`}
          <div class="ed-status" aria-hidden="true">
            <span>X ${cursor ? (cursor[0] * tileW).toFixed(2) : '—'} mm</span>
            <span>Y ${cursor ? (cursor[1] * zh).toFixed(2) : '—'} mm</span>
            <span>Tile ${tileW.toFixed(2)} × ${zh.toFixed(2)} mm</span>
            <span>${strokes.length} stroke${strokes.length === 1 ? '' : 's'}</span>
          </div>
          <div class="ed-props">
            <div class="ed-weight">
              <${Slider} label="Line weight" value=${lw} min=${MIN_LINE_MM} max=${MAX_LINE_MM} step=${0.05} unit="mm" format=${(v) => `${v.toFixed(2)} mm`}
                onInput=${(v) => setLw(+v.toFixed(2))} />
              <p class=${'detail-note ' + lineNote.level} role="status">
                <${Icon} name=${lineNote.level === 'ok' ? 'check' : lineNote.level === 'info' ? 'info' : 'alert'} size=${14} /> ${lineNote.text}
              </p>
            </div>
            <div class="ed-steady">
              <div class="ed-steady-head">
                <span class="field-label">Steady</span>
                <button class=${'chip sm' + (steady.on ? ' on' : '')} aria-pressed=${steady.on} onClick=${() => setSteady({ ...steady, on: !steady.on })} title="Steady (B)">
                  <${Icon} name="steady" size=${14} /> ${steady.on ? 'On' : 'Off'}
                </button>
              </div>
              <${Slider} label="Correction" value=${steady.amt} min=${0} max=${100} step=${5} unit="%" format=${(v) => `${v}%`}
                onInput=${(v) => setSteady({ on: true, amt: v })} />
              <p class="hint">Applied when you lift the pen, so drawing never lags. Higher values give rounder, calmer lines.</p>
            </div>
            <div>
              <${Slider} label="Tile proportion" value=${aspect} min=${0.4} max=${2} step=${0.05} unit="" format=${(v) => `${v.toFixed(2)} : 1`}
                onInput=${setAspect} />
            </div>
          </div>
        </div>

        <div class="ed-preview">
          <span class="field-label">Live on your ring</span>
          <${RingView} design=${preview} getPattern=${getP} mode="studio" className="ed-ring" />
          <${BandMap} design=${preview} getPattern=${getP} activeZones=${zone === 'middle' ? ['middle'] : ['sideL', 'sideR']} />
          <p class="hint">Press <kbd>?</kbd> for every shortcut.</p>
        </div>
      </div>
    </div>
  <//>`;
}
