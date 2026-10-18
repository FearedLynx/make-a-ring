import { useEffect, useRef, useState } from 'preact/hooks';
import { html } from '../lib/html.js';
import { TopBar } from '../components/topbar.js';
import { Stage } from '../components/stage.js';
import { Library, LibStrip } from '../components/library.js';
import { Specs, SpecStrip } from '../components/specs.js';
import { store, setRails, startTour, tourDone, RAIL_DEFAULTS } from '../state.js';

const MIN = 240, MAX = 520;
const uiScaleNow = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui')) || 1;

/** Drag handle on the inner edge of a side panel. `side` is 'lib' (left) or 'spec' (right). */
function Resizer({ side }) {
  const rails = store.use((s) => s.rails);
  const start = useRef(null);
  const key = side === 'lib' ? 'lib' : 'spec';
  const set = (w) => setRails({ [key]: Math.round(Math.min(MAX, Math.max(MIN, w))) });
  return html`<div class=${'rail-resize ' + side} role="separator" aria-orientation="vertical" tabindex="0"
    aria-label=${side === 'lib' ? 'Resize library panel' : 'Resize specs panel'}
    aria-valuemin=${MIN} aria-valuemax=${MAX} aria-valuenow=${rails[key]}
    onPointerDown=${(e) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      start.current = { x: e.clientX, w: rails[key] };
      document.body.classList.add('resizing');
    }}
    onPointerMove=${(e) => {
      if (!start.current) return;
      const dx = (e.clientX - start.current.x) / uiScaleNow(); // widths are kept in unscaled pixels
      set(start.current.w + (side === 'lib' ? dx : -dx));
    }}
    onPointerUp=${() => {
      start.current = null;
      document.body.classList.remove('resizing');
    }}
    onDblClick=${() => set(RAIL_DEFAULTS[key])}
    onKeyDown=${(e) => {
      const d = { ArrowLeft: -16, ArrowRight: 16 }[e.key];
      if (d) (e.preventDefault(), e.stopPropagation(), set(rails[key] + (side === 'lib' ? d : -d)));
    }}></div>`;
}

// Width of the category strip on the outer edge of each panel. It stays when the panel is hidden.
const STRIP = 44;

export function Studio() {
  const [panel, setPanel] = useState('specs');
  const rails = store.use((s) => s.rails);
  const openEditor = (base) => store.set({ editor: { base, zone: store.get().libZone === 'side' ? 'side' : 'middle' } });

  useEffect(() => {
    const onKey = (e) => {
      if (document.body.classList.contains('modal-open')) return;
      if (e.target.closest?.('input, textarea, select')) return;
      if (e.key === '/') {
        e.preventDefault();
        setPanel('library');
        setRails({ libOpen: true, libCat: 'patterns' });
        requestAnimationFrame(() => document.getElementById('lib-search')?.focus());
      } else if (e.key === '[') {
        setRails({ libOpen: !store.get().rails.libOpen });
      } else if (e.key === ']') {
        setRails({ specOpen: !store.get().rails.specOpen });
      }
    };
    window.addEventListener('keydown', onKey);
    // First visit: walk through the studio.
    // (not while the pattern editor is open, e.g. arriving from "Draw your own": the editor has its own tour)
    const t = !tourDone('studio') && setTimeout(() => !store.get().editor && startTour('studio'), 700);
    return () => {
      window.removeEventListener('keydown', onKey);
      clearTimeout(t);
    };
  }, []);

  // Panel widths scale with the fit-to-screen UI scale (--ui), like everything drawn inside them.
  const px = (n) => `calc(${n}px * var(--ui))`;
  const cols = `${px(rails.libOpen ? rails.lib + STRIP : STRIP)} minmax(0, 1fr) ${px(rails.specOpen ? rails.spec + STRIP : STRIP)}`;
  return html`<div class="app-shell">
    <${TopBar} />
    <main class=${'studio panel-' + panel} id="main" style=${`--studio-cols:${cols}`}>
      <div class=${'rail-wrap lib' + (rails.libOpen ? '' : ' collapsed')}>
        <${LibStrip} />
        ${rails.libOpen && html`<${Library} onDraw=${openEditor} onHide=${() => setRails({ libOpen: false })} /><${Resizer} side="lib" />`}
      </div>
      <${Stage} onDraw=${() => openEditor()} />
      <div class=${'rail-wrap spec' + (rails.specOpen ? '' : ' collapsed')}>
        ${rails.specOpen && html`<${Resizer} side="spec" /><${Specs} onHide=${() => setRails({ specOpen: false })} />`}
        <${SpecStrip} />
      </div>
      <nav class="mobile-tabs" aria-label="Studio panels">
        <button class=${panel === 'library' ? 'on' : ''} aria-pressed=${panel === 'library'} onClick=${() => (setPanel('library'), setRails({ libOpen: true }))}>Patterns & templates</button>
        <button class=${panel === 'specs' ? 'on' : ''} aria-pressed=${panel === 'specs'} onClick=${() => (setPanel('specs'), setRails({ specOpen: true }))}>Size, material & checks</button>
      </nav>
    </main>
  </div>`;
}
