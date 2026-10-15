# Pre-submission review and fix plan

Deadline: **Oct 19, 2026, 23:00 GMT+2** (HyperBloom October, UI/UX & Web Design).
Reviewed build: `60f072d` on `responsive-and-export`, Oct 15.

## How this review was made

Five simulated judges each used the site at desktop (1440×900) and phone (390×844) sizes, measured it, and read the code. They then read each other's reports, argued, and revised their scores. Each persona was built from a seat on the Devpost judging page or from one of the published criteria. They are **not** the real judges and say nothing about what the real judges think.

| Seat | Lens |
|---|---|
| Engineer (SWE seat) | Does it work end to end, survive bad input, and stay fast? Is the STL trustworthy? |
| Senior engineer (IEEE seat) | Are the sizes, material limits, prices and claims correct and honest? |
| Product designer | Flow, visual hierarchy, first-10-seconds comprehension |
| Accessibility specialist | WCAG 2.2 AA: keyboard, screen reader, contrast, targets, reflow |
| Deployxa sponsor | Live URL, load performance, Devpost readiness, Best Use of Deployxa |

## Scores after deliberation

| Judge | UX flows | UI | Accessibility | Interaction & IA | Problem-solving | Polish | Overall |
|---|---|---|---|---|---|---|---|
| Engineer | 8 | 8 | 7 | 8 | 8 | 7 | 7.4 |
| Senior engineer | 8 | 8 | 7 | 8 | 7 | 6 | 7.3 |
| Designer | 7 | 7 | 7 | 8 | 8 | 7 | 7.3 |
| Accessibility | 8 | 8 | 7 | 8 | 8 | 7 | 7.5 |
| Sponsor | 8 | 8 | 7 | 8 | 8 | 7 | 7.5 |

**Panel average: 7.4 / 10.** Placement guess:
- **Top 10** if it is live and the carousel lag is fixed.
- **Top 25–30** if it has no public URL.
- **Top 3** is possible if the studio is also simplified.

"Best Use of Deployxa" will not place with plain static hosting, so don't chase it.

## What wins votes (keep and show off)

- **The landing page.** The technical-drawing art direction (Archivo Expanded, mono dimension lines, spec-sheet card) is the strongest first screen the panel expects to see.
- **Draw your own.** You sketch one tile and it wraps around the 3D ring live. This is the best moment in the product.
- **A real, correct STL.** It is watertight and manifold, with Euler characteristic 0. The inner diameter is 17.32 mm for US 7, and plating compensation is applied (17.42 mm with plating). The engineer judge would send it to a caster.
- **Actionable printability checks.** Each check is specific to the material, most have a one-click fix, and the export is locked while an error is open.
- **Keyboard and screen reader support.** The whole flow works with the keyboard alone, there is a live region, the 3D view has a text alternative that changes with the design, and reduced motion is respected.
- **Inclusive try-on and sizing.** Try-on offers 5 skin tones, 2 hand shapes and your own photo, and the photo stays on the device. Sizes come in US, EU and UK, and the size finder is calibrated with a bank card.

## Must-fix, ranked (all 5 judges agree on 1–4)

### 1. Make it reachable (~4 h)
- [ ] Deploy to a public URL and put it at the top of the Devpost page. Every path is already relative and the hash router needs no rewrites; it was tested from a sub-folder.
- [ ] Copy Preact, htm and three.js into `/vendor` and point the import map there (`index.html:31-38`). Today, if jsDelivr is blocked, the page is completely blank.
- [ ] Put a static hero (title, tagline, CTA) inside `#app` in `index.html`. On slow mobile (1.6 Mbps, 150 ms RTT) the first paint takes about 6.3 s; nothing renders until 49 module requests finish.
- [ ] Add `og:title`, `og:description` and `og:image` (a landing screenshot) so the Devpost link and share links show a preview card.
- [ ] Add `<link rel="modulepreload">` for the deep modules.

### 2. Make the carousel instant and the export sane (~6–8 h)
- [ ] Each pattern step blocks the main thread for **777–986 ms** (measured on a real GPU). Eight quick presses take 6.8 s to settle. The cause is the preview mesh at detail 1.25 plus a 3072-px heightmap, both added on Oct 15 to fix pixelation (`ring-view.js:33`).
  - Build at about detail 0.5 (with a smaller heightmap) while the user is stepping, then rebuild at 1.25 after 300 ms of no input.
  - Cancel stale builds.
  - Target: under 150 ms per step.
