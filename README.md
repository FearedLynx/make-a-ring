# Make-a-Ring

Design a custom, print-ready ring: scroll through patterns like a game character creator,
draw your own, try it on, and download files for printing or casting.

Built for **HyperBloom October 2026 (UI/UX & Web Design)**. Frontend-only prototype:
prices are estimates and the file download is simulated.

## Run it

No build step and no npm. Any static server works; this one fixes `.js` MIME types on Windows:

```bash
python serve.py
```

Then open http://localhost:5173. Libraries (Preact, htm, three.js) load from jsDelivr via the import map in `index.html`.

## Deploy

Upload the folder as a static site (Deployxa, GitHub Pages, Netlify, Vercel). There is nothing to build.

## User flow

1. **Landing** (`#/landing`): pitch, rotating 3D showcase.
2. **Start** (`#/start`): pick a template (3D thumbnails), then your size.
3. **Studio** (`#/studio`): the cross carousel. ↑/↓ changes the middle, ←/→ changes the sides, the ring updates live. Both side panels work like Blender's properties editor: a strip of category icons on the outer edge, one category shown at a time (left: patterns, my patterns, templates; right: size, layout, band & relief, material & finish, printability). Hiding a panel leaves its strip, and any icon opens it again. Price, check status and **Try it on** stay pinned at the bottom. Use **Draw your own** to open the pattern editor.
4. **Try on** (`#/tryon`): illustrated hand (5 skin tones, 2 shapes, 4 fingers, close-up) or your own photo.
5. **Review** (`#/review`): spec sheet, checks, price breakdown, mocked STL/3MF/OBJ export, share link.

## Look & feel

Four themes (Beige, Blue, Gray, Red) switchable from the header; the choice is remembered. Type is
Archivo (expanded, for display) + IBM Plex Mono (for anything measured) + Inter (body). The page sets
`data-device` (`phone` / `tablet` / `desktop`) and `data-input` (`touch` / `mouse`) on `<html>`, so
hints and layout adapt to the device.

## Guidance

- A guided studio tour runs on the first visit, and the pattern editor has its own. Both can be skipped
  (with a confirmation) and replayed from the help menu (?).
- One-off tips appear when someone clicks the same control repeatedly, pointing to the keyboard shortcut.
  Each has "Don't show again".

## Code map

| Path | What it does |
|---|---|
| `src/lib/patterns.js` | Pattern library. Each pattern is one tile of strokes in 0..1 tile space |
| `src/lib/templates.js` | Layouts, adjustable zone proportions (`layoutZones`) and templates |
| `src/lib/materials.js` | Materials: render look, min wall/detail, price inputs, plating |
| `src/lib/band.js` | Zone sizes, tile repeats and printable line width |
| `src/lib/heightmap.js` | Draws all zones into a heightmap of the unrolled band |
| `src/lib/ringGeometry.js` | Revolves the band profile and displaces the outer surface with the heightmap |
| `src/lib/viewer.js` | three.js scene (studio, hero and try-on modes) |
| `src/lib/checks.js` | Printability checks with one-click fixes, plus the price estimate |
| `src/lib/thumbnails.js` | Off-screen renderer for template thumbnails |
| `src/state.js` | Global store, actions, persistence (localStorage), share links |
| `src/components/stage.js` | The cross carousel |
| `src/components/editor.js` | Pattern editor (zoom, grid, square/move tools, Steady smoothing, line weight in mm). Strokes placed with symmetry remember their copies: with symmetry on, erasing, moving, deleting or smoothing one copy acts on all of them; with it off, only on the one you touch |
| `src/components/rail-strip.js` | Category icon strip for the studio side panels |
| `src/components/tour.js` | Guided tours and tips |
| `src/screens/*` | One file per screen |

## Adding a pattern

Add a `def(...)` entry in `src/lib/patterns.js`. Zone is `'middle'`, `'side'` or `'any'`.
For side patterns, `y = 0` is the outer edge of the ring.

## Accessibility notes

Everything works by keyboard (press `?` for shortcuts), pattern changes are announced to screen readers,
the editor can be used with arrow keys + Enter, and motion respects `prefers-reduced-motion`.
