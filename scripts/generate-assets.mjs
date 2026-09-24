// Generates every app image from code (SVG → PNG with resvg), so the brand stays consistent:
//   npm run assets
// Logo: a 3×3 "habit heatmap" of rounded squares; the last cell holds a check mark.
import { writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';

const OUT = new URL('../assets/images/', import.meta.url);
const INDIGO = '#4f46e5';
const VIOLET = '#7c3aed';

/** 3×3 grid centered in a `size` canvas, `grid` px wide. */
function logo({ size, grid, cell, check, checkColor, mask = false }) {
  const gap = grid * 0.08;
  const step = (grid - gap * 2) / 3;
  const origin = (size - grid) / 2;
  const radius = step * 0.24;
  const opacities = [0.35, 0.6, 1, 0.6, 1, 0.35, 1, 0.6, 1];
  const cells = opacities.map((opacity, i) => {
    const x = origin + (i % 3) * (step + gap);
    const y = origin + Math.floor(i / 3) * (step + gap);
    return `<rect x="${x}" y="${y}" width="${step}" height="${step}" rx="${radius}" fill="${cell}" fill-opacity="${i === 8 ? 1 : opacity}"/>`;
  });
  // Check mark inside the last cell.
  const x = origin + 2 * (step + gap);
  const y = origin + 2 * (step + gap);
  const path = `M ${x + step * 0.24} ${y + step * 0.53} L ${x + step * 0.43} ${y + step * 0.72} L ${x + step * 0.77} ${y + step * 0.3}`;
  const stroke = `stroke-width="${step * 0.14}" stroke-linecap="round" stroke-linejoin="round" fill="none"`;
  if (mask) {
    // Monochrome icons are alpha-only: punch the check out of the cell.
    return `<defs><mask id="m"><rect width="${size}" height="${size}" fill="white"/><path d="${path}" stroke="black" ${stroke}/></mask></defs>
      <g mask="url(#m)">${cells.join('')}</g>`;
  }
  return `${cells.join('')}<path d="${path}" stroke="${checkColor ?? check}" ${stroke}/>`;
}

const gradient = `<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="${INDIGO}"/><stop offset="1" stop-color="${VIOLET}"/></linearGradient></defs>`;

const svg = (size, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${body}</svg>`;

function png(name, markup, width) {
  const image = new Resvg(markup, width ? { fitTo: { mode: 'width', value: width } } : {}).render();
  writeFileSync(new URL(name, OUT), image.asPng());
  console.log(`assets/images/${name} ${image.width}×${image.height}`);
}

// iOS / generic icon: full-bleed, no transparency (iOS applies its own mask).
png(
  'icon.png',
  svg(
    1024,
    `${gradient}<rect width="1024" height="1024" fill="url(#bg)"/>${logo({ size: 1024, grid: 600, cell: '#ffffff', check: INDIGO })}`,
  ),
);
// Android adaptive icon: logo inside the 66% safe zone on a separate background layer.
png(
  'android-icon-foreground.png',
  svg(1024, logo({ size: 1024, grid: 520, cell: '#ffffff', check: INDIGO })),
);
png(
  'android-icon-background.png',
  svg(1024, `${gradient}<rect width="1024" height="1024" fill="url(#bg)"/>`),
);
png(
  'android-icon-monochrome.png',
  svg(1024, logo({ size: 1024, grid: 520, cell: '#ffffff', mask: true })),
);
// Splash: logo on transparent (background color comes from app.json, light and dark).
png('splash-icon.png', svg(1024, logo({ size: 1024, grid: 1024, cell: INDIGO, check: '#ffffff' })));
// Web favicon.
png(
  'favicon.png',
  svg(
    1024,
    `${gradient}<rect width="1024" height="1024" rx="220" fill="url(#bg)"/>${logo({ size: 1024, grid: 680, cell: '#ffffff', check: INDIGO })}`,
  ),
  64,
);

// Android widget picker previews (approximate the real widgets).
const card = (w, h, inner) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <rect width="${w}" height="${h}" rx="40" fill="#ffffff"/>${inner}</svg>`;
const text = (x, y, value, size, weight = 400, color = '#17171c') =>
  `<text x="${x}" y="${y}" font-family="Arial, Helvetica, sans-serif" font-size="${size}" font-weight="${weight}" fill="${color}">${value}</text>`;
const habits = [
  ['Beber água', '#2563eb', true],
  ['Ler 20 páginas', '#7c3aed', true],
  ['Meditar', '#0f766e', false],
  ['Academia', '#dc2626', false],
];
png(
  'widget-today-preview.png',
  card(
    640,
    480,
    `${text(36, 70, 'Hoje', 40, 700)}${text(548, 70, '2/4', 32, 400, '#5c5c66')}
     <rect x="36" y="96" width="568" height="12" rx="6" fill="#ebebef"/>
     <rect x="36" y="96" width="284" height="12" rx="6" fill="${INDIGO}"/>
     ${habits
       .map(([name, color, done], i) => {
         const y = 150 + i * 78;
         return `<circle cx="64" cy="${y + 28}" r="26" fill="${done ? color : '#ffffff'}" stroke="${color}" stroke-width="5"/>
           ${done ? `<path d="M 52 ${y + 29} L 61 ${y + 38} L 77 ${y + 19}" stroke="#fff" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` : ''}
           ${text(110, y + 40, name, 32, 600)}`;
       })
       .join('')}`,
  ),
);
const heat = [];
for (let w = 0; w < 12; w++) {
  for (let d = 0; d < 7; d++) {
    const v = (w * 7 + d * 3) % 5;
    const alpha = [0, 0.3, 0.5, 0.75, 1][v];
    heat.push(
      `<rect x="${36 + w * 47}" y="${104 + d * 40}" width="38" height="32" rx="7" fill="${v === 0 ? '#ebebef' : INDIGO}" fill-opacity="${v === 0 ? 1 : alpha}"/>`,
    );
  }
}
png(
  'widget-heatmap-preview.png',
  card(640, 400, `${text(36, 70, 'Últimas semanas', 36, 700)}${heat.join('')}`),
);

// Paper grain tile for the light theme background (deterministic, tiles seamlessly).
const GRAIN = 96;
let seed = 7;
const rand = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const grains = Array.from({ length: 1400 }, () => {
  const x = Math.floor(rand() * GRAIN);
  const y = Math.floor(rand() * GRAIN);
  const dark = rand() > 0.45;
  const opacity = (0.03 + rand() * 0.05).toFixed(3);
  return `<rect x="${x}" y="${y}" width="1" height="1" fill="${dark ? '#5a4a2a' : '#ffffff'}" fill-opacity="${opacity}"/>`;
}).join('');
png('paper-texture.png', svg(GRAIN, grains));