- [ ] Template thumbnails on Start: 7 of 8 are still blank after 5 s. Render them at low detail, or ship pre-rendered PNGs.
- [ ] Lower the export detail from 1.5 (`review.js:46`).
  - Detail 0.75 gives 234,900 triangles and about 12 MB. That is still about 5 samples across the thinnest 0.38 mm line, which is finer than polishing tolerance.
  - Today a plain ring is 42 MB, and an engraved one is 55–61 MB (1.2M triangles, above some print services' caps).
  - Show the triangle count and file size before generating.

### 3. Honesty and correctness pass (~3 h)
- [ ] Reword "Made by a partner workshop in about 7 days" (`review.js:237`) and "ships in ~7 days" (`specs.js:270`), because no partner exists. Suggested: "A casting house typically takes ~7 days."
- [ ] "Bespoke jeweller $2,000–5,000" is unsourced and hard-coded in 3 places (`landing.js:186`, `review.js:237`, `specs.js:304`). Cite it, or change it to "custom jeweller quote: varies".
  - The "cast" bar hard-codes $80 (`landing.js:187`) while the table above it shows brass at $35 and silver at $63. Compute the low end instead.
  - The section header says "6 mm band", but the numbers come from Heritage, which is 7 mm.
- [ ] Comfort-fit wall check is wrong. The rim wall is really 0.58·t, but `checks.js:6` uses 0.8·t, so it passes walls up to 28% under the limit. Set `PROFILE_EDGE.comfort = 0.58`.
- [ ] The Nordic template (titanium, shown in the hero) opens with "Morse lines 0.38 mm < 0.5 mm" and no fix. Built-in lines are clamped to exactly 0.38 (`band.js:33`), and the widen fix needs > 0.38 (`checks.js:55`). Make Nordic print-clean and relax that condition.
- [ ] Weight and price come from profile fill factors (`PROFILE_FILL`), not the real mesh. The brief says 6.8 g of silver; the mesh volume gives 7.9 g (+16%). Sum the signed volume of the built mesh (about 10 lines).
- [ ] UK sizes come out half a letter low because `ukSize` rounds down (`sizes.js:14`). Round to the nearest half letter, and add half sizes to the UK picker (`size-finder.js:91,114`).
- [ ] The Start size list skips 4½, 9½, 10½, 11½ and 13, while the size finder has them.
- [ ] Small copy fixes:
  - Resin's cost line says "filament" (`checks.js:131`).
  - Soften "Fits the first time".
  - Add one line to the maker brief: "Nominal dimensions; the caster applies shrink and finish allowance."
- [ ] After switching to PLA, Finish still says "antique" and the price still lists patina. Reset both.

### 4. The studio's first 10 seconds (~4–6 h)
- [ ] Cut the auto-starting 10-step tour to 3–4 steps (rotate the ring, middle, sides, draw). Turn layout, search, checks and price into the one-off contextual tips that already exist. On phone, the tour card covers the ring.
- [ ] The "Printable" chip sits under the "Try it on" button at 1440×900 and 1280×800. In the error state it wraps to "2 to / fix" and the overlap gets worse. Give the chip its own row, or use `nowrap` and a fixed CTA column.
- [ ] Change "Sides matched" from a filled black button to an outline toggle chip. Keep filled buttons for Draw (gold) and the next step (black).
- [ ] Give "Plain" a visible flat-band swatch; today its cards look like empty placeholders. Show the current pattern name and count under the ring.
- [ ] **Keep** the Middle/Sides selector buttons; you may shrink or move them. They are the only labelled previous/next path for keyboard, switch and screen-reader users. (3 of 5 judges said keep, 2 said delete.)

### 5. Robustness (~3 h)
- [ ] A malformed design white-screens the app on every visit, permanently. A `?d=` link encoding `{"design":{}}`, or a bad `mar.design` value in localStorage, triggers it (`library.js:24`, `review.js:184`, no validation in `state.js:64`).
  - Merge any loaded design over `designFromTemplate('heritage')` and check `layout` and `patterns`.
  - Add a top-level error boundary with a "Reset design" button.
- [ ] Opening a share link silently replaces your own saved design. Show a "Keep mine / Open shared" toast.
- [ ] Share links with one custom pattern are about 14,000 characters, and chat apps truncate them. Round coordinates to 3 decimals and compress with `CompressionStream('deflate-raw')`. Show an error when a link fails to decode.

### 6. Accessibility bundle (~4 h, an explicit judging criterion)
- [ ] **2.4.3:** focus drops to `<body>` on every screen change (landing→start, step 1→2, →studio, →try-on, →review, and after the tour). On each change, focus the new `<h1 tabindex="-1">`. The studio has no `<h1>` at all; add one, visually hidden if needed.
- [ ] **2.4.3:** focus escapes the export dialog after "Generate". Move focus to the file list or the Done button, and refocus whenever focus leaves the modal (`ui.js:124`).
- [ ] **2.1.4:** single-key shortcuts (L, S, R, D, +, −, /, [, ], ?) can't be turned off. Add a toggle in the shortcuts dialog.
  - Arrow keys leak through: ArrowDown on a theme radio changed the ring pattern. Ignore arrows inside `[role=radiogroup]`, `[role=menu]` and `[role=tablist]` (`stage.js:90`).
- [ ] **4.1.2:** the Help menu has `role="menu"` but no menu keyboard behaviour. Focus the first item, support arrow keys, and close on Esc, or make it a plain disclosure.
- [ ] **2.4.7:** the photo upload button has no visible focus (`tryon.js:89,126`). Add `label:focus-within { outline: … }`.
- [ ] **2.5.7 / 2.1.1:** placing the ring on your own photo works only by dragging (`tryon.js:57,97`). Add X/Y sliders or arrow-key nudging.
- [ ] **2.2.2:** the landing slideshow never stops, and its `aria-live="polite"` announces every 4.2 s (`landing.js:52,101`). Add a pause button, stop it on hover or focus, and set `aria-live="off"` while it rotates.
- [ ] Contrast:
  - White text on the accent ("Draw your own") is 3.87:1 in Beige and Gray; use `--accent-ink`.
  - Step numbers are 4.07–4.28:1 in the Gray, Blue and Red themes.
  - The far carousel cards are 2.2:1.
  - The selected segmented pill against its track is 1.19:1.
- [ ] The far carousel cards have `label=""`, so they announce ": Beads" (`stage.js:154`).
- [ ] The phone step links are named only "01/02/03" because their label is `display:none` (`technical.css:486`). Use `sr-only` instead.
- [ ] The Undo toast disappears after 6 s (`state.js:171`), too fast to reach by Tab.
- [ ] Optional: 44 px phone carousel arrows. The current 30–32 px already passes AA 2.5.8; 44 px is the AAA level.

### Smaller items if time allows
- [ ] With no WebGL, the ring area is blank with no message.
- [ ] A corrupt try-on photo shows a broken image and no error.
- [ ] Back → forward reopens the export modal.
- [ ] In the hero, the 3D ring can lag one slide behind its spec card.
- [ ] Editor: show pen, line, dot and eraser, and put the other tools behind "More".
- [ ] Move the theme swatches from the studio header into the Help menu.
- [ ] Review on phone: Download is about 2 screens down. Add a sticky Download bar.
- [ ] Unversioned asset names mean a redeploy during judging can mix old and new modules. Check the host's cache headers.

## Schedule

| Day | Work |
|---|---|
| Fri Oct 16 | 1 (deploy and robust first load) + 2 (carousel lag, export size) |
| Sat Oct 17 | 3 (honesty and correctness) + 5 (robustness) + 4 (studio first impression) |
| Sun Oct 18 | 6 (accessibility) · demo video (< 2 min: problem, carousel, draw a tile, try-on, STL opened in a slicer) · Devpost write-up (live link first, "prices are estimates", how it's deployed) · **freeze the build in the evening** |
| Mon Oct 19 | Test on a real phone over cellular, run Lighthouse on the live URL, submit before 23:00 |

Not yet verified by anyone: behaviour on a real phone (touch scroll, pinch, lag), and a physically printed ring.
