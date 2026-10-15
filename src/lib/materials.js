// Materials drive the render, the printability limits and the price estimate.
// Prices are illustrative estimates for the prototype, not quotes.

export const MATERIALS = [
  {
    id: 'silver', name: 'Sterling silver', group: 'Precious metals', process: 'Lost-wax casting',
    color: '#dfe1e4', metalness: 1, roughness: 0.16,
    density: 10.36, perGram: 2.4, setup: 48, minWall: 0.8, minDetail: 0.35, leadDays: 7,
  },
  {
    id: 'gold-yellow', name: '14k yellow gold', group: 'Precious metals', process: 'Lost-wax casting',
    color: '#e3bd6f', metalness: 1, roughness: 0.14,
    density: 13.07, perGram: 78, setup: 95, minWall: 0.8, minDetail: 0.35, leadDays: 10,
  },
  {
    id: 'gold-rose', name: '14k rose gold', group: 'Precious metals', process: 'Lost-wax casting',
    color: '#e6ad94', metalness: 1, roughness: 0.15,
    density: 13.07, perGram: 78, setup: 95, minWall: 0.8, minDetail: 0.35, leadDays: 10,
  },
  {
    id: 'gold-white', name: '14k white gold', group: 'Precious metals', process: 'Lost-wax casting',
    color: '#ebe8e1', metalness: 1, roughness: 0.13,
    density: 12.61, perGram: 80, setup: 95, minWall: 0.8, minDetail: 0.35, leadDays: 10,
  },
  {
    id: 'titanium', name: 'Titanium', group: 'Metals', process: 'Metal 3D printing (DMLS)',
    color: '#aaa69f', metalness: 1, roughness: 0.32,
    density: 4.43, perGram: 9, setup: 70, minWall: 1.0, minDetail: 0.5, leadDays: 12,
  },
  {
    id: 'steel', name: 'Stainless steel', group: 'Metals', process: 'Metal 3D printing (binder jet)',
    color: '#c9cacc', metalness: 1, roughness: 0.24,
    density: 8.0, perGram: 1.6, setup: 35, minWall: 1.0, minDetail: 0.5, leadDays: 9,
  },
  {
    id: 'brass', name: 'Brass', group: 'Metals', process: 'Lost-wax casting',
    color: '#d2ad62', metalness: 1, roughness: 0.2,
    density: 8.5, perGram: 0.9, setup: 30, minWall: 0.8, minDetail: 0.4, leadDays: 7,
  },
  {
    id: 'resin', name: 'Tough resin', group: 'Print at home', process: 'Resin printer (SLA / MSLA)',
    color: '#4a4e57', metalness: 0, roughness: 0.38, platable: true,
    density: 1.15, perGram: 0.35, setup: 4, minWall: 0.8, minDetail: 0.3, leadDays: 0,
  },
  {
    id: 'pla', name: 'PLA', group: 'Print at home', process: 'Filament printer (FDM)',
    color: '#e9e4da', metalness: 0, roughness: 0.62, platable: true,
    density: 1.24, perGram: 0.05, setup: 3, minWall: 1.2, minDetail: 0.6, leadDays: 0,
  },
  {
    id: 'tpu', name: 'Flexible TPU', group: 'Print at home', process: 'Filament printer (FDM)',
    color: '#2b2d31', metalness: 0, roughness: 0.82,
    density: 1.21, perGram: 0.08, setup: 3, minWall: 1.5, minDetail: 0.8, leadDays: 0,
  },
];

// Electroplating turns a printed polymer ring into a metal-look ring.
export const PLATINGS = {
  none: null,
  gold: { name: 'Gold plating', color: '#e3bd6f', metalness: 1, roughness: 0.18, price: 25 },
  silver: { name: 'Silver plating', color: '#dcdee2', metalness: 1, roughness: 0.2, price: 18 },
  rose: { name: 'Rose gold plating', color: '#e6ad94', metalness: 1, roughness: 0.2, price: 25 },
};

export const getMaterial = (id) => MATERIALS.find((m) => m.id === id) || MATERIALS[0];

/** Render settings after applying plating and finish. */
export function renderLook(design) {
  const m = getMaterial(design.materialId);
  const plate = m.platable ? PLATINGS[design.plating || 'none'] : null;
  const look = plate ? { color: plate.color, metalness: plate.metalness, roughness: plate.roughness } : {
    color: m.color, metalness: m.metalness, roughness: m.roughness,
  };
  if (design.finish === 'satin') look.roughness = Math.min(1, look.roughness + 0.26);
  return look;
}
