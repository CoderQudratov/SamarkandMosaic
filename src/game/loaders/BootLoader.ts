// ─── BootLoader ───────────────────────────────────────────────────────────────
// Runs once at app launch. Preloads only what's needed to reach a flawless first
// play session — NOT every level:
//   • audio (Howler instances)
//   • logo (pinned — never unloaded)
//   • level-1 art (board, guide, pieces — fully decoded)
//
// UI icons are inline SVG and particles are runtime DOM, so neither needs
// network preloading. Reports weighted 0→100 progress for the boot screen.

import logoUrl from '@/assets/logo.png';
import { audioManager } from '@/game/audio/AudioManager';
import { assetCache } from './AssetCache';
import { preloadLevel } from './LevelLoader';

export interface BootResult {
  ok: boolean;
  failed: string[];
}

// Progress weighting (sums to 100). Level-1 dominates — it's the heaviest work.
const W_AUDIO = 20;
const W_LOGO = 10;
const W_LEVEL = 70;

const FIRST_LEVEL = 'level-1';

export async function runBootLoad(
  onProgress: (percent: number) => void,
): Promise<BootResult> {
  let audioFrac = 0;
  let logoFrac = 0;
  let levelFrac = 0;

  const emit = () =>
    onProgress(
      Math.min(
        100,
        Math.round(audioFrac * W_AUDIO + logoFrac * W_LOGO + levelFrac * W_LEVEL),
      ),
    );

  emit();

  // ── Audio (non-fatal: a missing track must not block launch) ───────────────
  const audioPromise = audioManager.whenReady(6000).then(() => {
    audioFrac = 1;
    emit();
  });

  // ── Logo (pinned so it survives level unloads) ─────────────────────────────
  assetCache.pin(logoUrl);
  const logoFailed: string[] = [];
  const logoPromise = assetCache
    .decode(logoUrl, '__global__')
    .catch(() => {
      logoFailed.push(logoUrl);
    })
    .finally(() => {
      logoFrac = 1;
      emit();
    });

  // ── Level-1 art (the only hard requirement for first play) ─────────────────
  const levelPromise = preloadLevel(FIRST_LEVEL, (f) => {
    levelFrac = f;
    emit();
  });

  const [, , levelRes] = await Promise.all([
    audioPromise,
    logoPromise,
    levelPromise,
  ]);

  onProgress(100);

  // Boot succeeds only if the first level's art is genuinely available.
  const levelOk = levelRes.total > 0 && levelRes.failed.length === 0;
  const failed = [...logoFailed];
  if (levelRes.total === 0) {
    failed.push(`${FIRST_LEVEL}/level.json`);
  } else {
    failed.push(...levelRes.failed);
  }

  return { ok: levelOk, failed };
}
