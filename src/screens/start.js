import { useState } from 'preact/hooks';
import { html } from '../lib/html.js';
import { Icon, Logo } from '../components/ui.js';
import { TemplateCard } from '../components/template-card.js';
import { TEMPLATES } from '../lib/templates.js';
import { sizeSummary, fmtUs } from '../lib/sizes.js';
import { store, go, applyTemplate, setDesign } from '../state.js';

export function Start() {
  const design = store.use((s) => s.design);
  const [step, setStep] = useState(1);
  const [picked, setPicked] = useState(design.templateId || 'heritage');
  const size = sizeSummary(design.sizeUS);

  const next = () => {
    applyTemplate(picked, { silent: true });
    setStep(2);
    window.scrollTo(0, 0);
  };

  return html`<div class="start">
    <header class="landing-nav">
      <${Logo} />
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
        <div class="tpl-grid" role="radiogroup" aria-label="Templates">
          ${TEMPLATES.map((t) => {
            return html`<${TemplateCard} t=${t} sizeUS=${design.sizeUS} big role="radio" on=${picked === t.id}
              onClick=${() => setPicked(t.id)} onDblClick=${next} />`;
          })}
        </div>
        <div class="step-nav sticky">
          <div class="spacer"></div>
          <button class="btn primary lg" onClick=${next}>Continue <${Icon} name="right" size=${18} /></button>
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
        <div class="size-chips" role="radiogroup" aria-label="Common sizes">
          ${[4, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 10, 11, 12].map(
            (v) => html`<button role="radio" aria-checked=${design.sizeUS === v} class=${'chip' + (design.sizeUS === v ? ' on' : '')}
              onClick=${() => setDesign({ sizeUS: v })}>${fmtUs(v)}</button>`
          )}
        </div>
        <button class="btn ghost" onClick=${() => store.set({ sizeFinderOpen: true })}><${Icon} name="ruler" size=${16} /> Help me find my size</button>
        <div class="step-nav">
          <button class="btn ghost" onClick=${() => setStep(1)}><${Icon} name="left" size=${16} /> Back</button>
          <div class="spacer"></div>
          <button class="btn primary lg" onClick=${() => go('studio')}>Open the studio <${Icon} name="right" size=${18} /></button>
        </div>
      </section>`}
    </main>
  </div>`;
}
