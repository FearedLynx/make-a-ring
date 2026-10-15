import { useEffect, useRef, useState } from 'preact/hooks';
import { html } from '../lib/html.js';
import { TopBar } from '../components/topbar.js';
import { Stage } from '../components/stage.js';
import { Library } from '../components/library.js';
import { Specs } from '../components/specs.js';
import { Icon } from '../components/ui.js';
import { store, setRails, startTour, tourDone } from '../state.js';

const MIN = 240, MAX = 520;

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
      const dx = e.clientX - start.current.x;
      set(start.current.w + (side === 'lib' ? dx : -dx));
    }}
    onPointerUp=${() => {
      start.current = null;
      document.body.classList.remove('resizing');
    }}
    onDblClick=${() => set(side === 'lib' ? 300 : 340)}
    onKeyDown=${(e) => {
      const d = { ArrowLeft: -16, ArrowRight: 16 }[e.key];
      if (d) (e.preventDefault(), e.stopPropagation(), set(rails[key] + (side === 'lib' ? d : -d)));
    }}></div>`;
}

function Collapsed({ side }) {
  const label = side === 'lib' ? 'Library' : 'Specs';
  return html`<button class=${'rail-collapsed ' + side} onClick=${() => setRails(side === 'lib' ? { libOpen: true } : { specOpen: true })}
    aria-label=${`Show ${label.toLowerCase()} panel`} title=${`Show ${label} (${side === 'lib' ? '[' : ']'})`}>
    <${Icon} name=${side === 'lib' ? 'panelL' : 'panelR'} size=${16} />
    <span>${label}</span>
  </button>`;
}

export function Studio() {
  const [panel, setPanel] = useState('specs');
  const rails = store.use((s) => s.rails);
  const openEditor = (base) => store.set({ editor: { base, zone: store.get().libZone === 'side' ? 'side' : 'middle' } });

  useEffect(() => {
    const onKey = (e) => {
      if (document.body.classList.contains('modal-open') || document.body.classList.contains('tour-open')) return;
      if (e.target.closest?.('input, textarea, select')) return;
      if (e.key === '/') {
        e.preventDefault();
        setPanel('library');
        setRails({ libOpen: true });
        requestAnimationFrame(() => document.getElementById('lib-search')?.focus());
      } else if (e.key === '[') {
        setRails({ libOpen: !store.get().rails.libOpen });
      } else if (e.key === ']') {
        setRails({ specOpen: !store.get().rails.specOpen });
      }
    };
    window.addEventListener('keydown', onKey);
    // First visit: walk through the studio.
    const t = !tourDone('studio') && setTimeout(() => startTour('studio'), 700);
    return () => {
      window.removeEventListener('keydown', onKey);
      clearTimeout(t);
    };
  }, []);

  const cols = `${rails.libOpen ? rails.lib + 'px' : '40px'} minmax(0, 1fr) ${rails.specOpen ? rails.spec + 'px' : '40px'}`;
  return html`<div class="app-shell">
    <${TopBar} />
    <main class=${'studio panel-' + panel} id="main" style=${`--studio-cols:${cols}`}>
      ${rails.libOpen
        ? html`<div class="rail-wrap lib">
            <${Library} onDraw=${openEditor} onHide=${() => setRails({ libOpen: false })} />
            <${Resizer} side="lib" />
          </div>`
        : html`<${Collapsed} side="lib" />`}
      <${Stage} onDraw=${() => openEditor()} />
      ${rails.specOpen
        ? html`<div class="rail-wrap spec">
            <${Resizer} side="spec" />
            <${Specs} onHide=${() => setRails({ specOpen: false })} />
          </div>`
        : html`<${Collapsed} side="spec" />`}
      <nav class="mobile-tabs" aria-label="Studio panels">
        <button class=${panel === 'library' ? 'on' : ''} aria-pressed=${panel === 'library'} onClick=${() => (setPanel('library'), setRails({ libOpen: true }))}>Patterns & templates</button>
        <button class=${panel === 'specs' ? 'on' : ''} aria-pressed=${panel === 'specs'} onClick=${() => (setPanel('specs'), setRails({ specOpen: true }))}>Size, material & checks</button>
      </nav>
    </main>
  </div>`;
}
