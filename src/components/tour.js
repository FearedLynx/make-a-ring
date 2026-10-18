// Guided tours: one element is spotlit and underlined, everything else is shaded.
// The spotlit element stays usable, so people can try each step. When they do,
// the step ticks itself off. Their design is snapshotted and can be restored at the end.
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { html } from '../lib/html.js';
import { Icon } from './ui.js';
import { TourAnim } from './tour-anim.js';
import { store, endTour, dismissTip, setRails, toast, startTour } from '../state.js';

const touch = () => document.documentElement.dataset.input === 'touch';
const K = (k) => html`<kbd>${k}</kbd>`;
const edTab = (tab) => () => window.dispatchEvent(new CustomEvent('mar:edtab', { detail: tab }));
// Studio side panels show one category at a time; open the one a step points at.
const libCat = (cat) => () => setRails({ libOpen: true, libCat: cat });
const specCat = (cat) => () => setRails({ specOpen: true, specCat: cat });
const changed = (f) => (prev, next) => JSON.stringify(f(prev)) !== JSON.stringify(f(next));

export const TOURS = {
  studio: [
    {
      target: '.cross-center', anim: 'rotate', detect: 'drag',
      title: 'This is your ring',
      body: () => (touch() ? 'Drag sideways to rotate it and pinch to zoom. Try it now.' : html`Drag to rotate it, ${K('Ctrl')} + scroll to zoom. ${K('R')} resets the view. Try it now.`),
      done: 'Nice. Every change you make shows up here instantly.',
    },
    {
      target: '.cross-top', anim: 'vertical', allowKeys: ['ArrowUp', 'ArrowDown'],
      watch: changed((s) => s.design.patterns.middle),
      title: 'Middle patterns scroll up and down',
      body: () => (touch() ? 'Tap the card above the ring.' : html`Click the card above the ring, or press ${K('↑')} ${K('↓')}.`),
      done: 'That is the middle zone changing.',
    },
    {
      target: '.cross-right', anim: 'horizontal', allowKeys: ['ArrowLeft', 'ArrowRight'],
      watch: changed((s) => [s.design.patterns.sideL, s.design.patterns.sideR]),
      title: 'Side patterns scroll left and right',
      body: () => (touch() ? 'Tap a side card, or swipe it sideways.' : html`Click a side card, or press ${K('←')} ${K('→')}.`),
      done: 'Both sides changed together.',
    },
    {
      extra: true,
      target: '.link-group', anim: 'link', allowKeys: ['l', 'L', 's', 'S'],
      watch: changed((s) => s.design.linked),
      title: 'Matched or mixed sides',
      body: () => (touch() ? 'Tap to unlink, then pick which side you are styling.' : html`${K('L')} links or unlinks the sides. When unlinked, ${K('S')} switches between left and right.`),
      done: 'Now each side can have its own border.',
    },
    {
      extra: true,
      target: '.band-map-wrap', anim: 'band',
      watch: changed((s) => [s.design.splits, s.libZone, s.activeSide]),
      title: 'The unrolled band',
      body: () => 'The ring laid flat, exactly as it will be made. Drag the handles on the zone edges to make the sides or middle bigger, or click a zone to filter the library.',
      done: 'Proportions are yours to set.',
    },
    {
      extra: true,
      target: '.rail.library', anim: 'search', detect: 'input', allowKeys: '*input', onEnter: libCat('patterns'), host: '.rail-strip.lib',
      title: 'Find anything faster',
      body: () => (touch() ? 'Search every pattern here instead of scrolling. The icons on the edge switch to your own patterns and templates.' : html`Type in the search box (${K('/')} jumps there). The icons on the edge switch categories, ${K('[')} hides the panel, and its edge drags to resize.`),
      done: 'Search narrows patterns as you type.',
    },
    {
      target: '.draw-btn', anim: 'draw', interact: false,
      title: 'Draw your own pattern',
      body: () => (touch() ? 'Sketch one tile and it repeats around the whole ring.' : html`Sketch one tile and it repeats around the whole ring. Shortcut: ${K('D')}.`),
      more: 'The editor has its own short tour the first time you open it.',
    },
    {
      extra: true,
      target: '#spec-layout', anim: 'layout', onEnter: specCat('layout'), host: '.rail-strip.spec',
      watch: changed((s) => [s.design.layout, s.design.splits]),
      title: 'Layout and proportions',
      body: () => 'Choose which zones the ring has, then set how wide the sides are compared to the middle.',
      done: 'Layout updated.',
    },
    {
      extra: true,
      target: '#spec-checks', anim: 'checks', onEnter: specCat('checks'), host: '.rail-strip.spec',
      watch: changed((s) => s.design),
      title: 'Printability, checked live',
      body: () => 'Thin walls, fine lines and deep engravings are flagged for the material you pick. Each warning has a one-click fix.',
      done: 'Fixed, and it can be undone from the toast.',
    },
    {
      target: '.price-card', anim: 'price', interact: false, onEnter: () => setRails({ specOpen: true }), host: '.rail-strip.spec',
      title: 'Price and next step',
      body: () => (touch() ? 'When you like it, try it on a hand.' : html`When you like it, try it on a hand. Press ${K('?')} any time to see every shortcut.`),
    },
  ],
  editor: [
    {
      target: '.ed-canvas', anim: 'draw', detect: 'drawn', allowKeys: '*',
      title: 'Draw one tile',
      body: () => 'Whatever you draw here repeats around the ring. The faded copies on either side show where the next tiles join. Try a quick squiggle.',
      more: touch() ? null : 'Keyboard: arrow keys move the cursor, Enter places a point, Esc finishes a line.',
      done: 'See it repeat in the faded tiles?',
    },
    {
      target: '.ed-tools', anim: 'tools', allowKeys: ['p', 'l', 's', 'c', 'd', 't', 'v', 'e', 'P', 'L', 'S', 'C', 'D', 'T', 'V', 'E'],
      title: 'Tools',
      body: () => (touch() ? 'Pen, line, square, circle, dot, stamp, move and eraser.' : html`${K('P')} pen · ${K('L')} line · ${K('S')} square · ${K('C')} circle · ${K('D')} dot · ${K('T')} stamp · ${K('V')} move · ${K('E')} eraser`),
      more: 'Hold Shift with the line tool to lock it straight, or with the square tool for a free rectangle.',
    },
    {
      target: '.ed-sym', anim: 'symmetry',
      title: 'Symmetry does half the work',
      body: () => 'Mirror, rotate or kaleidoscope: one stroke becomes a balanced ornament. Moving a stroke moves its copies too.',
    },
    {
      target: '.ed-panel', anim: 'stamps', onEnter: edTab('stamps'),
      title: 'Stamps',
      body: () => 'Leaves, hearts, stars, curls and more. Pick one, set size and angle, and click to place it.',
    },
    {
      target: '.ed-panel', anim: 'steady', onEnter: edTab('steady'),
      title: 'Steady',
      body: () => 'Smooths each pen line after you lift the pen, so drawing never lags. Shape recognition turns a wobbly circle or line into a clean one.',
    },
    {
      target: '.ed-panel', anim: 'generate', onEnter: edTab('generate'),
      title: 'Generate a base',
      body: () => 'Start from a clean wave, zigzag, chain or scallop and decorate on top of it.',
    },
    {
      target: '.ed-panel', anim: 'weight', onEnter: edTab('line'),
      title: 'Line weight, with real limits',
      body: () => 'Set the thickness in millimetres. Go thinner than your material can print and you will see a warning straight away.',
      more: 'Lines look thick because the zone is only a few millimetres tall. Make the zone bigger for a finer look.',
    },
    {
      target: '.ed-view', anim: 'zoom',
      title: 'Zoom, grid and guides',
      body: () => (touch() ? 'Zoom in for detail and hide the grid when you want a clean view.' : html`${K('+')} ${K('−')} or Ctrl + scroll to zoom, ${K('0')} fits. ${K('G')} grid, ${K('N')} snapping.`),
      more: 'Shaded strips show where a bevel or dome bends the pattern. Gold markers on the tile edges show where a line must continue to join the next tile.',
    },
    {
      target: '.ed-preview', anim: 'preview',
      title: 'Live on your ring',
      body: () => 'Your tile is wrapped onto the ring when you lift the pen. Save it and it joins your library and the carousels.',
    },
  ],
};

