// Library rail: quick search across all patterns and templates (faster than scrolling the carousel).
import { useState } from 'preact/hooks';
import { html } from '../lib/html.js';
import { Icon, Segmented } from './ui.js';
import { PatternArt } from './pattern-art.js';
import { TemplateCard } from './template-card.js';
import { TAGS, PATTERNS } from '../lib/patterns.js';
import { TEMPLATES, hasMiddle, hasSides } from '../lib/templates.js';
import { store, setPattern, setRails, applyTemplate, deleteCustomPattern } from '../state.js';
import { RailStrip } from './rail-strip.js';

const zoneBadge = { middle: 'Middle', side: 'Sides', any: 'Anywhere' };

function targetZone(p, libZone, design, activeSide) {
  const side = design.linked ? 'sideL' : activeSide;
  if (p.zone === 'middle') return 'middle';
  if (p.zone === 'side') return side;
  if (libZone === 'side') return side;
  if (libZone === 'middle') return 'middle';
  return hasMiddle(design.layout) ? 'middle' : side;
}

function PatternTile({ p, design, activeSide, libZone, onEdit }) {
  const used = Object.entries(design.patterns).filter(([, id]) => id === p.id).map(([z]) => z);
  const zone = targetZone(p, libZone, design, activeSide);
  const blocked = (zone === 'middle' && !hasMiddle(design.layout)) || (zone !== 'middle' && !hasSides(design.layout));
  return html`<li class=${'lib-tile' + (used.length ? ' used' : '')}>
    <button class="lib-tile-main" onClick=${() => setPattern(zone, p.id)} disabled=${blocked}
      aria-label=${`${p.name}. Apply to ${zone === 'middle' ? 'middle' : 'sides'}${used.length ? '. In use' : ''}`}
      title=${blocked ? 'This layout has no zone for this pattern' : ''}>
      <${PatternArt} pattern=${p} layout="strip" repeats=${p.aspect < 0.7 ? 5 : 3} />
      <span class="lib-tile-name">${p.name}</span>
      <span class="lib-tile-zone">${p.custom ? 'Yours · ' : ''}${zoneBadge[p.zone]}</span>
      ${used.length > 0 && html`<span class="lib-used" aria-hidden="true"><${Icon} name="check" size=${12} /></span>`}
    </button>
    ${p.zone === 'any' && !p.custom &&
    html`<div class="lib-tile-actions">
      <button disabled=${!hasMiddle(design.layout)} onClick=${() => setPattern('middle', p.id)}>Middle</button>
      <button disabled=${!hasSides(design.layout)} onClick=${() => setPattern(design.linked ? 'sideL' : activeSide, p.id)}>Sides</button>
    </div>`}
    ${p.custom &&
    html`<div class="lib-tile-actions">
      <button onClick=${() => onEdit(p)}><${Icon} name="pen" size=${13} /> Edit</button>
      <button onClick=${() => deleteCustomPattern(p.id)} aria-label=${`Delete ${p.name}`}><${Icon} name="trash" size=${13} /></button>
    </div>`}
  </li>`;
}

export const LIB_CATS = [
  { id: 'patterns', label: 'Patterns', icon: 'pattern' },
  { id: 'mine', label: 'My patterns', icon: 'pen' },
  { id: 'templates', label: 'Templates', icon: 'layers' },
];

/** The category strip for the library panel; My patterns shows how many you have. */
export function LibStrip() {
  const rails = store.use((s) => s.rails);
  const custom = store.use((s) => s.customPatterns);
  const items = LIB_CATS.map((c) => (c.id === 'mine' && custom.length ? { ...c, badge: { level: 'count', text: `${custom.length} saved`, short: custom.length } } : c));
  return html`<${RailStrip} side="lib" label="Library categories" items=${items} value=${rails.libCat || 'patterns'} open=${rails.libOpen}
    onPick=${(id) => setRails({ libCat: id, libOpen: true })} />`;
}

