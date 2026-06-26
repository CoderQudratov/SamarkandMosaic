/**
 * optimize-assets.mjs — pre-build PNG → WebP conversion
 *
 * Requires: npm install --save-dev sharp
 * Usage:    node scripts/optimize-assets.mjs
 *
 * Converts every PNG under public/assets/ to WebP with alpha preservation.
 * Original PNGs are kept as fallbacks for browsers that don't support WebP
 * (all modern mobile browsers support it; Telegram WebView does too).
 *
 * Quality targets:
 *   thumbnails  →  q=75  (display ~160px, detail not critical)
 *   board/guide →  q=80  (full-board art, needs good detail)
 *   pieces      →  q=85  (dragged with close inspection)
 *   logo        →  q=82
 */

import { createRequire } from 'module';
import { readdirSync, statSync, writeFileSync } from 'fs';
import { join, extname, basename, dirname } from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

let sharp;
try {
  sharp = require('sharp');
} catch {
  console.error(
    '\n❌  sharp is not installed.\n' +
    '   Run: npm install --save-dev sharp\n' +
    '   Then re-run: node scripts/optimize-assets.mjs\n',
  );
  process.exit(1);
}

/** Recursively find all PNGs under a directory. */
function findPNGs(dir) {
  const results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) results.push(...findPNGs(full));
    else if (entry.isFile() && extname(entry.name).toLowerCase() === '.png') {
      results.push(full);
    }
  }
  return results;
}

function qualityFor(filePath) {
  const name = basename(filePath).toLowerCase();
  if (name.includes('thumbnail')) return 72;
  if (name.includes('guide'))     return 78;
  if (name.includes('board'))     return 80;
  if (name.includes('logo'))      return 82;
  // pieces
  return 85;
}

async function convertOne(pngPath) {
  const webpPath = pngPath.replace(/\.png$/i, '.webp');
  const q = qualityFor(pngPath);

  const before = statSync(pngPath).size;
  await sharp(pngPath)
    .webp({ quality: q, alphaQuality: 90, effort: 5 })
    .toFile(webpPath);
  const after = statSync(webpPath).size;

  const saving = (((before - after) / before) * 100).toFixed(1);
  console.log(
    `  ✓  ${basename(pngPath)} → ${basename(webpPath)}` +
    `   ${(before / 1024).toFixed(0)}K → ${(after / 1024).toFixed(0)}K  (${saving}% smaller)`,
  );
  return { before, after };
}

async function main() {
  const dirs = [
    join(ROOT, 'public', 'assets'),
    join(ROOT, 'src', 'assets'),
  ];

  let totalBefore = 0;
  let totalAfter = 0;
  let count = 0;

  for (const dir of dirs) {
    console.log(`\n📂  ${dir}`);
    const pngs = findPNGs(dir);
    for (const p of pngs) {
      const { before, after } = await convertOne(p);
      totalBefore += before;
      totalAfter  += after;
      count++;
    }
  }

  const saved = ((totalBefore - totalAfter) / 1024).toFixed(0);
  const pct   = (((totalBefore - totalAfter) / totalBefore) * 100).toFixed(1);
  console.log(`\n✅  Converted ${count} files.  Saved ${saved} KB total (${pct}%)\n`);

  // Write a manifest so the app can prefer .webp when supported.
  const manifest = { generated: new Date().toISOString(), count };
  writeFileSync(join(ROOT, 'public', 'assets', 'webp-manifest.json'), JSON.stringify(manifest, null, 2));
}

main().catch((err) => { console.error(err); process.exit(1); });
