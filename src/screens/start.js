import { useState } from 'preact/hooks';
import { html } from '../lib/html.js';
import { Icon, Logo } from '../components/ui.js';
import { TemplateCard, SavedCard } from '../components/template-card.js';
import { HomeButton } from '../components/topbar.js';
import { SizeDrawing } from '../components/size-drawing.js';
import { tape } from '../lib/sound.js';
import { TEMPLATES } from '../lib/templates.js';
import { sizeSummary, fmtUs } from '../lib/sizes.js';
import { store, go, transition, applyTemplate, setDesign, openSavedDesign, deleteSavedDesign, duplicateSavedDesign } from '../state.js';

export function Start() {
  const design = store.use((s) => s.design);
  const [step, setStep] = useState(1);
  const saved = store.use((s) => s.savedDesigns);
  const currentSaved = store.use((s) => s.currentSaved);
  // `picked` is a template id, or "mine:<id>" for one of My designs.
  const [picked, setPicked] = useState(currentSaved && saved.some((x) => x.id === currentSaved) ? `mine:${currentSaved}` : design.templateId || 'heritage');
  const size = sizeSummary(design.sizeUS);
  const [preview, setPreview] = useState(null); // size pill under the pointer or focus: shown as a ghost ring

  // One of your saved rings already has its size, so it opens straight in the studio; a template asks for it.
  const next = () => {
    if (picked.startsWith('mine:')) {
      openSavedDesign(picked.slice(5), { silent: true });
      return go('studio');
    }
    applyTemplate(picked, { silent: true });
    toStep(2);
  };
  const toStep = (n) =>
    transition(n > step ? 'forward' : 'back', () => {
      setStep(n);
      window.scrollTo(0, 0);
    });

  return html`<div class="start">
    <header class="landing-nav">
      <div class="topbar-left"><${Logo} /><${HomeButton} /></div>
      <ol class="start-steps" aria-label="Setup progress">
        <li class=${step === 1 ? 'on' : 'done'} aria-current=${step === 1 ? 'step' : undefined}>1 · Starting point</li>
        <li class=${step === 2 ? 'on' : ''} aria-current=${step === 2 ? 'step' : undefined}>2 · Your size</li>
      </ol>
      <button class="btn ghost sm" onClick=${() => go('studio')}>Skip to studio</button>
    </header>

    <main id="main" class="start-main">
      ${step === 1 &&
      html`<section>
        <h1 class="screen-title">Pick a starting point</h1>
        <p class="lead">Every template can be changed completely later: patterns, layout, material, everything.</p>
        ${saved.length > 0 &&
        html`<h2 class="start-sub">Continue one of yours</h2>
          <div class="tpl-grid" role="radiogroup" aria-label="My designs">
            ${saved.map((e) => html`<${SavedCard} key=${e.id} entry=${e} big role="radio" on=${picked === `mine:${e.id}`}
              onClick=${() => setPicked(`mine:${e.id}`)} onDblClick=${next}
              onDelete=${() => (picked === `mine:${e.id}` && setPicked('heritage'), deleteSavedDesign(e.id))}
              onDuplicate=${() => duplicateSavedDesign(e.id)} />`)}
          </div>
          <h2 class="start-sub">Or start from a template</h2>`}
        <div class="tpl-grid" role="radiogroup" aria-label="Templates">
          ${TEMPLATES.map((t) => {
            return html`<${TemplateCard} t=${t} sizeUS=${design.sizeUS} big role="radio" on=${picked === t.id}
              onClick=${() => setPicked(t.id)} onDblClick=${next} />`;
          })}
        </div>
        <div class="step-nav sticky">
          <div class="spacer"></div>
          <button class="btn primary lg" onClick=${next}>${picked.startsWith('mine:') ? 'Open in the studio' : 'Continue'} <${Icon} name="right" size=${18} /></button>
        </div>
      </section>`}

      ${step === 2 &&
      html`<section class="size-step">
        <h1 class="screen-title">What's your ring size?</h1>
        <p class="lead">Not sure? Use the finder. You can also change it any time in the studio.</p>
        <div class="size-hero">
          <span class="size-big">US ${size.us}</span>
          <span class="size-alt">EU ${size.eu} · UK ${size.uk} · Ø ${size.diameter.toFixed(1)} mm</span>
        </div>
        <${SizeDrawing} sizeUS=${design.sizeUS} previewUS=${preview} onChange=${(v) => setDesign({ sizeUS: v })} />
        <div class="size-chips" role="radiogroup" aria-label="Common sizes">
          ${[4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10, 10.5, 11, 11.5, 12, 13].map(
            (v) => html`<button role="radio" aria-checked=${design.sizeUS === v} class=${'chip' + (design.sizeUS === v ? ' on' : '')}
              onClick=${() => (v !== design.sizeUS && tape(design.sizeUS, v), setDesign({ sizeUS: v }))}
              onPointerEnter=${(e) => e.pointerType === 'mouse' && setPreview(v)} onPointerLeave=${() => setPreview(null)}
              onFocus=${() => setPreview(v)} onBlur=${() => setPreview(null)}>${fmtUs(v)}</button>`
          )}
        </div>
        <button class="btn ghost" onClick=${() => store.set({ sizeFinderOpen: true })}><${Icon} name="ruler" size=${16} /> Help me find my size</button>
        <div class="step-nav">
          <button class="btn ghost" onClick=${() => toStep(1)}><${Icon} name="left" size=${16} /> Back</button>
          <div class="spacer"></div>
          <button class="btn primary lg" onClick=${() => go('studio')}>Open the studio <${Icon} name="right" size=${18} /></button>
        </div>
      </section>`}
    </main>
  </div>`;
}
