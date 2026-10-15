// Landing page, styled like a technical drawing sheet: oversized type, a live 3D part,
// dimension callouts and a title block. Full-bleed on desktop, stacked on phones.
import { useEffect, useRef, useState } from 'preact/hooks';
import { html } from '../lib/html.js';
import { Icon, Logo } from '../components/ui.js';
import { RingView } from '../components/ring-view.js';
import { PatternArt, BandMap } from '../components/pattern-art.js';
import { ThemeDots, GridToggle, SoundToggle } from '../components/topbar.js';
import { TEMPLATES, LAYOUTS, designFromTemplate } from '../lib/templates.js';
import { MATERIALS, getMaterial } from '../lib/materials.js';
import { PATTERNS } from '../lib/patterns.js';
import { sizeSummary } from '../lib/sizes.js';
import { estimate, money } from '../lib/checks.js';
import { go, patternById } from '../state.js';
import { DisplayTray } from '../components/display-tray.js';

const SHOWCASE = ['heritage', 'botanica', 'nordic', 'everwrap', 'twin-rails', 'solitaire'];
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const p = (id) => PATTERNS.find((x) => x.id === id);

function CrossDiagram() {
  return html`<div class="mini-cross" aria-hidden="true">
    <div class="mc top"><${PatternArt} pattern=${p('diamonds')} layout="column" repeats=${2} /></div>
    <div class="mc left"><${PatternArt} pattern=${p('vine-scroll')} layout="pair" repeats=${2} /></div>
    <div class="mc mid"><span class="mc-ring"></span></div>
    <div class="mc right"><${PatternArt} pattern=${p('scallop')} layout="pair" repeats=${3} /></div>
    <div class="mc bottom"><${PatternArt} pattern=${p('feather')} layout="column" repeats=${3} /></div>
    <span class="mc-arrow up">↑</span><span class="mc-arrow down">↓</span><span class="mc-arrow l">←</span><span class="mc-arrow r">→</span>
  </div>`;
}

function SectionBar({ n, title, meta }) {
  return html`<div class="lp-bar">
    <span class="lp-bar-n">§${n}</span>
    <h2>${title}</h2>
    <span class="lp-bar-meta">${meta}</span>
  </div>`;
}

const scrollTo = (id) => (e) => {
  e.preventDefault();
  document.getElementById(id)?.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth' });
};

const COST_ROUTES = [
  { id: 'home', short: 'Home print', label: 'Printed at home', ids: ['pla', 'resin', 'tpu'],
    text: 'Print it in PLA, resin or flexible TPU on your own printer for the cost of a little material. Electroplate it later in gold or silver if you want a metal look.' },
  { id: 'metal', short: 'Metal print', label: 'Metal 3D printed', ids: ['steel', 'titanium'],
    text: 'Send the same file to a metal 3D-printing service for stainless steel or titanium. Light, tough and skin-friendly; a service typically takes one to two weeks.' },
  { id: 'cast', short: 'Silver · brass', label: 'Cast in silver or brass', ids: ['silver', 'brass'],
    text: 'A casting house prints your file in wax and casts it in sterling silver or brass, the classic lost-wax route. It typically takes about a week.' },
  { id: 'gold', short: '14k gold', label: 'Cast in 14k gold', ids: ['gold-yellow', 'gold-rose', 'gold-white'],
    text: 'The same wax-and-cast route in 14k yellow, rose or white gold. Most of the price is the gold itself, so a slimmer band costs noticeably less.' },
];