export function Library({ onDraw, onHide }) {
  const design = store.use((s) => s.design);
  const activeSide = store.use((s) => s.activeSide);
  const custom = store.use((s) => s.customPatterns);
  const libZone = store.use((s) => s.libZone);
  const tab = store.use((s) => s.rails.libCat) || 'patterns';
  const [q, setQ] = useState('');
  const [tag, setTag] = useState(null);

  const match = (p) => {
    if (libZone === 'middle' && p.zone === 'side') return false;
    if (libZone === 'side' && p.zone === 'middle') return false;
    if (tag && !(p.tags || []).includes(tag)) return false;
    if (!q) return true;
    const hay = `${p.name} ${(p.tags || []).join(' ')} ${zoneBadge[p.zone]}`.toLowerCase();
    return q.toLowerCase().split(/\s+/).every((w) => hay.includes(w));
  };
  const mine = custom.filter(match);
  const lib = PATTERNS.filter(match);

  const title = LIB_CATS.find((c) => c.id === tab)?.label;
  const tile = (p) => html`<${PatternTile} key=${p.id} p=${p} design=${design} activeSide=${activeSide} libZone=${libZone} onEdit=${(pp) => onDraw(pp)} />`;

  return html`<aside class="rail library" aria-label="Pattern and template library">
    <div class="rail-title">
      <span>${title}</span>
      ${onHide && html`<button class="rail-hide" onClick=${onHide} aria-label="Hide library panel" title="Hide panel ([)"><${Icon} name="panelL" size=${16} /></button>`}
    </div>

    ${tab === 'patterns' &&
      html`<div class="rail-body" id="lib-panel" role="tabpanel" aria-labelledby="lib-tab-patterns">
          <label class="search">
            <${Icon} name="search" size=${16} />
            <input id="lib-search" type="search" placeholder="Search patterns (/)" value=${q}
              onInput=${(e) => setQ(e.currentTarget.value)} aria-label="Search patterns" />
          </label>
          <${Segmented} label="Show patterns for" size="sm full" value=${libZone}
            options=${[{ value: 'all', label: 'All' }, { value: 'middle', label: 'Middle' }, { value: 'side', label: 'Sides' }]}
            onChange=${(v) => store.set({ libZone: v })} />
          <div class="tags" role="group" aria-label="Filter by style">
            ${TAGS.map((t) => html`<button class=${'tag' + (tag === t ? ' on' : '')} aria-pressed=${tag === t} onClick=${() => setTag(tag === t ? null : t)}>${t}</button>`)}
          </div>

          <h3 class="rail-h">${q || tag ? 'Results' : 'Library'} <span class="muted">${mine.length + lib.length}</span></h3>
          ${mine.length + lib.length
            ? html`<ul class="lib-grid">${mine.map(tile)}${lib.map(tile)}</ul>`
            : html`<div class="empty">
                <p>Nothing matches “${q}”${tag ? ` in ${tag}` : ''}.</p>
                <button class="btn ghost sm" onClick=${() => onDraw()}><${Icon} name="pen" size=${14} /> Draw it yourself</button>
              </div>`}
        </div>`}

    ${tab === 'mine' &&
      html`<div class="rail-body" id="lib-panel" role="tabpanel" aria-labelledby="lib-tab-mine">
          <ul class="lib-grid">
            <li class="lib-tile new">
              <button class="lib-tile-main" onClick=${() => onDraw()}>
                <span class="new-plus"><${Icon} name="plus" size=${22} /></span>
                <span class="lib-tile-name">Draw a pattern</span>
                <span class="lib-tile-zone">Mirror, repeat, done</span>
              </button>
            </li>
            ${custom.map(tile)}
          </ul>
          ${!custom.length && html`<p class="rail-note mine-empty">Patterns you draw are saved here, ready to edit or reuse on any ring.</p>`}
        </div>`}

    ${tab === 'templates' &&
      html`<div class="rail-body" id="lib-panel" role="tabpanel" aria-labelledby="lib-tab-templates">
          <p class="rail-note">Templates set the layout, patterns and material. Your size is kept.</p>
          <ul class="tpl-list">
            ${TEMPLATES.map((t) => {
              return html`<li><${TemplateCard} t=${t} sizeUS=${design.sizeUS} on=${design.templateId === t.id} onClick=${() => applyTemplate(t.id)} /></li>`;
            })}
          </ul>
        </div>`}
  </aside>`;
}
