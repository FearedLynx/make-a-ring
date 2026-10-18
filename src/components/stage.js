// The cross carousel: middle patterns scroll up/down, side patterns scroll left/right,
// the 3D ring sits in the centre and updates instantly: the rings one step away are built ahead of time.
import { useEffect, useRef, useState } from 'preact/hooks';
import { html } from '../lib/html.js';
import { Icon } from './ui.js';
import { PatternArt, BandMap } from './pattern-art.js';
import { RingView, prebuildRings } from './ring-view.js';
import { hasMiddle, hasSides, LAYOUTS, splitPatch } from '../lib/templates.js';
import {
  store, cyclePattern, neighbours, patternById, patternsForZone, setLinked, setDesign, announce, showTip, steppedDesign,
} from '../state.js';

const isTouch = () => document.documentElement.dataset.input === 'touch';

function useSwipe(onStep) {
  const start = useRef(null);
  return {
    onPointerDown: (e) => (start.current = { x: e.clientX, y: e.clientY }),
    onPointerUp: (e) => {
      if (!start.current) return;
      const dx = e.clientX - start.current.x, dy = e.clientY - start.current.y;
      start.current = null;
      if (Math.max(Math.abs(dx), Math.abs(dy)) > 28) onStep(dx, dy);
    },
  };
}

function useWheelStep(onStep) {
  const last = useRef(0);
  return (e) => {
    // Sideways swipes are free; a vertical wheel needs Ctrl so it keeps scrolling the page.
    const sideways = Math.abs(e.deltaX) > Math.abs(e.deltaY);
    if (!sideways && !e.ctrlKey && !e.metaKey) return;
    const d = sideways ? e.deltaX : e.deltaY;
    if (Math.abs(d) < 4) return;
    e.preventDefault();
    const now = performance.now();
    if (now - last.current < 260) return;
    last.current = now;
    onStep(Math.sign(d));
  };
}

function Card({ id, kind, dir, label, onClick, far = false, animKey, animClass }) {
  const p = patternById(id);
  return html`<button type="button" class=${`stage-card ${kind} ${far ? 'far' : ''} ${animClass}`} key=${animKey}
    onClick=${onClick} aria-label=${`${label}: ${p?.name || 'Plain'}`} tabindex=${far ? -1 : 0}>
    <${PatternArt} pattern=${p} layout=${kind === 'middle' ? 'column' : 'pair'} repeats=${kind === 'middle' ? 2 : 3} />
    <span class="stage-card-name">${p?.name || 'Plain'}</span>
  </button>`;
}

