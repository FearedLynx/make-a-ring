// Guided tours: one element is spotlit and underlined, everything else is shaded.
// Skippable, but skipping asks once more because the tour teaches the shortcuts.
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { html } from '../lib/html.js';
import { Icon } from './ui.js';
import { store, endTour, dismissTip } from '../state.js';

const touch = () => document.documentElement.dataset.input === 'touch';
const K = (k) => html`<kbd>${k}</kbd>`;

export const TOURS = {
  studio: [
    {
      target: '.cross-center',
      title: 'This is your ring',
      body: () => (touch() ? 'Drag to rotate it and pinch to zoom.' : html`Drag to rotate it. Scroll or use ${K('+')} ${K('−')} to zoom, ${K('R')} resets the view.`),
      more: 'Every change you make anywhere shows up here instantly.',
    },
    {
      target: '.cross-top',
      title: 'Middle patterns scroll up and down',
      body: () => (touch() ? 'Swipe the top or bottom card, or tap it.' : html`Click the cards above and below the ring, or press ${K('↑')} ${K('↓')}.`),
      more: 'The middle runs along the centre of the band, so it scrolls the same way.',
    },
    {
      target: '.cross-right',
      title: 'Side patterns scroll left and right',
      body: () => (touch() ? 'Swipe the side cards, or tap them.' : html`Click the side cards, or press ${K('←')} ${K('→')}.`),
      more: 'Both sides change together until you unlink them.',
    },
    {
      target: '.link-group',
      title: 'Matched or mixed sides',
      body: () => (touch() ? 'Tap to unlink, then choose which side you are styling.' : html`${K('L')} links or unlinks the sides. When unlinked, ${K('S')} switches between left and right.`),
    },
    {
      target: '.band-map-wrap',
      title: 'The unrolled band',
      body: () => 'This is the ring laid flat, exactly as it will be made. Click a zone to filter the library to it. Drag the handles on the zone edges to make the sides or middle bigger.',
    },
    {
      target: '.rail.library',
      title: 'Find anything faster',
      body: () => (touch() ? 'Search every pattern and template here instead of scrolling.' : html`Search every pattern with ${K('/')}. ${K('[')} hides this panel; drag its edge to resize it.`),
    },
    {
      target: '.draw-btn',
      title: 'Draw your own pattern',
      body: () => (touch() ? 'Sketch one tile and it repeats around the whole ring.' : html`Sketch one tile and it repeats around the whole ring. Shortcut: ${K('D')}.`),
    },
    {
      target: '#spec-layout',
      title: 'Layout and proportions',
      body: () => 'Choose which zones the ring has, then set how wide the sides are compared to the middle.',
    },
    {
      target: '#spec-checks',
      title: 'Printability, checked live',
      body: () => 'Thin walls, fine lines and deep engravings are flagged for the material you pick. Each warning has a one-click fix.',
    },
    {
      target: '.price-card',
      title: 'Price and next step',
      body: () => (touch() ? 'When you like it, try it on a hand.' : html`When you like it, try it on a hand. Press ${K('?')} any time to see every shortcut.`),
    },
  ],
  editor: [
    {
      target: '.ed-canvas',
      title: 'Draw one tile',
      body: () => 'Whatever you draw here repeats around the ring. The faded copies on either side show where the next tiles join.',
      more: touch() ? null : 'Keyboard: arrow keys move the cursor, Enter places a point, Esc finishes a line.',
    },
    {
      target: '.ed-tools',
      title: 'Tools',
      body: () => (touch() ? 'Pen, line, square, circle, dot, move and eraser.' : html`${K('P')} pen · ${K('L')} line · ${K('S')} square · ${K('C')} circle · ${K('D')} dot · ${K('V')} move · ${K('E')} eraser`),
      more: 'Mirror copies your strokes across the tile, so symmetric patterns are quick.',
    },
    {
      target: '.ed-steady',
      title: 'Steady',
      body: () => 'Wobbly hand? Steady smooths each pen line after you lift the pen. Set how strongly it corrects.',
    },
    {
      target: '.ed-view',
      title: 'Zoom and grid',
      body: () => (touch() ? 'Zoom in for detail and hide the grid when you want a clean view.' : html`Zoom with ${K('+')} ${K('−')} or Ctrl + scroll; ${K('0')} fits the tile. ${K('G')} shows or hides the grid, ${K('N')} toggles snapping.`),
    },
    {
      target: '.ed-weight',
      title: 'Line weight, with real limits',
      body: () => 'Set the line thickness in millimetres. If it gets thinner than your material can print, you will see a warning straight away.',
    },
    {
      target: '.ed-preview',
      title: 'Live on your ring',
      body: () => 'Your tile is wrapped onto the ring as you draw. Save it and it joins your library and the carousels.',
    },
  ],
};

function placeCard(r, card) {
  const m = 14, vw = innerWidth, vh = innerHeight;
  const cw = card?.offsetWidth || 340, ch = card?.offsetHeight || 200;
  let top, left;
  if (r.bottom + m + ch < vh) top = r.bottom + m;
  else if (r.top - m - ch > 0) top = r.top - m - ch;
  else top = Math.max(m, Math.min(vh - ch - m, r.top + r.height / 2 - ch / 2));
  if (top === r.bottom + m || top === r.top - m - ch) left = r.left + r.width / 2 - cw / 2;
  else left = r.right + m + cw < vw ? r.right + m : r.left - m - cw;
  return { top, left: Math.max(m, Math.min(vw - cw - m, left)) };
}

