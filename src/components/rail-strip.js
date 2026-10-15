// Category strip on the outer edge of a side panel, like Blender's properties tabs.
// The panel shows one category at a time; with the panel hidden, the strip stays as a way back in.
// Clicking the active icon again hides the panel (desktop only: on smaller screens the strip is a row of tabs).
import { html } from '../lib/html.js';
import { Icon } from './ui.js';

/**
 * items: [{ id, label, icon, badge?: { text, level } }]
 * value: the active category; open: whether the panel is showing; onPick(id); onClose() hides the panel.
 */
const sidePanels = () => matchMedia('(min-width: 1024px)').matches;

export function RailStrip({ side, label, items, value, open, onPick, onClose }) {
  const onKey = (e) => {
    const d = { ArrowDown: 1, ArrowUp: -1 }[e.key];
    if (!d) return;
    e.preventDefault();
    e.stopPropagation();
    const i = items.findIndex((it) => it.id === value);
    const next = items[(i + d + items.length) % items.length];
    onPick(next.id);
    requestAnimationFrame(() => document.getElementById(`${side}-tab-${next.id}`)?.focus());
  };
  return html`<div class=${'rail-strip ' + side} role="tablist" aria-orientation="vertical" aria-label=${label} onKeyDown=${onKey}>
    ${items.map((it) => {
      const on = open && it.id === value;
      return html`<button id=${`${side}-tab-${it.id}`} role="tab" aria-selected=${on} aria-controls=${open ? `${side}-panel` : undefined}
        tabindex=${it.id === value ? 0 : -1} class=${'strip-tab' + (on ? ' on' : '')}
        title=${on && onClose ? `${it.label} (click again to hide)` : it.label} aria-label=${it.badge ? `${it.label}, ${it.badge.text}` : it.label}
        onClick=${() => (on && onClose && sidePanels() ? onClose() : onPick(it.id))}>
        <${Icon} name=${it.icon} size=${18} />
        <span class="strip-label" aria-hidden="true">${it.label}</span>
        ${it.badge && html`<span class=${'strip-badge ' + it.badge.level} aria-hidden="true">${it.badge.short ?? it.badge.text}</span>`}
      </button>`;
    })}
  </div>`;
}
