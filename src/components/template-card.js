import { html } from '../lib/html.js';
import { Icon } from './ui.js';
import { LAYOUTS, designFromTemplate } from '../lib/templates.js';
import { getMaterial } from '../lib/materials.js';
import { estimate, money } from '../lib/checks.js';
import { useThumbnail } from '../lib/thumbnails.js';
import { patternById } from '../state.js';

export function TemplateCard({ t, sizeUS, on, onClick, onDblClick, big = false, role }) {
  const d = designFromTemplate(t.id, { sizeUS });
  const thumb = useThumbnail(`tpl-${t.id}`, designFromTemplate(t.id), patternById);
  return html`<button role=${role} aria-checked=${role === 'radio' ? on : undefined} aria-pressed=${role ? undefined : on}
    class=${'tpl-card' + (big ? ' big' : '') + (on ? ' on' : '')} onClick=${onClick} onDblClick=${onDblClick}>
    <span class="tpl-thumb">${thumb ? html`<img src=${thumb} alt="" />` : html`<span class="tpl-thumb-loading"></span>`}</span>
    <span class="tpl-name">${t.name}</span>
    <span class="tpl-meta">${LAYOUTS[t.layout].name} · ${getMaterial(t.materialId).name}${big ? ` · from ${money(estimate(d).total)}` : ''}</span>
    <span class="tpl-blurb">${t.blurb}</span>
    ${on && html`<span class="tpl-check"><${Icon} name="check" size=${14} /></span>`}
  </button>`;
}

const savedWhen = (t) => {
  if (!t) return '';
  const d = new Date(t);
  return d.toDateString() === new Date().toDateString()
    ? `today ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : d.toLocaleDateString([], { day: 'numeric', month: 'short' });
};

/** A design from My designs: same card as a template, plus when it was saved and a delete button. */
export function SavedCard({ entry, on, onClick, onDblClick, onDelete, big = false, role }) {
  const d = entry.design;
  const thumb = useThumbnail(`mine-${entry.id}-${entry.savedAt}`, d, patternById);
  return html`<div class=${'saved-card-wrap' + (big ? ' big' : '')}>
    <button role=${role} aria-checked=${role === 'radio' ? on : undefined} aria-pressed=${role ? undefined : on}
      class=${'tpl-card mine' + (big ? ' big' : '') + (on ? ' on' : '')} onClick=${onClick} onDblClick=${onDblClick}>
      <span class="tpl-thumb">${thumb ? html`<img src=${thumb} alt="" />` : html`<span class="tpl-thumb-loading"></span>`}</span>
      <span class="tpl-name">${entry.name}</span>
      <span class="tpl-meta">${LAYOUTS[d.layout]?.name || ''} · ${getMaterial(d.materialId).name}${big ? ` · ${money(estimate(d).total)}` : ''}</span>
      <span class="tpl-blurb">Yours · saved ${savedWhen(entry.savedAt)}</span>
      ${on && html`<span class="tpl-check"><${Icon} name="check" size=${14} /></span>`}
    </button>
    ${onDelete && html`<button class="saved-del icon-btn sm" onClick=${onDelete} aria-label=${`Delete ${entry.name}`} title="Delete"><${Icon} name="trash" size=${14} /></button>`}
  </div>`;
}
