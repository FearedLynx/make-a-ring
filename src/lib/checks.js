// Printability checks and price estimate. Each check can carry a one-click fix.
import { getMaterial, PLATINGS } from './materials.js';
import { bandMetrics, resolveZones } from './band.js';
import { engravingLayout, getEngraving, ENGRAVE_DEPTH, STROKE_RATIO, LETTER_MIN, LETTER_MAX } from './engraving.js';

const PROFILE_EDGE = { flat: 1, domed: 0.55, comfort: 0.8, bevel: 0.65 };
const PROFILE_FILL = { flat: 1, domed: 0.82, comfort: 0.9, bevel: 0.9 };

export function runChecks(design, getPattern) {
  const m = getMaterial(design.materialId);
  const zones = resolveZones(design, getPattern);
  const checks = [];
  const add = (level, title, detail, fix) => checks.push({ level, title, detail, fix });

  // 1. Wall thickness (thinnest point of the profile, minus anything cut in from outside or inside).
  const eng = engravingLayout(design);
  const cutIn = (design.style === 'engraved' ? design.relief : 0) + (eng ? ENGRAVE_DEPTH : 0);
  const edge = design.thickness * PROFILE_EDGE[design.profile];
  const thinnest = Math.min(edge, design.thickness - cutIn);
  if (thinnest < m.minWall) {
    const need = +Math.max(m.minWall / PROFILE_EDGE[design.profile], m.minWall + cutIn + 0.05).toFixed(1);
    add('error', 'Band too thin to print',
      `Thinnest wall is ${thinnest.toFixed(2)} mm. ${m.name} needs at least ${m.minWall} mm.`,
      { label: `Set thickness to ${Math.min(3, need)} mm`, patch: { thickness: Math.min(3, need) } });
  } else {
    add('ok', 'Wall thickness', `Thinnest wall ${thinnest.toFixed(2)} mm (needs ${m.minWall} mm for ${m.name}).`);
  }

  // 2. Engraving depth.
  if (design.style === 'engraved' && design.relief > design.thickness * 0.45) {
    const safe = +(design.thickness * 0.4).toFixed(2);
    add('error', 'Engraving too deep', `Cutting ${design.relief} mm into a ${design.thickness} mm band weakens it.`,
      { label: `Reduce depth to ${safe} mm`, patch: { relief: safe } });
  }
  if (design.style === 'raised' && design.relief > 0.5) {
    add('warn', 'Tall relief may snag', 'Raised details over 0.5 mm can catch on knit and hair.',
      { label: 'Lower to 0.4 mm', patch: { relief: 0.4 } });
  }

  // 3. Fine details compared with what the process can resolve.
  let finest = null;
  for (const z of zones) {
    if (!z.pattern) continue;
    const mm = z.lineMM;
    if (!finest || mm < finest.mm) finest = { mm, zone: z };
  }
  if (finest) {
    const name = finest.zone.pattern.name;
    if (finest.mm < m.minDetail) {
      const widthNeeded = Math.ceil(((design.width * m.minDetail) / finest.mm) * 2) / 2;
      const fixes = finest.zone.pattern.lw
        ? null // hand-drawn line weight: raise it in the pattern editor
        : !m.metalness
        ? { label: 'Switch to tough resin (0.3 mm detail)', patch: { materialId: 'resin' } }
        : widthNeeded <= 12 && finest.mm > 0.38
          ? { label: `Widen band to ${widthNeeded} mm`, patch: { width: widthNeeded } }
          : null;
      add(finest.mm < m.minDetail * 0.7 ? 'error' : 'warn', 'Details smaller than the printer can make',
        `Lines in “${name}” are ${finest.mm.toFixed(2)} mm. ${m.process} resolves ${m.minDetail} mm.${finest.zone.pattern.lw ? ' Edit the pattern and raise its line weight.' : ''}`, fixes);
    } else {
      add('ok', 'Detail size', `Finest line ${finest.mm.toFixed(2)} mm (limit ${m.minDetail} mm).`);
    }
  }

  // 4. Cramped zones.
  for (const z of zones) {
    if (z.pattern && z.heightMM < 1.1) {
      add('warn', 'Crowded side border', `Side zones are only ${z.heightMM.toFixed(1)} mm tall. Patterns will look busy.`,
        { label: 'Widen band by 2 mm', patch: { width: Math.min(12, design.width + 2) } });
      break;
    }
  }

  // 4b. Inside engraving: letter height, stroke thickness and length around the inside.
  if (eng) {
    const e = getEngraving(design);
    const setSize = (mm) => ({ engraving: { ...e, size: +mm.toFixed(1) } });
    const needH = Math.min(LETTER_MAX, Math.ceil((m.minDetail / STROKE_RATIO) * 10) / 10);
    const fitLen = Math.floor(((eng.maxLength / eng.lengthMM) * eng.h) * 10) / 10;
    if (eng.h > eng.maxH) {
      add('error', 'Engraving taller than the band',
        `${eng.h} mm letters need a band of at least ${(eng.h + 1.4).toFixed(1)} mm; this one is ${design.width} mm.`,
        eng.maxH >= LETTER_MIN ? { label: `Set letters to ${eng.maxH} mm`, patch: setSize(eng.maxH) } : { label: 'Widen band', patch: { width: Math.min(12, Math.ceil(eng.h + 1.4)) } });
    } else if (eng.lengthMM > eng.maxLength) {
      add('error', 'Engraving too long for the inside',
        `“${eng.text}” runs ${eng.lengthMM.toFixed(0)} mm; about ${eng.maxLength.toFixed(0)} mm fits inside a US ${design.sizeUS} ring.`,
        fitLen >= LETTER_MIN ? { label: `Set letters to ${fitLen} mm`, patch: setSize(fitLen) } : null);
    } else if (eng.strokeMM < m.minDetail) {
      const fits = needH <= eng.maxH && (eng.lengthMM / eng.h) * needH <= eng.maxLength;
      add(eng.strokeMM < m.minDetail * 0.7 ? 'error' : 'warn', 'Engraved letters too fine',
        `Letter strokes are ${eng.strokeMM.toFixed(2)} mm; ${m.process} resolves ${m.minDetail} mm, so they may fill in.`,
        fits ? { label: `Set letters to ${needH} mm`, patch: setSize(needH) } : !m.metalness ? null : { label: 'Switch to tough resin (0.3 mm detail)', patch: { materialId: 'resin' } });
    } else {
      add('ok', 'Inside engraving', `“${eng.text}”: ${eng.h} mm letters, ${ENGRAVE_DEPTH} mm deep, ${eng.lengthMM.toFixed(0)} mm long.`);
    }
  }

  // 5. Seamless wrap.
  const tiled = zones.filter((z) => z.pattern);
  if (tiled.length) {
    add('ok', 'Seamless wrap', tiled.map((z) => `${z.pattern.name} × ${z.repeats}`).join(' · '));
  }

  // 6. Comfort & material notes.
  if (design.width >= 8) add('info', 'Wide band fits snugly', 'Bands over 8 mm usually feel tighter. Consider going up half a size.',
    { label: 'Go up ½ size', patch: { sizeUS: Math.min(14, design.sizeUS + 0.5) } });
  if (m.id === 'tpu') add('info', 'Flexible fit', 'TPU stretches a little, so it forgives about half a size either way.');
  if (m.platable && design.plating !== 'none') add('info', 'Plating compensated', 'Plating adds about 0.05 mm. The inner diameter is enlarged to match.');
  if (m.platable && design.plating === 'none') add('info', 'Tip: plate it later', `Printed ${m.name} can be electroplated in gold or silver for a metal finish.`,
    { label: 'Preview gold plating', patch: { plating: 'gold' } });

  const order = { error: 0, warn: 1, info: 2, ok: 3 };
  checks.sort((a, b) => order[a.level] - order[b.level]);
  return {
    checks,
    errors: checks.filter((c) => c.level === 'error').length,
    warnings: checks.filter((c) => c.level === 'warn').length,
  };
}

export function estimate(design) {
  const m = getMaterial(design.materialId);
  const { innerD } = bandMetrics(design);
  const r = innerD / 2;
  const t = design.thickness + (design.style === 'raised' ? design.relief * 0.3 : -design.relief * 0.3);
  const volume = Math.PI * ((r + t) ** 2 - r ** 2) * design.width * PROFILE_FILL[design.profile]; // mm³
  const grams = (volume / 1000) * m.density;
  const plating = m.platable ? PLATINGS[design.plating] : null;
  const lines = [
    { label: `${m.name} · ${grams.toFixed(1)} g`, value: grams * m.perGram },
    { label: m.leadDays ? m.process : 'Printing at home (filament, power, supports)', value: m.setup },
  ];
  if (plating) lines.push({ label: plating.name, value: plating.price });
  if (design.finish === 'antique') lines.push({ label: 'Antique patina', value: m.metalness ? 12 : 0 });
  const total = lines.reduce((a, l) => a + l.value, 0);
  return { grams, volume, lines, total, leadDays: m.leadDays };
}

export const money = (v) => (v < 10 ? `$${v.toFixed(2)}` : `$${Math.round(v).toLocaleString('en-US')}`);
