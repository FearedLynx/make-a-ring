// Ring card: one PNG of your ring as a drawing sheet (3:2, the Devpost gallery shape), in the page's own colours and type.
// The 3D view is a snapshot of the live viewer; everything else is drawn here, so it needs no extra library.

const W = 1500, H = 1000;

const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const loadImage = (src) =>
  new Promise((ok, fail) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = fail;
    img.src = src;
  });

/** Crop the snapshot to what is drawn (ring and shadow), so the ring fills its part of the card. */
function trim(img) {
  const t = document.createElement('canvas');
  t.width = img.width;
  t.height = img.height;
  const g = t.getContext('2d');
  g.drawImage(img, 0, 0);
  const { data } = g.getImageData(0, 0, t.width, t.height);
  let x0 = t.width, y0 = t.height, x1 = -1, y1 = -1;
  for (let y = 0; y < t.height; y++)
    for (let x = 0; x < t.width; x++)
      if (data[(y * t.width + x) * 4 + 3] > 10) (x < x0 && (x0 = x), x > x1 && (x1 = x), y < y0 && (y0 = y), y > y1 && (y1 = y));
  return x1 < 0 ? t : { canvas: t, x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/** Wrap `text` to lines no wider than `max` at the context's current font. */
function lines(ctx, text, max) {
  const out = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > max && line) (out.push(line), (line = word));
    else line = next;
  }
  if (line) out.push(line);
  return out;
}

/**
 * Draws the card and returns it as a PNG blob.
 * `rows` are [label, value] pairs for the title block (six fit); `dims` the outer diameter and width in mm;
 * `stamp` is { ok, title, sub }.
 */