export function Stage({ onDraw }) {
  const design = store.use((s) => s.design);
  const activeSide = store.use((s) => s.activeSide);
  store.use((s) => s.customPatterns);
  const viewer = useRef();
  const centre = useRef(); // the ring is framed on the centre of the cross, but drawn across the whole stage
  const [anim, setAnim] = useState({ axis: '', dir: 0, n: 0 });
  const [spin, setSpin] = useState(false);

  const mid = hasMiddle(design.layout);
  const sides = hasSides(design.layout);
  const sideZone = design.linked ? 'sideL' : activeSide;

  // Next steps first: they are the most likely.
  useEffect(() => {
    const t = setTimeout(() => prebuildRings([['middle', 1], ['side', 1], ['middle', -1], ['side', -1]].map(([a, d]) => steppedDesign(a, d)).filter(Boolean)), 100);
    return () => clearTimeout(t);
  }, [design, activeSide]);

  const clicks = useRef(0);
  const step = (axis, dir, source = 'key') => {
    cyclePattern(axis, dir);
    setAnim((a) => ({ axis, dir, n: a.n + 1 }));
    if (source === 'click' && ++clicks.current === 3) {
      showTip(
        'carousel-keys',
        isTouch()
          ? 'Tip: swipe the side cards sideways instead of tapping them. It is quicker.'
          : 'Tip: use the arrow keys. ↑ ↓ change the middle, ← → change the sides. Press ? to see every shortcut.'
      );
    }
  };
  const click = (axis, dir) => () => step(axis, dir, 'click');

  useEffect(() => {
    const onKey = (e) => {
      if (document.body.classList.contains('modal-open')) return;
      const t = e.target;
      if (t.closest?.('input, textarea, select, [contenteditable], .segmented')) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const map = { ArrowUp: ['middle', -1], ArrowDown: ['middle', 1], ArrowLeft: ['side', -1], ArrowRight: ['side', 1] };
      if (map[e.key]) {
        e.preventDefault();
        step(...map[e.key]);
      } else if (e.key === 'l' || e.key === 'L') {
        setLinked(!store.get().design.linked);
      } else if ((e.key === 's' || e.key === 'S') && !store.get().design.linked) {
        const next = store.get().activeSide === 'sideL' ? 'sideR' : 'sideL';
        store.set({ activeSide: next });
        announce(next === 'sideL' ? 'Editing left side' : 'Editing right side');
      } else if (e.key === 'r' || e.key === 'R') {
        viewer.current?.resetView();
      } else if (e.key === '+' || e.key === '=') {
        viewer.current?.zoomBy(0.85);
      } else if (e.key === '-' || e.key === '_') {
        viewer.current?.zoomBy(1.18);
      } else if (e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        onDraw();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const midSwipe = useSwipe((dx, dy) => Math.abs(dy) > Math.abs(dx) && step('middle', dy < 0 ? 1 : -1));
  const sideSwipe = useSwipe((dx, dy) => Math.abs(dx) > Math.abs(dy) && step('side', dx < 0 ? 1 : -1));
  const midWheel = useWheelStep((d) => step('middle', d));
  const sideWheel = useWheelStep((d) => step('side', d));

  const midList = patternsForZone('middle');
  const sideList = patternsForZone(sideZone);
  const midIdx = midList.indexOf(design.patterns.middle ?? null) + 1;
  const sideIdx = sideList.indexOf(design.patterns[sideZone] ?? null) + 1;
  const cls = (axis) => (anim.axis === axis ? (anim.dir > 0 ? 'enter-next' : 'enter-prev') : '');
  const k = (axis, pos) => `${axis}-${pos}-${anim.axis === axis ? anim.n : 0}`;

  const placeholder = (what) => html`<div class="stage-empty">
    <span>No ${what} in “${LAYOUTS[design.layout].name}”</span>
    <button class="link-btn" onClick=${() => setDesign({ layout: 'trio' })}>Switch to Trio</button>
  </div>`;

  return html`<section class="stage" aria-label="Ring designer stage">
    <p class="stage-hint" id="stage-help">
      ${isTouch()
        ? html`<span>tap cards to change patterns</span><span>drag ring to rotate</span>`
        : html`<span><kbd>↑</kbd><kbd>↓</kbd> middle</span><span><kbd>←</kbd><kbd>→</kbd> sides</span><span>drag to rotate</span>`}
    </p>
    <div class="stage-ring">
      <${RingView} design=${design} mode="studio" autoRotate=${spin} focus=${() => centre.current} onViewer=${(v) => (viewer.current = v)} />
    </div>
    <span class="reg tl" aria-hidden="true"></span><span class="reg tr" aria-hidden="true"></span>
    <span class="reg bl" aria-hidden="true"></span><span class="reg br" aria-hidden="true"></span>
    <div class="stage-tools">
      <button class="icon-btn" onClick=${() => viewer.current?.zoomBy(0.85)} title="Zoom in (+)" aria-label="Zoom in"><${Icon} name="plus" /></button>
      <button class="icon-btn" onClick=${() => viewer.current?.zoomBy(1.18)} title="Zoom out (−)" aria-label="Zoom out"><${Icon} name="minus" /></button>
      <button class="icon-btn" onClick=${() => viewer.current?.resetView()} title="Reset view (R)" aria-label="Reset view"><${Icon} name="recenter" /></button>
      <button class=${'icon-btn' + (spin ? ' on' : '')} aria-pressed=${spin} onClick=${() => setSpin(!spin)} title="Turntable" aria-label="Turntable rotation"><${Icon} name="turntable" /></button>
    </div>

    <div class="stage-main">
    <div class="cross">
      <div class="cross-top" onWheel=${mid ? midWheel : undefined} ...${mid ? midSwipe : {}}>
        ${mid
          ? html`<${Card} id=${neighbours('middle', -1)} kind="middle" label="Previous middle pattern" onClick=${click('middle', -1)}
              animKey=${k('middle', 't')} animClass=${cls('middle')} />`
          : placeholder('middle zone')}
      </div>

      <div class="cross-left" onWheel=${sides ? sideWheel : undefined} ...${sides ? sideSwipe : {}}>
        ${sides
          ? html`<${Card} id=${neighbours(sideZone, -2)} kind="side" far label="" animKey=${k('side', 'l2')} animClass=${cls('side')} onClick=${() => (step('side', -1, 'click'), step('side', -1, 'click'))} />
              <${Card} id=${neighbours(sideZone, -1)} kind="side" label="Previous side pattern" animKey=${k('side', 'l1')} animClass=${cls('side')} onClick=${click('side', -1)} />`
          : placeholder('side zones')}
      </div>

      <div class="cross-center" ref=${centre}></div>

      <div class="cross-right" onWheel=${sides ? sideWheel : undefined} ...${sides ? sideSwipe : {}}>
        ${sides &&
        html`<${Card} id=${neighbours(sideZone, 1)} kind="side" label="Next side pattern" animKey=${k('side', 'r1')} animClass=${cls('side')} onClick=${click('side', 1)} />
          <${Card} id=${neighbours(sideZone, 2)} kind="side" far label="" animKey=${k('side', 'r2')} animClass=${cls('side')} onClick=${() => (step('side', 1, 'click'), step('side', 1, 'click'))} />`}
      </div>

      <div class="cross-bottom" onWheel=${mid ? midWheel : undefined} ...${mid ? midSwipe : {}}>
        ${mid &&
        html`<${Card} id=${neighbours('middle', 1)} kind="middle" label="Next middle pattern" onClick=${click('middle', 1)}
          animKey=${k('middle', 'b')} animClass=${cls('middle')} />`}
      </div>
    </div>

    <div class="selection-bar">
      <div class=${'sel-group' + (mid ? '' : ' disabled')}>
        <button class="icon-btn sm" disabled=${!mid} onClick=${click('middle', -1)} aria-label="Previous middle pattern"><${Icon} name="up" size=${16} /></button>
        <div class="sel-text">
          <span class="sel-label">Middle</span>
          <strong key=${k('middle', 'n')} class=${cls('middle')}>${mid ? patternById(design.patterns.middle)?.name || 'Plain' : '—'}</strong>
          ${mid && html`<span class="sel-count">${midIdx}/${midList.length}</span>`}
        </div>
        <button class="icon-btn sm" disabled=${!mid} onClick=${click('middle', 1)} aria-label="Next middle pattern"><${Icon} name="down" size=${16} /></button>
      </div>

      <div class=${'sel-group' + (sides ? '' : ' disabled')}>
        <button class="icon-btn sm" disabled=${!sides} onClick=${click('side', -1)} aria-label="Previous side pattern"><${Icon} name="left" size=${16} /></button>
        <div class="sel-text">
          <span class="sel-label">${design.linked ? 'Sides' : activeSide === 'sideL' ? 'Left side' : 'Right side'}</span>
          <strong key=${k('side', 'n')} class=${cls('side')}>${sides ? patternById(design.patterns[sideZone])?.name || 'Plain' : '—'}</strong>
          ${sides && html`<span class="sel-count">${sideIdx}/${sideList.length}</span>`}
        </div>
        <button class="icon-btn sm" disabled=${!sides} onClick=${click('side', 1)} aria-label="Next side pattern"><${Icon} name="right" size=${16} /></button>
      </div>

      <div class="sel-group link-group">
        <button class=${'chip' + (design.linked ? ' on' : '')} disabled=${!sides} aria-pressed=${design.linked}
          onClick=${() => setLinked(!design.linked)} title="Link sides (L)">
          <${Icon} name=${design.linked ? 'link' : 'unlink'} size=${16} /> ${design.linked ? 'Sides matched' : 'Sides unlinked'}
        </button>
        ${!design.linked && sides &&
        html`<div class="segmented sm" role="radiogroup" aria-label="Which side to style">
          ${['sideL', 'sideR'].map((z) => html`<button role="radio" aria-checked=${activeSide === z} class=${activeSide === z ? 'on' : ''}
            onClick=${() => store.set({ activeSide: z })}>${z === 'sideL' ? 'Left' : 'Right'}</button>`)}
        </div>`}
      </div>

      <button class="btn accent draw-btn" onClick=${onDraw}><${Icon} name="pen" size=${16} /> Draw your own</button>
    </div>

    </div>

    <div class="band-map-wrap">
      <div class="band-map-head">
        <span>Unrolled band</span>
        <span class="muted">${LAYOUTS[design.layout].zones.length > 1 ? 'click a zone · drag the handles to resize' : 'click to focus the library'}</span>
      </div>
      <${BandMap} design=${design} getPattern=${patternById} labelled
        onSplit=${(v) => setDesign(splitPatch(store.get().design, v))}
        activeZones=${design.linked ? ['middle', 'sideL', 'sideR'] : ['middle', activeSide]}
        onZone=${(z) => {
          if (z !== 'middle' && !design.linked) store.set({ activeSide: z });
          store.set({ libZone: z === 'middle' ? 'middle' : 'side' });
          announce(`${z === 'middle' ? 'Middle' : z === 'sideL' ? 'Left side' : 'Right side'} zone focused. The library now shows matching patterns.`);
        }} />
    </div>
  </section>`;
}