export function Landing() {
  const [i, setI] = useState(0);
  const [holdUntil, setHoldUntil] = useState(0);
  const tickRef = useRef();
  useEffect(() => {
    if (reduced()) return;
    tickRef.current = setInterval(() => {
      if (Date.now() > holdUntil) setI((n) => (n + 1) % SHOWCASE.length);
    }, 4200);
    return () => clearInterval(tickRef.current);
  }, [holdUntil]);
  const step = (d) => {
    setI((n) => (n + d + SHOWCASE.length) % SHOWCASE.length);
    setHoldUntil(Date.now() + 12000); // pause the slideshow after manual control
  };

  const tpl = TEMPLATES.find((t) => t.id === SHOWCASE[i]);
  const design = designFromTemplate(tpl.id);
  const size = sizeSummary(design.sizeUS);
  const mat = getMaterial(design.materialId);
  const price = estimate(design).total;
  // Price range per way of making it, all for the same Heritage band, from the same estimate the studio shows.
  const costRows = COST_ROUTES.map((r) => {
    const totals = r.ids.map((id) => estimate(designFromTemplate('heritage', { materialId: id })).total);
    return { ...r, lo: Math.min(...totals), hi: Math.max(...totals) };
  });
  // The unrolled band under the hero follows the ring on screen.
  const bandDesign = designFromTemplate(tpl.id, { sizeUS: 9 });

  return html`<div class="lp">
    <header class="lp-head">
      <${Logo} />
      <nav class="lp-nav" aria-label="Page sections">
        <a href="#process" onClick=${scrollTo('process')}><span>01</span>Process</a>
        <a href="#studio" onClick=${scrollTo('studio')}><span>02</span>Studio</a>
        <a href="#materials" onClick=${scrollTo('materials')}><span>03</span>Materials</a>
        <a href="#cost" onClick=${scrollTo('cost')}><span>04</span>Cost</a>
      </nav>
      <div class="view-prefs"><${ThemeDots} /><${GridToggle} /><${SoundToggle} /></div>
      <button class="btn primary sm" onClick=${() => go('start')}>Open the studio <${Icon} name="right" size=${14} /></button>
    </header>

    <main id="main">
      <section class="lp-hero" aria-labelledby="lp-title">
        <h1 id="lp-title" class="lp-word">
          <span class="lp-word-a">Make a</span>
          <span class="lp-word-b">ring.</span>
        </h1>

        <div class="lp-stage" role="region" aria-roledescription="carousel" aria-label="Example rings">
          <span class="reg tl"></span><span class="reg tr"></span><span class="reg bl"></span><span class="reg br"></span>
          <div class="lp-ring">
            <${RingView} design=${design} mode="hero" autoRotate label=${`Rotating 3D ring: ${tpl.name}, ${mat.name}`} />
          </div>
          <svg class="lp-dims" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <line x1="22" x2="78" y1="88" y2="88" /><line x1="22" x2="22" y1="85" y2="91" /><line x1="78" x2="78" y1="85" y2="91" />
            <line x1="90" x2="90" y1="20" y2="76" /><line x1="87" x2="93" y1="20" y2="20" /><line x1="87" x2="93" y1="76" y2="76" />
          </svg>
          <span class="lp-dim-label h">Ø ${(size.diameter + 2 * design.thickness).toFixed(1)} mm</span>
          <span class="lp-dim-label v">${design.width.toFixed(1)} mm</span>

          <dl class="title-block" aria-live="polite">
            <div class="tb-wide"><dt>Part</dt><dd class="tb-name">${tpl.name}</dd></div>
            <div><dt>Layout</dt><dd>${LAYOUTS[tpl.layout].name}</dd></div>
            <div><dt>Material</dt><dd>${mat.name}</dd></div>
            <div><dt>Size</dt><dd>US ${size.us} · Ø ${size.diameter.toFixed(1)}</dd></div>
            <div><dt>Finish</dt><dd>${design.finish}</dd></div>
            <div><dt>Est.</dt><dd>${money(price)}</dd></div>
            <div class="tb-sheet"><dt>Sheet</dt><dd>
              <button class="tb-step" onClick=${() => step(-1)} aria-label="Previous ring">‹</button>
              <span>${String(i + 1).padStart(2, '0')} / ${String(SHOWCASE.length).padStart(2, '0')}</span>
              <button class="tb-step" onClick=${() => step(1)} aria-label="Next ring">›</button>
            </dd></div>
          </dl>
        </div>

        <div class="lp-hero-foot">
          <p class="lp-lede">A ring studio for people who aren't jewellers. Mix patterns, draw your own, and leave with files a printer or caster can use.</p>
          <ol class="lp-inline-steps">
            <li><span>01</span>Scroll patterns like a character creator</li>
            <li><span>02</span>Draw a tile, it wraps in 3D</li>
            <li><span>03</span>Download print-ready files</li>
          </ol>
          <div class="lp-ctas">
            <button class="key-btn" onClick=${() => go('start')}>Start from a template <${Icon} name="right" size=${18} /></button>
            <button class="key-btn ghost" onClick=${() => go('studio')}>Blank studio</button>
          </div>
        </div>
      </section>

      <div class="lp-ribbon" aria-hidden="true">
        <div class="lp-ribbon-track">
          ${[0, 1].map(() => html`<div class="lp-ribbon-seg"><${BandMap} design=${bandDesign} getPattern=${patternById} /></div>`)}
        </div>
        <span class="lp-ribbon-label">Unrolled band · ${tpl.name} template</span>
      </div>

      <section class="lp-sec" id="process">
        <${SectionBar} n="1" title="Process" meta="4 stations · about 3 minutes" />
        <ol class="lp-process">
          <li><span class="lp-n">01</span><h3>Start somewhere</h3><p>Pick a template or a blank band. A size finder helps if you don't know your size.</p></li>
          <li><span class="lp-n">02</span><h3>Scroll to style</h3><p>Up and down changes the middle, left and right the sides. The ring updates live.</p></li>
          <li><span class="lp-n">03</span><h3>Draw your own</h3><p>Sketch one tile, mirror it, smooth it. It repeats seamlessly around the band.</p></li>
          <li><span class="lp-n">04</span><h3>Check & download</h3><p>Try it on a hand, fix any printability warning in one click, and download STL or OBJ.</p></li>
        </ol>
      </section>

      <section class="lp-sec" id="studio">
        <${SectionBar} n="2" title="The studio" meta="keyboard, mouse or touch" />
        <div class="lp-studio">
          <div class="lp-studio-fig">
            <${CrossDiagram} />
            <p class="lp-caption">Fig. 1. The cross carousel. Patterns move the same way the band runs.</p>
          </div>
          <ul class="lp-feature-rows">
            <li><span class="lp-n">A</span><div><h3>Style it like a game character</h3><p>Middle patterns scroll vertically, side patterns horizontally. Unlink the sides to mix two borders.</p></div><span class="lp-keys"><kbd>↑</kbd><kbd>↓</kbd><kbd>←</kbd><kbd>→</kbd></span></li>
            <li><span class="lp-n">B</span><div><h3>Draw once, wrap forever</h3><p>Pen, line, square, circle and dot, with mirroring, snapping, zoom and a Steady tool that calms shaky lines.</p></div><span class="lp-keys"><kbd>D</kbd></span></li>
            <li><span class="lp-n">C</span><div><h3>Proportions you control</h3><p>Drag the zone edges to make the borders wider or the middle bolder. Repeats can be typed exactly.</p></div><span class="lp-keys"><kbd>drag</kbd></span></li>
            <li><span class="lp-n">D</span><div><h3>Printability built in</h3><p>Wall thickness, line width and engraving depth are checked for your material. Every warning has a fix.</p></div><span class="lp-keys"><kbd>live</kbd></span></li>
            <li><span class="lp-n">E</span><div><h3>Find your size</h3><p>US, EU and UK sizes, a screen-calibrated ring sizer, and a string method. Check with a jeweller's sizer before casting in gold.</p></div><span class="lp-keys"><kbd>Ø</kbd></span></li>
          </ul>
        </div>
      </section>

      <section class="lp-sec" id="materials">
        <${SectionBar} n="3" title="Materials" meta=${`${MATERIALS.length} options · limits used by the checker`} />
        <div class="lp-table-wrap">
          <table class="lp-table">
            <thead><tr><th scope="col">Material</th><th scope="col">Process</th><th scope="col">Min wall</th><th scope="col">Min line</th><th scope="col">From</th></tr></thead>
            <tbody>
              ${MATERIALS.map((m) => html`<tr>
                <th scope="row"><span class="swatch-dot" style=${`--c:${m.color}; --m:${m.metalness}`}></span>${m.name}</th>
                <td>${m.process}</td>
                <td class="num" data-label="Min wall">${m.minWall.toFixed(1)} mm</td>
                <td class="num" data-label="Min line">${m.minDetail.toFixed(2)} mm</td>
                <td class="num" data-label="From">${money(estimate(designFromTemplate('blank', { materialId: m.id })).total)}</td>
              </tr>`)}
            </tbody>
          </table>
        </div>
      </section>

      <section class="lp-sec" id="cost">
        <${SectionBar} n="4" title="Cost" meta="estimate for the Heritage band, 7 mm, US 7" />
        <${DisplayTray} routes=${costRows} bandMm=${designFromTemplate('heritage').width} />
      </section>

      <a class="lp-mega" href="#/start" onClick=${(e) => (e.preventDefault(), go('start'))}>
        <span>Open the studio</span><${Icon} name="right" size=${64} />
      </a>
    </main>

    <footer class="lp-foot">
      <dl class="title-block foot">
        <div><dt>Project</dt><dd>Make-a-Ring</dd></div>
        <div><dt>For</dt><dd>HyperBloom October 2026</dd></div>
        <div><dt>Status</dt><dd>Frontend prototype</dd></div>
        <div><dt>Note</dt><dd>Prices are illustrative estimates</dd></div>
      </dl>
    </footer>
  </div>`;
}
