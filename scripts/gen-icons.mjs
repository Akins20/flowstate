// Rasterize the SVG logos into the PNG sizes the Play Store / Android (TWA) and iOS need.
// Run with:  npm i -D @resvg/resvg-js && node scripts/gen-icons.mjs
import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pub = join(root, 'public');
const out = join(pub, 'icons');
mkdirSync(out, { recursive: true });

function render(svgFile, size, outFile) {
  const svg = readFileSync(join(pub, svgFile), 'utf8');
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();
  writeFileSync(join(out, outFile), png);
  console.log(`✓ icons/${outFile} (${size}px)`);
}

// "any" icons (rounded square on transparent corners)
render('icon.svg', 192, 'icon-192.png');
render('icon.svg', 512, 'icon-512.png');
render('icon.svg', 180, 'apple-touch-180.png');
// maskable icons (full-bleed background, safe-zone glyph)
render('icon-maskable.svg', 192, 'icon-maskable-192.png');
render('icon-maskable.svg', 512, 'icon-maskable-512.png');