export function Tour() {
  const tour = store.use((s) => s.tour);
  const [rect, setRect] = useState(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [skipAsk, setSkipAsk] = useState(false);
  const card = useRef();
  const nextBtn = useRef();

  const steps = tour ? (TOURS[tour.id] || []).filter((st) => {
    const el = document.querySelector(st.target);
    return el && el.getClientRects().length;
  }) : [];
  const i = tour ? Math.min(tour.step, steps.length - 1) : 0;
  const step = steps[i];

  const go = (n) => {
    setSkipAsk(false);
    if (n >= steps.length) return endTour();
    store.set({ tour: { ...tour, step: Math.max(0, n) } });
  };

  // Follow the target while it moves (scrolling, resizing, layout changes).
  useEffect(() => {
    if (!step) return;
    document.body.classList.add('tour-open');
    dismissTip();
    const el = document.querySelector(step.target);
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
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
  useEffect(() => setSkipAsk(false), [tour?.id]);
  useEffect(() => {
    if (!tour) document.body.classList.remove('tour-open');
  }, [tour]);

  useLayoutEffect(() => {
    if (rect) setPos(placeCard(rect, card.current));
  }, [rect, skipAsk, i]);

  useEffect(() => {
    if (step) requestAnimationFrame(() => (card.current?.querySelector('[data-primary]') || nextBtn.current)?.focus());
  }, [i, skipAsk, !!step]);

  useEffect(() => {
    if (!tour) return;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setSkipAsk((v) => !v);
      } else if ((e.key === 'ArrowRight' || e.key === 'Enter') && !skipAsk && !e.target.closest?.('button')) {
        e.preventDefault();
        e.stopPropagation();
        go(i + 1);
      } else if (e.key === 'ArrowRight' && !skipAsk) {
        e.preventDefault();
        e.stopPropagation();
        go(i + 1);
      } else if (e.key === 'ArrowLeft' && !skipAsk) {
        e.preventDefault();
        e.stopPropagation();
        go(i - 1);
      } else if (e.key === 'Tab') {
        const f = [...(card.current?.querySelectorAll('button') || [])];
        if (!f.length) return;
        e.preventDefault();
        e.stopPropagation();
        const k = f.indexOf(document.activeElement);
        f[(k + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
      } else if (!e.ctrlKey && !e.metaKey) {
        // Swallow other keys so the studio shortcuts don't fire underneath.
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [tour, i, skipAsk, steps.length]);

  if (!tour || !step || !rect) return null;
  const pad = 6;
  const spot = { top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 };
  const last = i === steps.length - 1;

  return html`<div class="tour" role="dialog" aria-modal="true" aria-labelledby="tour-title" aria-describedby="tour-body">
    <svg class="tour-shade" aria-hidden="true" onClick=${(e) => e.stopPropagation()}>
      <defs>
        <mask id="tour-mask">
          <rect x="0" y="0" width="100%" height="100%" fill="white" />
          <rect x=${spot.left} y=${spot.top} width=${spot.width} height=${spot.height} rx="10" fill="black" />
        </mask>
      </defs>
      <rect x="0" y="0" width="100%" height="100%" class="tour-shade-fill" mask="url(#tour-mask)" />
    </svg>
    <div class="tour-spot" style=${`top:${spot.top}px;left:${spot.left}px;width:${spot.width}px;height:${spot.height}px`}>
      <span class="tour-underline" key=${i}></span>
      <span class="tour-tick tl"></span><span class="tour-tick tr"></span><span class="tour-tick bl"></span><span class="tour-tick br"></span>
    </div>
    <div class="tour-card" ref=${card} style=${`top:${pos.top}px;left:${pos.left}px`}>
      ${skipAsk
        ? html`<div class="tour-head"><span class="tour-count">Skip?</span></div>
            <h2 id="tour-title">Skip the tour?</h2>
            <p id="tour-body">We recommend finishing it. It's ${steps.length} short steps and shows the shortcuts that make this much faster. You can replay it any time from the help menu.</p>
            <div class="tour-actions">
              <button class="btn ghost sm" onClick=${() => endTour()}>Skip anyway</button>
              <span class="spacer"></span>
              <button class="btn primary sm" data-primary onClick=${() => setSkipAsk(false)}>Continue tour</button>
            </div>`
        : html`<div class="tour-head">
              <span class="tour-count">${String(i + 1).padStart(2, '0')} / ${String(steps.length).padStart(2, '0')}</span>
              <div class="tour-progress" aria-hidden="true">${steps.map((_, k) => html`<span class=${k <= i ? 'on' : ''}></span>`)}</div>
            </div>
            <h2 id="tour-title">${step.title}</h2>
            <p id="tour-body">${step.body()}</p>
            ${step.more && html`<p class="tour-more">${step.more}</p>`}
            <div class="tour-actions">
              <button class="link-btn muted-link" onClick=${() => setSkipAsk(true)}>Skip tour</button>
              <span class="spacer"></span>
              ${i > 0 && html`<button class="btn ghost sm" onClick=${() => go(i - 1)}><${Icon} name="left" size=${14} /> Back</button>`}
              <button class="btn primary sm" ref=${nextBtn} onClick=${() => go(i + 1)}>${last ? 'Start designing' : 'Next'} ${!last && html`<${Icon} name="right" size=${14} />`}</button>
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
