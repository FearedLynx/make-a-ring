import { useEffect, useRef } from 'preact/hooks';
import { html } from '../lib/html.js';
import { store } from '../state.js';

const P = {
  home: 'M3.5 11 12 4l8.5 7M6 9.5V20h12V9.5M10 20v-5.5h4V20',
  up: 'M12 19V5M5 12l7-7 7 7',
  down: 'M12 5v14M5 12l7 7 7-7',
  left: 'M19 12H5M12 5l-7 7 7 7',
  right: 'M5 12h14M12 5l7 7-7 7',
  chevL: 'M15 18l-6-6 6-6',
  chevR: 'M9 18l6-6-6-6',
  link: 'M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5',
  unlink: 'M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07M4 4l16 16',
  pen: 'M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM21 21l-4.35-4.35',
  x: 'M18 6 6 18M6 6l12 12',
  check: 'M20 6 9 17l-5-5',
  alert: 'M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z',
  info: 'M12 16v-4M12 8h.01M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z',
  reset: 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5',
  spin: 'M21 12a9 9 0 1 1-6.2-8.56M21 3v6h-6',
  hand: 'M18 11V6a2 2 0 0 0-4 0v5M14 10V4a2 2 0 0 0-4 0v6M10 10.5V6a2 2 0 0 0-4 0v8M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15',
  download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
  share: 'M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13',
  ruler: 'M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0ZM14.5 12.5l2-2M11.5 9.5l2-2M8.5 6.5l2-2M17.5 15.5l2-2',
  sparkle: 'M12 3l1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2Z',
  keyboard: 'M2 6h20v12H2ZM6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10',
  trash: 'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6',
  undo: 'M3 7v6h6M21 17a9 9 0 0 0-15-6.7L3 13',
  redo: 'M21 7v6h-6M3 17a9 9 0 0 1 15-6.7L21 13',
  eraser: 'M7 21h10M5.5 13.5l7-7a2 2 0 0 1 2.8 0l3.2 3.2a2 2 0 0 1 0 2.8L11 20H7.5l-2-2a2 2 0 0 1 0-2.8Z',
  line: 'M5 19 19 5M5 19h.01M19 5h.01',
  circle: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z',
  dot: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  grid: 'M3 3h18v18H3ZM3 9h18M3 15h18M9 3v18M15 3v18',
  mirrorH: 'M12 3v18M8 7 3 12l5 5M16 7l5 5-5 5',
  mirrorV: 'M3 12h18M7 8l5-5 5 5M7 16l5 5 5-5',
  upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  help: 'M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z',
  panelL: 'M3 4h18v16H3ZM9 4v16M15 10l-2 2 2 2',
  panelR: 'M3 4h18v16H3ZM15 4v16M9 10l2 2-2 2',
  square: 'M5 5h14v14H5Z',
  move: 'M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20',
  steady: 'M3 17c3-6 6 2 9-4s6-6 9-2',
  fit: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  layers: 'M12 2 2 7l10 5 10-5ZM2 17l10 5 10-5M2 12l10 5 10-5',
  swatch: 'M12 22a10 10 0 1 1 10-10c0 2.5-2 3-3.5 3H16a2 2 0 0 0-1.5 3.3A2 2 0 0 1 12 22ZM7.5 10.5h.01M12 7.5h.01M16.5 10.5h.01',
  copy: 'M9 9h11v11H9ZM5 15H4V4h11v1',
  file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8ZM14 2v6h6',
  layout: 'M3 5h18v14H3ZM8 5v14M16 5v14',
  band: 'M3 18v-7c0-5 18-5 18 0v7Z',
  pattern: 'M3 5h18v14H3ZM3 13l3-3 3 3 3-3 3 3 3-3 3 3',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10ZM9 12l2 2 4-4',
  type: 'M4 7V5h16v2M9 19h6M12 5v14',
  save: 'M5 3h11l3 3v15H5ZM8 3v5h7V3M8 21v-7h8v7',
};

export function Icon({ name, size = 18, className = '' }) {
  if (name === 'eraser') {
    return html`<svg class=${'icon ' + className} width=${size} height=${size} viewBox="0 0 24 24" aria-hidden="true">
      <g transform="rotate(-45 12 12)">
        <rect x="3" y="8" width="18" height="8" rx="1.8" fill="none" stroke="currentColor" stroke-width="1.8" />
        <path d="M4.8 8h5.7v8H4.8A1.8 1.8 0 0 1 3 14.2V9.8A1.8 1.8 0 0 1 4.8 8Z" fill="#f08aa6" stroke="currentColor" stroke-width="1.8" />
      </g>
      <path d="M13 21h8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
    </svg>`;
  }
  return html`<svg class=${'icon ' + className} width=${size} height=${size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d=${P[name]} />
  </svg>`;
}