export async function ringCard({ snapshot, name, rows, dims, stamp }) {
  await document.fonts.ready;
  const c = { bg: css('--bg'), ink: css('--ink'), ink3: css('--ink-3'), grid: css('--grid'), surface: css('--surface'), accent: css('--accent'), accentInk: css('--accent-ink'), ok: css('--ok'), error: css('--error') };
  const f = { display: css('--display'), mono: css('--mono'), body: css('--font') };
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const font = (spec, stretch = 'normal') => {
    ctx.font = spec;
    if ('fontStretch' in ctx) ctx.fontStretch = stretch;
  };

  // Sheet: page colour, drafting grid, registration marks.
  ctx.fillStyle = c.bg;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = c.grid;
  ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += 30) (ctx.beginPath(), ctx.moveTo(x + 0.5, 0), ctx.lineTo(x + 0.5, H), ctx.stroke());
  for (let y = 0; y <= H; y += 30) (ctx.beginPath(), ctx.moveTo(0, y + 0.5), ctx.lineTo(W, y + 0.5), ctx.stroke());
  ctx.strokeStyle = c.accent;
  ctx.lineWidth = 2;
  for (const [x, y, dx, dy] of [[40, 40, 1, 1], [W - 40, 40, -1, 1], [40, H - 40, 1, -1], [W - 40, H - 40, -1, -1]])
    (ctx.beginPath(), ctx.moveTo(x, y + 26 * dy), ctx.lineTo(x, y), ctx.lineTo(x + 26 * dx, y), ctx.stroke());

  // The ring, fitted into the left part of the sheet.
  const box = { x: 70, y: 90, w: 820, h: 720 };
  const cut = trim(await loadImage(snapshot));
  const src = cut.canvas ? cut : { canvas: cut, x: 0, y: 0, w: cut.width, h: cut.height };
  const s = Math.min(box.w / src.w, box.h / src.h) * 0.92;
  const iw = src.w * s, ih = src.h * s;
  ctx.drawImage(src.canvas, src.x, src.y, src.w, src.h, box.x + (box.w - iw) / 2, box.y + (box.h - ih) / 2, iw, ih);

  // Dimension callouts, as on the landing and the Files screen.
  const dim = (x1, y1, x2, y2, label, vertical) => {
    ctx.strokeStyle = c.accent;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x1, y1), ctx.lineTo(x2, y2);
    if (vertical) (ctx.moveTo(x1 - 10, y1), ctx.lineTo(x1 + 10, y1), ctx.moveTo(x2 - 10, y2), ctx.lineTo(x2 + 10, y2));
    else (ctx.moveTo(x1, y1 - 10), ctx.lineTo(x1, y1 + 10), ctx.moveTo(x2, y2 - 10), ctx.lineTo(x2, y2 + 10));
    ctx.stroke();
    font(`600 20px ${f.mono}`);
    const tw = ctx.measureText(label).width + 16;
    ctx.save();
    ctx.translate((x1 + x2) / 2, (y1 + y2) / 2);
    if (vertical) ctx.rotate(Math.PI / 2);
    ctx.fillStyle = c.bg;
    ctx.fillRect(-tw / 2, -15, tw, 30);
    ctx.fillStyle = c.accentInk;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 0, 1);
    ctx.restore();
  };
  dim(200, 860, 760, 860, `Ø ${dims.outer.toFixed(1)} mm`, false);
  dim(900, 250, 900, 650, `${dims.width.toFixed(1)} mm`, true);

  // Right column: maker mark, name, title block, stamp.
  const rx = 980, rw = W - 70 - rx;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  font(`600 18px ${f.mono}`);
  ctx.fillStyle = c.accentInk;
  ctx.fillText('MAKE-A-RING · RING CARD', rx, 118);

  font(`800 64px ${f.display}`, 'expanded');
  ctx.fillStyle = c.ink;
  const nameLines = lines(ctx, (name || 'Untitled ring').toUpperCase(), rw).slice(0, 3);
  nameLines.forEach((l, i) => ctx.fillText(l, rx, 196 + i * 64));

  const tbY = 196 + nameLines.length * 64 + 10, cellH = 74, cols = 2, cellW = rw / cols;
  ctx.fillStyle = c.surface;
  ctx.fillRect(rx, tbY, rw, Math.ceil(rows.length / cols) * cellH);
  ctx.strokeStyle = c.ink;
  ctx.lineWidth = 1.5;
  rows.forEach(([label, value], i) => {
    const x = rx + (i % cols) * cellW, y = tbY + Math.floor(i / cols) * cellH;
    ctx.strokeRect(x + 0.75, y + 0.75, cellW, cellH);
    font(`500 14px ${f.mono}`);
    ctx.fillStyle = c.ink3;
    ctx.fillText(label.toUpperCase(), x + 14, y + 26);
    font(`600 21px ${f.mono}`);
    ctx.fillStyle = c.ink;
    let v = String(value);
    while (ctx.measureText(v).width > cellW - 28 && v.length > 4) v = v.slice(0, -2) + '…';
    ctx.fillText(v, x + 14, y + 56);
  });

  // Stamp: ready to print, or how many checks are left.
  const sy = tbY + Math.ceil(rows.length / cols) * cellH + 110;
  ctx.save();
  ctx.translate(rx + rw / 2, sy);
  ctx.rotate(-0.12);
  const col = stamp.ok ? c.ok : c.error;
  ctx.strokeStyle = col;
  ctx.lineWidth = 3;
  ctx.strokeRect(-150, -52, 300, 104);
  ctx.lineWidth = 1.5;
  ctx.strokeRect(-142, -44, 284, 88);
  ctx.fillStyle = col;
  ctx.textAlign = 'center';
  font(`800 38px ${f.display}`, 'expanded');
  ctx.fillText(stamp.title, 0, 2);
  font(`600 15px ${f.mono}`);
  ctx.fillText(stamp.sub, 0, 30);
  ctx.restore();

  font(`400 16px ${f.mono}`);
  ctx.fillStyle = c.ink3;
  ctx.textAlign = 'left';
  ctx.fillText('Prices are estimates, not a quote.', rx, H - 70);

  return new Promise((ok) => canvas.toBlob(ok, 'image/png'));
}
