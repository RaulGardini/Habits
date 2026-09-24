// Generates every app image from code (SVG → PNG with resvg), so the brand stays consistent:
//   npm run assets
// Logo: a front-facing rubber duck with a wavy quiff, on the brand yellow.
import { writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';

const OUT = new URL('../assets/images/', import.meta.url);
const INDIGO = '#4f46e5';
const YELLOW = '#f6c343'; // brand primary (src/theme/tokens.ts)
const DUCK = '#ffe27a';
const DUCK_SHADE = '#e9a91c';
const EYE = '#3b2412';
const BEAK = '#ff8a1f';
const BEAK_SHADE = '#e86f0a';

/**
 * The duck, drawn on a 1024 canvas (about 640 × 800 around the center), scaled by `scale`.
 * `silhouette`: one flat color with the eyes cut out (Android monochrome icon).
 */
function duck({ scale = 1, silhouette, shadow = true } = {}) {
  const body = silhouette ?? DUCK;
  const shade = silhouette ?? DUCK_SHADE;
  const eyes = silhouette
    ? ''
    : `<ellipse cx="428" cy="392" rx="30" ry="38" fill="${EYE}"/>
       <ellipse cx="596" cy="392" rx="30" ry="38" fill="${EYE}"/>
       <circle cx="438" cy="378" r="11" fill="#ffffff"/>
       <circle cx="606" cy="378" r="11" fill="#ffffff"/>
       <path d="M402 476 q110 -56 220 0 q-24 70 -110 74 q-86 -4 -110 -74 z" fill="${BEAK}"/>
       <path d="M436 510 q76 32 152 0" fill="none" stroke="${BEAK_SHADE}" stroke-width="13" stroke-linecap="round"/>`;
  const shape = `
    <ellipse cx="512" cy="700" rx="300" ry="190" fill="${body}"/>
    <path d="M232 690 q-40 -70 30 -110 q40 60 10 130 z" fill="${shade}"/>
    <path d="M792 690 q40 -70 -30 -110 q-40 60 -10 130 z" fill="${shade}"/>
    <path d="M470 236 C 440 170, 470 120, 520 118 C 500 150, 505 180, 520 214 C 525 160, 560 120, 612 132 C 580 152, 566 190, 560 228 Z" fill="${body}"/>
    ${silhouette ? '' : `<path d="M520 214 C 505 180, 500 150, 520 118" fill="none" stroke="${DUCK_SHADE}" stroke-width="10" stroke-linecap="round" opacity="0.7"/>`}
    <circle cx="512" cy="430" r="215" fill="${body}"/>`;
  const cutEyes = silhouette
    ? `<defs><mask id="eyes"><rect width="1024" height="1024" fill="white"/>
         <ellipse cx="428" cy="392" rx="30" ry="38" fill="black"/><ellipse cx="596" cy="392" rx="30" ry="38" fill="black"/>
       </mask></defs>`
    : '';
  const drawing = `${shadow && !silhouette ? `<ellipse cx="512" cy="890" rx="250" ry="34" fill="${DUCK_SHADE}" opacity="0.35"/>` : ''}${shape}${eyes}`;
  return `${cutEyes}<g transform="translate(512 521) scale(${scale}) translate(-512 -521)"${silhouette ? ' mask="url(#eyes)"' : ''}>${drawing}</g>`;
}

const svg = (size, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${body}</svg>`;

function png(name, markup, width) {
  const image = new Resvg(markup, width ? { fitTo: { mode: 'width', value: width } } : {}).render();
  writeFileSync(new URL(name, OUT), image.asPng());
  console.log(`assets/images/${name} ${image.width}×${image.height}`);
}

// iOS / generic icon: full-bleed, no transparency (iOS applies its own mask).
png('icon.png', svg(1024, `<rect width="1024" height="1024" fill="${YELLOW}"/>${duck()}`));
// Android adaptive icon: duck inside the 66% safe zone on a separate background layer.
png('android-icon-foreground.png', svg(1024, duck({ scale: 0.62, shadow: false })));
png(
  'android-icon-background.png',
  svg(1024, `<rect width="1024" height="1024" fill="${YELLOW}"/>`),
);
png('android-icon-monochrome.png', svg(1024, duck({ scale: 0.62, silhouette: '#ffffff' })));
// Splash: the duck on transparent (background color comes from app.json, light and dark).
png('splash-icon.png', svg(1024, duck({ shadow: false })));
// Web favicon.
png(
  'favicon.png',
  svg(
    1024,
    `<rect width="1024" height="1024" rx="220" fill="${YELLOW}"/>${duck({ scale: 1.05, shadow: false })}`,
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