function placeCard(r, card) {
  const m = 14, vw = innerWidth, vh = innerHeight;
  const cw = card?.offsetWidth || 360, ch = card?.offsetHeight || 260;
  let top, left;
  if (r.bottom + m + ch < vh) top = r.bottom + m;
  else if (r.top - m - ch > 0) top = r.top - m - ch;
  else top = Math.max(m, Math.min(vh - ch - m, r.top + r.height / 2 - ch / 2));
  if (top === r.bottom + m || top === r.top - m - ch) left = r.left + r.width / 2 - cw / 2;
  else left = r.right + m + cw < vw ? r.right + m : r.left - m - cw;
  return { top, left: Math.max(m, Math.min(vw - cw - m, left)) };
}

const inside = (r, x, y) => r && x >= r.left && x <= r.left + r.width && y >= r.top && y <= r.top + r.height;

export function Tour() {
  const tour = store.use((s) => s.tour);
  const [rect, setRect] = useState(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [skipAsk, setSkipAsk] = useState(false);
  const [doneMsg, setDoneMsg] = useState(null);
  const [final, setFinal] = useState(false);
  const card = useRef();
  const nextBtn = useRef();
  const spotRef = useRef(null);

  const steps = tour
    ? (TOURS[tour.id] || []).filter((st) => {
        // The first-run tour is the 5 core steps; the full one (help menu) adds the `extra` ones.
        if (st.extra && !tour.full) return false;
        // A step whose target sits in a closed panel category stays if its panel (`host`) is on screen;
        // its onEnter opens that category.
        const shown = (sel) => !!document.querySelector(sel)?.getClientRects().length;
        return shown(st.target) || (st.host && shown(st.host));
      })
    : [];
  const i = tour ? Math.min(tour.step, Math.max(0, steps.length - 1)) : 0;
  const step = steps[i];

  const finish = () => {
    const snap = tour?.snapshot;
    if (snap && JSON.stringify(snap) !== JSON.stringify(store.get().design)) setFinal(true);
    else endTour();
  };
  const skip = () => {
    const id = tour.id, full = tour.full;
    finish();
    toast('Tour skipped', { label: 'Replay', run: () => startTour(id, { full }) });
  };
  const go = (n) => {
    setSkipAsk(false);
    setDoneMsg(null);
    if (n >= steps.length) return finish();
    store.set({ tour: { ...tour, step: Math.max(0, n) } });
  };

  useEffect(() => {
    setSkipAsk(false);
    setFinal(false);
  }, [tour?.id]);

  // Step entry: run its hook, follow the target while it moves.
  useEffect(() => {
    if (!step) return;
    document.body.classList.add('tour-open');
    dismissTip();
    step.onEnter?.();
    // After the hook's re-render, so a panel it just opened can be scrolled to.
    requestAnimationFrame(() => document.querySelector(step.target)?.scrollIntoView({ block: 'nearest', inline: 'nearest' }));
    let raf;
    const tick = () => {
      const r = document.querySelector(step.target)?.getBoundingClientRect();
      if (r) setRect((old) => (old && old.top === r.top && old.left === r.left && old.width === r.width && old.height === r.height ? old : r));
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [tour?.id, i]);

  useEffect(() => () => document.body.classList.remove('tour-open'), []);
  useEffect(() => {
    if (!tour) document.body.classList.remove('tour-open');
  }, [tour]);

  // Did the person actually do the thing? Then tick the step off and move on.
  const complete = () => {
    if (!step?.done) return;
    setDoneMsg((m) => m || step.done);
  };
  useEffect(() => {
    if (!doneMsg) return;
    const t = setTimeout(() => go(i + 1), 1500);
    return () => clearTimeout(t);
  }, [doneMsg]);

  useEffect(() => {
    if (!step || skipAsk || final) return;
    const offs = [];
    if (step.watch) {
      let prev = store.get();
      offs.push(store.subscribe((s) => {
        if (step.watch(prev, s)) complete();
        prev = s;
      }));
    }
    if (step.detect === 'drag') {
      let start = null;
      const down = (e) => inside(spotRef.current, e.clientX, e.clientY) && (start = { x: e.clientX, y: e.clientY });
      const up = (e) => {
        if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 24) complete();
        start = null;
      };
      const wheel = (e) => (e.ctrlKey || e.metaKey) && inside(spotRef.current, e.clientX, e.clientY) && complete();
      addEventListener('pointerdown', down, true);
      addEventListener('pointerup', up, true);
      addEventListener('wheel', wheel, true);
      offs.push(() => (removeEventListener('pointerdown', down, true), removeEventListener('pointerup', up, true), removeEventListener('wheel', wheel, true)));
    }
    if (step.detect === 'input') {
      const onInput = (e) => e.target.closest?.(step.target) && e.target.value?.length > 1 && complete();
      addEventListener('input', onInput, true);
      offs.push(() => removeEventListener('input', onInput, true));
    }
    if (step.detect === 'drawn') {
      const onUp = (e) => inside(spotRef.current, e.clientX, e.clientY) && setTimeout(complete, 300);
      addEventListener('pointerup', onUp, true);
      offs.push(() => removeEventListener('pointerup', onUp, true));
    }
    return () => offs.forEach((f) => f());
  }, [tour?.id, i, skipAsk, final]);

  useLayoutEffect(() => {
    if (rect) setPos(placeCard(rect, card.current));
  }, [rect, i, !!doneMsg]); // not on skipAsk: the confirmation appears in place, the card does not jump

  useEffect(() => {
    if (step || final) requestAnimationFrame(() => (card.current?.querySelector('[data-primary]') || nextBtn.current)?.focus({ preventScroll: true }));
  }, [i, skipAsk, !!step, final]);

  useEffect(() => {
    if (!tour) return;
    const onKey = (e) => {
      const inCard = e.target instanceof Node && !!card.current?.contains(e.target);
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        if (!final) skip();
        return;
      }
      if (e.key === 'Tab' && !e.target.closest?.(step?.target || '#none')) {
        const f = [...(card.current?.querySelectorAll('button') || [])];
        if (!f.length) return;
        e.preventDefault();
        e.stopPropagation();
        const k = f.indexOf(document.activeElement);
        f[(k + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
        return;
      }
      if (inCard) return; // buttons in the card behave normally
      const allow = step?.allowKeys;
      const typing = e.target.closest?.('input, textarea') && e.target.closest?.(step?.target || '#none');
      if (allow === '*' || typing || (Array.isArray(allow) && allow.includes(e.key))) return;
      if (e.key === 'Enter' && !skipAsk && !final) {
        e.preventDefault();
        e.stopPropagation();
        go(i + 1);
        return;
      }
      if (!e.ctrlKey && !e.metaKey) e.stopPropagation(); // keep other shortcuts from firing underneath
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [tour, i, skipAsk, final, steps.length]);

  if (!tour) return null;

  if (final) {
    return html`<div class="tour" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      <div class="tour-blocker full"></div>
      <svg class="tour-shade" aria-hidden="true"><rect x="0" y="0" width="100%" height="100%" class="tour-shade-fill" /></svg>
      <div class="tour-card center" ref=${card}>
        <div class="tour-head"><span class="tour-count">Tour complete</span></div>
        <h2 id="tour-title">Keep what you tried?</h2>
        <p>You changed the ring while following the tour. Keep those changes, or put your ring back exactly as it was before the tour.</p>
        <div class="tour-actions">
          <button class="btn ghost sm" onClick=${() => (store.set({ design: tour.snapshot }), setFinal(false), endTour())}>Restore my ring</button>
          <span class="spacer"></span>
          <button class="btn primary sm" data-primary onClick=${() => (setFinal(false), endTour())}>Keep changes</button>
        </div>
      </div>
    </div>`;
  }

  if (!step || !rect) return null;
  const pad = 6;
  const spot = { top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 };
  spotRef.current = spot;
  const interact = step.interact !== false && !skipAsk;
  const last = i === steps.length - 1;
  const vw = document.documentElement.clientWidth, vh = innerHeight; // clientWidth leaves out the scrollbar
  // Four blockers around the hole keep the rest of the page inert while the spotlit part stays usable.
  const blockers = interact
    ? [
        { top: 0, left: 0, width: vw, height: Math.max(0, spot.top) },
        { top: spot.top + spot.height, left: 0, width: vw, height: Math.max(0, vh - spot.top - spot.height) },
        { top: spot.top, left: 0, width: Math.max(0, spot.left), height: spot.height },
        { top: spot.top, left: spot.left + spot.width, width: Math.max(0, vw - spot.left - spot.width), height: spot.height },
      ]
    : [{ top: 0, left: 0, width: vw, height: vh }];

  return html`<div class="tour" role="dialog" aria-modal="false" aria-labelledby="tour-title" aria-describedby="tour-body">
    ${blockers.map((b) => html`<div class="tour-blocker" style=${`top:${b.top}px;left:${b.left}px;width:${b.width}px;height:${b.height}px`}></div>`)}
    <svg class="tour-shade" aria-hidden="true">
      <defs>
        <mask id="tour-mask">
          <rect x="0" y="0" width="100%" height="100%" fill="white" />
          <rect x=${spot.left} y=${spot.top} width=${spot.width} height=${spot.height} rx="10" fill="black" />
        </mask>
      </defs>
      <rect x="0" y="0" width="100%" height="100%" class="tour-shade-fill" mask="url(#tour-mask)" />
    </svg>
    <div class=${'tour-spot' + (interact ? ' live' : '')} style=${`top:${spot.top}px;left:${spot.left}px;width:${spot.width}px;height:${spot.height}px`}>
      <span class="tour-underline" key=${i}></span>
      <span class="tour-tick tl"></span><span class="tour-tick tr"></span><span class="tour-tick bl"></span><span class="tour-tick br"></span>
      ${interact && step.done && html`<span class="tour-try">Try it</span>`}
    </div>
    <div class="tour-card" ref=${card} style=${`top:${pos.top}px;left:${pos.left}px`}>
      <div class="tour-head">
              <span class="tour-count">${String(i + 1).padStart(2, '0')} / ${String(steps.length).padStart(2, '0')}</span>
              <div class="tour-progress" aria-hidden="true">${steps.map((_, k) => html`<span class=${k <= i ? 'on' : ''}></span>`)}</div>
            </div>
            <${TourAnim} kind=${step.anim} key=${tour.id + i} />
            <h2 id="tour-title">${step.title}</h2>
            ${doneMsg
              ? html`<p id="tour-body" class="tour-done" role="status"><${Icon} name="check" size=${16} /> ${doneMsg}</p>`
              : html`<p id="tour-body">${step.body()}</p>${step.more && html`<p class="tour-more">${step.more}</p>`}`}
            ${skipAsk
              ? html`<div class="tour-actions tour-skip-ask" role="group" aria-label="Skip the tour?">
                  <span class="tour-skip-q"><strong>Skip the tour?</strong> You can replay it from the help menu.</span>
                  <button class="btn ghost sm" onClick=${() => (setSkipAsk(false), finish())}>Skip</button>
                  <button class="btn primary sm" data-primary onClick=${() => setSkipAsk(false)}>Keep going</button>
                </div>`
              : html`<div class="tour-actions">
                  <button class="link-btn muted-link" onClick=${skip}>Skip tour</button>
                  <span class="spacer"></span>
                  ${i > 0 && html`<button class="btn ghost sm" onClick=${() => go(i - 1)}><${Icon} name="left" size=${14} /> Back</button>`}
                  <button class="btn primary sm" ref=${nextBtn} onClick=${() => go(i + 1)}>${last ? 'Finish' : 'Next'} ${!last && html`<${Icon} name="right" size=${14} />`}</button>
                </div>`}
    </div>
  </div>`;
}

/** Small floating hint with "don't show again". */
export function Tip() {
  const tip = store.use((s) => s.tip);
  if (!tip) return null;
  return html`<div class="tip" role="status" key=${tip.id}>
    <span class="tip-icon"><${Icon} name="keyboard" size=${16} /></span>
    <p>${tip.text}</p>
    <div class="tip-actions">
      <button class="link-btn muted-link" onClick=${() => dismissTip(true)}>Don't show again</button>
      <button class="btn primary sm" onClick=${() => dismissTip()}>Got it</button>
    </div>
  </div>`;
}
