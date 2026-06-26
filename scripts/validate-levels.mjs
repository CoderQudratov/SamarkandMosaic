/**
 * validate-levels.mjs — level content validator
 *
 * Scans every level defined in the registry and reports:
 *   ✓  fully authored (level.json + board.png + guide.png + all pieces)
 *   ⚠  stub (level.json exists but art is missing — playable with fallbacks)
 *   ✗  broken (level.json is invalid or missing required fields)
 *   ○  missing (no level.json at all — level is locked placeholder only)
 *
 * Usage:  node scripts/validate-levels.mjs
 * Exit:   0 if all levels are at least ⚠ (stub), 1 if any are ✗/○
 */

import { readdirSync, existsSync, statSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PUBLIC_LEVELS = join(ROOT, 'public', 'assets', 'levels');

// ── Registry (mirrors src/game/levels/registry.ts) ─────────────────────────
const REGISTRY = [
  { id:  1, dirId: 'level-1',  pieceCount:  4, baseReward:  20, grid: [2, 2] },
  { id:  2, dirId: 'level-2',  pieceCount:  6, baseReward:  30, grid: [3, 2] },
  { id:  3, dirId: 'level-3',  pieceCount:  8, baseReward:  40, grid: [4, 2] },
  { id:  4, dirId: 'level-4',  pieceCount: 10, baseReward:  50, grid: [5, 2] },
  { id:  5, dirId: 'level-5',  pieceCount: 12, baseReward:  60, grid: [4, 3] },
  { id:  6, dirId: 'level-6',  pieceCount: 16, baseReward:  80, grid: [4, 4] },
  { id:  7, dirId: 'level-7',  pieceCount: 20, baseReward: 100, grid: [5, 4] },
  { id:  8, dirId: 'level-8',  pieceCount: 24, baseReward: 120, grid: [6, 4] },
  { id:  9, dirId: 'level-9',  pieceCount: 28, baseReward: 140, grid: [7, 4] },
  { id: 10, dirId: 'level-10', pieceCount: 32, baseReward: 160, grid: [8, 4] },
];

// ── Helpers ────────────────────────────────────────────────────────────────

function fileKB(path) {
  try { return Math.round(statSync(path).size / 1024); } catch { return null; }
}

function validateJson(path, expectedPieceCount) {
  let raw;
  try { raw = JSON.parse(readFileSync(path, 'utf8')); } catch {
    return { ok: false, error: 'JSON parse error' };
  }

  if (!raw.id || typeof raw.id !== 'string')
    return { ok: false, error: 'missing id' };
  if (typeof raw.board !== 'string')
    return { ok: false, error: 'missing board' };
  if (!Array.isArray(raw.pieces) || raw.pieces.length === 0)
    return { ok: false, error: 'pieces array empty or missing' };
  if (raw.pieces.length !== expectedPieceCount)
    return { ok: false, error: `piece count ${raw.pieces.length} ≠ registry ${expectedPieceCount}` };

  for (let i = 0; i < raw.pieces.length; i++) {
    const p = raw.pieces[i];
    if (!p.id || !p.image || typeof p.targetX !== 'number' || typeof p.targetY !== 'number'
        || typeof p.width !== 'number' || typeof p.height !== 'number') {
      return { ok: false, error: `piece[${i}] invalid schema` };
    }
    if (p.width <= 0 || p.height <= 0)
      return { ok: false, error: `piece[${i}] has zero or negative dimensions` };
  }

  return { ok: true, pieces: raw.pieces };
}

// ── Main ───────────────────────────────────────────────────────────────────

let errors = 0;

console.log('\n── Samarkand Mosaic — Level Validator ──\n');
console.log(
  'ID  Status  Pieces  Board    Guide    Thumbn.  Reward  Notes',
);
console.log('─'.repeat(76));

for (const meta of REGISTRY) {
  const dir  = join(PUBLIC_LEVELS, meta.dirId);
  const jsonPath  = join(dir, 'level.json');
  const boardPath = join(dir, 'board.png');
  const guidePath = join(dir, 'guide.png');
  const thumbPath = join(dir, 'thumbnail.png');

  const hasBoardArt = existsSync(boardPath);
  const hasGuide    = existsSync(guidePath);
  const hasThumb    = existsSync(thumbPath);
  const boardKB     = fileKB(boardPath);
  const guideKB     = fileKB(guidePath);
  const thumbKB     = fileKB(thumbPath);

  if (!existsSync(jsonPath)) {
    console.log(
      `#${String(meta.id).padStart(2)}  ○ missing  ${meta.pieceCount.toString().padStart(3)}p   ─        ─        ─        ${meta.baseReward}c`,
    );
    errors++;
    continue;
  }

  const { ok, error, pieces } = validateJson(jsonPath, meta.pieceCount);
  if (!ok) {
    console.log(
      `#${String(meta.id).padStart(2)}  ✗ BROKEN   ${meta.pieceCount.toString().padStart(3)}p   ─        ─        ─        ${meta.baseReward}c  ${error}`,
    );
    errors++;
    continue;
  }

  // Count piece PNGs actually present
  const presentPieces = pieces.filter((p) =>
    existsSync(join(dir, p.image)),
  ).length;
  const artComplete = hasBoardArt && hasGuide && presentPieces === meta.pieceCount;

  const status = artComplete ? '✓ full   ' : '⚠ stub   ';
  const boardStr  = hasBoardArt ? `${boardKB}K`.padEnd(8) : '─'.padEnd(8);
  const guideStr  = hasGuide    ? `${guideKB}K`.padEnd(8) : '─'.padEnd(8);
  const thumbStr  = hasThumb    ? `${thumbKB}K`.padEnd(8) : '─'.padEnd(8);
  const piecesStr = `${presentPieces}/${meta.pieceCount}`.padEnd(6);

  let notes = '';
  if (!artComplete) {
    const missing = [];
    if (!hasBoardArt) missing.push('board.png');
    if (!hasGuide) missing.push('guide.png');
    if (!hasThumb) missing.push('thumbnail.png');
    const missingPieces = meta.pieceCount - presentPieces;
    if (missingPieces > 0) missing.push(`${missingPieces} piece PNGs`);
    notes = `missing: ${missing.join(', ')}`;
  }

  console.log(
    `#${String(meta.id).padStart(2)}  ${status}${piecesStr}  ${boardStr}${guideStr}${thumbStr}${meta.baseReward}c   ${notes}`,
  );
}

console.log('─'.repeat(76));
const total = REGISTRY.length;
const ok    = REGISTRY.length - errors;
console.log(`\nResult: ${ok}/${total} valid levels  |  ${errors} error(s)\n`);

if (errors > 0) {
  console.error('❌  Fix the errors above before deploying.');
  process.exit(1);
} else {
  console.log('✅  All levels passed validation (stub levels will use placeholder art).\n');
}