export function Logo({ onClick }) {
  return html`<a class="logo" href="#/landing" onClick=${onClick} aria-label="Make-a-Ring home">
    <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true">
      <ellipse cx="16" cy="17" rx="11" ry="11" fill="none" stroke="currentColor" stroke-width="3.2" />
      <path d="M16 2.5l3.2 3.6-3.2 3.6-3.2-3.6Z" fill="var(--accent)" />
    </svg>
    <span>Make<span class="logo-dash">-a-</span>Ring</span>
  </a>`;
}

export function Segmented({ label, value, options, onChange, size = '' }) {
  return html`<div class=${'segmented ' + size} role="radiogroup" aria-label=${label}>
    ${options.map(
      (o) => html`<button type="button" role="radio" aria-checked=${value === o.value} class=${value === o.value ? 'on' : ''}
        onClick=${() => onChange(o.value)} title=${o.title || ''}>
        ${o.icon && html`<${Icon} name=${o.icon} size=${16} />`}${o.node || o.label}
      </button>`
    )}
  </div>`;
}

export function Slider({ label, value, min, max, step, unit = 'mm', onInput, onCommit, format, hint, id }) {
  const sid = id || 'sl-' + label.replace(/\W+/g, '-').toLowerCase();
  const pct = ((value - min) / (max - min)) * 100;
  return html`<div class="slider">
    <div class="slider-head">
      <label for=${sid}>${label}</label>
      <output for=${sid}>${format ? format(value) : `${value}${unit ? ' ' + unit : ''}`}</output>
    </div>
    <input id=${sid} type="range" min=${min} max=${max} step=${step} value=${value} style=${`--pct:${pct}%`}
      onInput=${(e) => onInput(parseFloat(e.currentTarget.value))} onChange=${onCommit && ((e) => onCommit(parseFloat(e.currentTarget.value)))} />
    ${hint && html`<p class="hint">${hint}</p>`}
  </div>`;
}

export function Modal({ open, onClose, title, children, wide = false, className = '' }) {
  const ref = useRef();
  const prevFocus = useRef();
  useEffect(() => {
    if (!open) return;
    prevFocus.current = document.activeElement;
    const el = ref.current;
    requestAnimationFrame(() => (el?.querySelector('[autofocus]') || el?.querySelector('button, input, [tabindex]'))?.focus());
    const onKey = (e) => {
      if (e.key === 'Escape' && !e.defaultPrevented) {
        e.preventDefault();
        onClose();
      }
      if (e.key === 'Tab' && el) {
        const f = [...el.querySelectorAll('button:not([disabled]), input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])')];
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) (e.preventDefault(), last.focus());
        else if (!e.shiftKey && document.activeElement === last) (e.preventDefault(), first.focus());
      }
    };
    document.addEventListener('keydown', onKey);
    document.body.classList.add('modal-open');
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('modal-open');
      prevFocus.current?.focus?.();
    };
  }, [open]);
  if (!open) return null;
  return html`<div class="modal-backdrop" onMouseDown=${(e) => e.target === e.currentTarget && onClose()}>
    <div class=${`modal ${wide ? 'wide' : ''} ${className}`} role="dialog" aria-modal="true" aria-label=${title} ref=${ref}>
      <header class="modal-head">
        <h2>${title}</h2>
        <button class="icon-btn" onClick=${onClose} aria-label="Close"><${Icon} name="x" /></button>
      </header>
      <div class="modal-body">${children}</div>
    </div>
  </div>`;
}

export function Toast() {
  const t = store.use((s) => s.toast);
  if (!t) return null;
  return html`<div class="toast" role="status" key=${t.id}>
    <span>${t.msg}</span>
    ${t.action &&
    html`<button class="toast-action" onClick=${() => {
      t.action.run();
      store.set({ toast: null });
    }}>${t.action.label}</button>`}
  </div>`;
}

export function LiveRegion() {
  const msg = store.use((s) => s.announce);
  return html`<div class="sr-only" aria-live="polite" aria-atomic="true">${msg}</div>`;
}
