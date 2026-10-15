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
