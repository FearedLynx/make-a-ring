# Judging prep notes

Written Oct 15, 2026, for HyperBloom October (UI/UX & Web Design). The deadline is **Oct 19, 23:00 GMT+2**.
These notes complement Javier's `FIX-PLAN.md` on `responsive-and-export`, which covers correctness, robustness and WCAG. They don't repeat it.

## Where the branches stand

| Branch | Latest | What it has |
|---|---|---|
| `main` | `408fe78` | The original prototype and the interactive tour. It is behind both other branches. |
| `symmetry-and-compact-ui` (PR #1) | `7646b11` | Symmetry-aware editor, Blender-style side panels, phone editor, inside engraving, stage selector column, tour fixes. Javier's first branch is merged in. |
| `responsive-and-export` (Javier) | `387f9dd` | Everything in PR #1, plus "never trap page scrolling", a sharper and faster mesh, smaller engraved STLs, the phone tab-strip fix, and `FIX-PLAN.md`. |

- **Javier's branch is the most complete build.** It already contains all of PR #1, so PR #1 is effectively superseded. Merge `responsive-and-export` into `main` instead, or rebase PR #1 onto it.
- **Decided (Oct 15): keep Javier's carousel controls** from `03afb62`:
  - A plain mouse wheel scrolls the page; **Ctrl + wheel** or a trackpad pinch steps through patterns.
  - On touch, one finger scrolls the page or spins the ring; two fingers zoom and rotate.

  Show Ctrl + wheel and the arrow keys clearly in the tour and the demo video, so judges find the signature interaction.

## Competition snapshot
- 530 participants: 373 solo, 69 with a team, 42 looking for teammates. Specialties: 240 full-stack, 58 front-end, 57 designers. Most profiles have 0–2 projects.
- In past HyperBloom events about 40% submitted, so expect about 200 entries.
- **One project per entrant.** Calm Cart and Make-a-Ring can't both go in.
- Past winners all had a demo video, many screenshots, a live link, public GitHub, and a long write-up structured as Inspiration / What it does / How we built it / Challenges / Accomplishments / What we learned / What's next.
- Profiles to watch:
  - Front-end and motion: Shubham Jha (Spline, Framer Motion) and Noba Aier.
  - Experienced UX: Sai Vidyasri Giridharan, Eeshan K and Prishha Ramesh.
  - Fast AI builders who present well: Daniel Liu (also does video) and Naveed Ahmed.
- Profile housekeeping: Franciszek's team setting isn't chosen, and Javier shows "Has a team". Set both to the same team and add Javier to the submission.

## What a design judge sees (first-impression review of `387f9dd`)

- **First 10 seconds.** The headline "Make a / ring." looks great but promises nothing. The pitch is in a small lede under the stage, and the problem (custom rings are out of reach without a jeweller) only shows up several screens down; don't quote a price, the $2,000 figure was removed as unsourced.
  - Add a large kicker under the headline, e.g. "Draw it. Wrap it. Wear it. A custom ring in three minutes, no jeweller needed."
  - Move the three inline steps above the lede.
- **The wow moment** (draw one tile and watch it wrap around the 3D ring) takes 5+ clicks and two auto-tours to reach: landing → Start step 1 → Start step 2 → studio → 10-step tour → Draw → editor tour.
- **It feels like a tool rather than an experience in these places:**
  - Screen changes are hard cuts (`state.js go()`).
  - Saving a pattern ends in a toast.
  - Nothing happens when the last check turns green.
  - Try-on just appears.
  - Export ends in a plain file list.
  - Phones get no haptic feedback.
- **Information architecture.** There are three different step systems: the landing's "4 stations", Start's "1 · 2", and the topbar's 01–03, which leaves out Start. Template and size are each chosen twice. The topbar is crowded.
- **Visual consistency.** The landing's technical-drawing style is our identity, but it fades after the studio: Start, try-on and review use generic cards. Small details:
  - `.format-name` uses `ui-monospace` instead of `var(--mono)`.
  - The landing uses raw ‹ › ↑↓ characters instead of the icon set.
- **The ending** reads like a receipt. "My first ring" is the default name, and there's nothing to share except a long URL.
- **Inclusivity beyond WCAG:**
  - Only a left hand. Wedding rings go on the right hand in PL, DK, DE, NO, RU and IN, and left-handed users notice too.
  - No thumb option.
  - Sizes are US/EU/UK only.
  - Gold, rose gold and brass swatches look alike for colour-blind users.
  - No skin-friendly or nickel-free marker.
  - English-only "love" preset and USD-only prices.

## What similar sites do (research)

The closest analogue is the **iJewel3D Wedding Band Builder**: a profile swept around a circle, PBR materials, a linked his-and-hers pair, and an itemised price. Its strongest trust device is a **production spec sheet** with a cross-section, mm dimensions, three size systems, metal and price.

Patterns worth borrowing (mechanics only; no brand names, wording or formats):

| Pattern | Seen at | Why it lands |
|---|---|---|
| Camera fly-to presets: top, side profile, on the hand, **inside: engraving** | Threekit, Nike configurator, Awwwards WebGL sites | Cinematic craft in the first seconds |
| Environment lighting and a slow light sweep (`RoomEnvironment`/HDRI) | Threekit ring demos | Metal looks real; cheap in three.js |
| Animated material and pattern changes (dissolve or wipe, a "settle" spin) | Awwwards configurators | Smooth instead of hard swaps |
| Short design code plus copy-link and QR | Car configurators | Shareable with no backend |
| Named engraving styles and a few glyphs (♥ ∞ ★), live preview, character limit | Jewellery engraving tools | Clear and gift-like |
| Starting points: preset, initials, "Surprise me" | Sneaker and diamond builders | Low-effort entry; shuffle is good in a demo |
| Before/after fix slider for printability (thickness heatmap) | Compare views | Shows off our unique feature |
| Honest trust strip: "estimate, not a quote · typical cast time · confirm with a physical sizer" | 3D-printed jewellery sites, online sizers | Trust without fake claims |

None of the sites studied document accessibility. **That's our opening:** show keyboard use and screen-reader announcements in the video.

**Traps:**
- Live hand-tracking AR: large and fragile in a demo.
- Accounts, galleries, "shop others' designs": need a backend.
- Diamond and certificate flows.
- Copying any brand's names or formats.
- Exact price claims.

## How these events are judged (past HyperBloom winners)

- **"Winner" badges go to many entries, but only the top 3 get real prizes.** September AI/ML had 175 submissions and 10 "Winners": 1st/2nd/3rd plus 7 top-10 domain prizes. V2 had 84 submissions and 11 winners; Sept-2 had 41 and 9. Realistic goal: top 3, with top 10 as the fallback.
- **The October page has very few rules.** No required video, no length limit, no repo requirement, no criteria weights (the "Judging Criteria" box contains only "."). It says a frontend-only build or a Figma prototype is "just as welcome".
- **What the winners had:**
  - **Video:** every winner had one; median length about 3:00, range 0:59–4:08.
  - **Images:** top-3 winners had 5–11 gallery images.
  - **Links:** almost all had a live link plus GitHub.
  - **Write-up:** Devpost's template headings, 300–800 words.
  - **Taglines:** short and framed as a problem, e.g. KWIK's "Ring time becomes response time."
  - **What set them apart:** a bold thesis, a quantified "why not just X?" section, and a concrete problem.
- **Almost no winners mentioned accessibility.** It's an explicit October criterion, so a concrete accessibility section sets us apart cheaply.
- **Judges:** there's no reliable public profile for either; this is inferred from their titles only. Fenil Shah (SWE @ Amazon) will probably check that it works, loads fast and has a clean public repo. Ankur Bhatnagar (senior member, IEEE) will probably value rigor: measured numbers, and accessibility claims that can be checked.
- **Deployxa** (deployxa.com) deploys from a Git repo, and its site lists static websites as a use case. The free plan has 3 projects, custom domains and HTTPS. To compete for **Best Use of Deployxa**:
  - host the production URL there;
  - name it in the write-up and in "Built With";
  - show the deploy step for about 5 seconds in the video.

  Javier's plan says plain static hosting won't win that prize. Even so, it's the cheapest extra chance, and we need a live URL anyway.

## Ranked plan (merges FIX-PLAN.md with this research)

Keep the carousel input as decided above (Javier's controls). Nothing here changes it.

**Friday Oct 16: reachable and fast**
1. **Deploy on Deployxa** and put the live URL first everywhere. Same day, from FIX-PLAN §1:
   - Vendor Preact, htm and three.js into `/vendor`.
   - Add a static hero in `index.html` and `og:` tags with a landing screenshot.
   - Show a fallback image when WebGL is missing.
2. **Fix carousel lag:** low-detail mesh while stepping, full detail after 300 ms of no input, and cancel stale builds. **Lower the export detail** to about 12 MB (FIX-PLAN §2). This is rendering only; the input handling stays the same.

**Saturday Oct 17: the wow path and the finale**

3. **"Draw on a ring" landing CTA:** opens the studio with the editor open and tours skipped. Cut the auto-tour to 3–4 steps and turn the rest into one-off tips. Combine with the promise kicker under "Make a ring." (S)
4. **Ring card finale on Review.** A drawing sheet of *their* ring in the landing's title-block style:
   - hero render, cross-section, mm dimensions, three size systems, material, printability status;
   - "Save ring card" (PNG) and native share on phones;
   - a short design code next to the link.

   This is also our best Devpost screenshot. (M)
5. **Camera fly-to and better metal.** Presets for top, side profile and "Inside: engraving"; choosing an engraving flies the camera inside. Add `RoomEnvironment` lighting with a slow light sweep. Respect reduced motion. (S–M)
6. **View transitions between screens.** `document.startViewTransition` around `go()`, with the ring morphing from landing to studio to review. (S–M)
7. **Honesty, correctness and robustness** from FIX-PLAN §3 and §5:
   - comfort-fit wall check;
   - Nordic template printing clean;
   - wording such as "partner workshop" and "$2,000";
   - weight computed from the real mesh;
   - UK sizes;
   - bad-design white screen, plus an error boundary.

**Sunday Oct 18: accessibility, delight, submission**

8. **Accessibility bundle** (FIX-PLAN §6): focus moves to each screen's `<h1>`, a dialog focus trap, a toggle for single-key shortcuts, contrast fixes, slideshow pause, keyboard placement on the photo.
9. **Small delight:**
   - a "Ready to print" pulse and announcement when the last error clears;
   - a pattern-save celebration (spin plus a flash on the band);
   - `navigator.vibrate(8)` on carousel steps (Android).
10. **Inclusivity quick wins:** left/right hand toggle and thumb in try-on; Ag/Au/Ti letters on swatches; JP and IN sizes; a "skin-friendly" tag on titanium; one 4-step spine across screens.
11. **Video and write-up** (below). **Freeze the build Sunday evening.**

**Monday Oct 19:** test on a real phone over cellular, run Lighthouse and axe on the live URL, and submit before 23:00.

**Skip:**
- live AR hand tracking;
- accounts and galleries;
- his-and-hers pairs;
- a compare slider (unless everything else is done).

## Submission kit

**Tagline candidates (≤15 words, problem-first)**
- "A custom ring without a jeweller: draw it in three minutes, print or cast it." (no price claim; the $2,000 figure was removed as unsourced)
- "Your sketch, wrapped around a real ring, ready to print tonight."
- "Draw one tile. It wraps your ring. You download the file."

**Gallery (6–8 images, 3:2)**
1. Hero render.
2. Cross carousel.
3. Pattern editor with symmetry.
4. Inside engraving.
5. Try-on.
6. Ring card / spec sheet.
7. Accessibility collage: focus rings, high contrast, reduced motion, screen-reader text.
8. Phone layout.

**Write-up (500–800 words, Devpost headings)**
- Open with a short mapping of features to the 6 criteria, one line each.
- Problem and user.
- Flow and information architecture, with a small diagram.
- **Accessibility**, with checkable claims: keyboard-only flow, live announcements, text alternative for the 3D view, reduced motion, measured contrast ratios, axe/Lighthouse scores.
- One "why X, not Y" design decision, e.g. why a cross carousel instead of dropdowns.
- Engineering numbers: load time, step latency, STL watertight, file size.
- Deployxa deploy.
- "Prices are estimates; all brands and data are fictional."

**Video (2:00–2:45, one continuous take where possible, captions, no copyrighted music)**

| Time | Shot |
|---|---|
| 0:00 | Hook: a finished ring spinning, plus the tagline |
| 0:10 | The problem in one sentence |
| 0:25 | Pick a template → scroll the carousel → draw a tile and watch it wrap → engrave "F ♥ J" and the camera flies inside → fix a printability warning in one click |
| 1:20 | Try-on on a hand, then the ring card and STL download (bonus: the STL opened in a slicer) |
| 1:45 | Keyboard-only run with visible focus, screen-reader announcement, reduced motion, phone layout |
| 2:10 | Deployxa deploy step and performance numbers |
| 2:25 | Live URL on screen |

## The 5 most common reasons good projects lose
1. **The live link is broken, slow or missing,** or WebGL fails on the judge's machine. Fallback image, and test in incognito and on a phone.
2. **The video is weak or too long.** Many judges watch only the video.
3. **The write-up lists features** instead of mapping them to the stated criteria.
4. **Accessibility and design reasoning are claimed but not shown.**
5. **Last-minute submission:** placeholder text, missing images, untested demo. Submit Monday afternoon, not at 22:55.

Sources:
- Research reports from three subagents, Oct 15.
- Devpost galleries: hyperbloom-september, hyperbloom-v2, hyperbloom-september2.
- Configurators: iJewel3D docs, Threekit, Awwwards.
- deployxa.com.
- Winner pages: CoolCity, SupplyChain AI, KWIK, PhysiX, Fractal, Strata, Viz-Lens, Accessibility4all.
