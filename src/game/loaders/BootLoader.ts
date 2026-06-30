// ─── BootLoader ───────────────────────────────────────────────────────────────
// Runs once at app launch.  Preloads only what's needed before first render:
//   • audio   (Howler instances — init before user interaction)
//   • logo    (pinned — never unloaded)
//
// Level art is loaded on-demand by SwapPuzzleBoard via native <img> elements
// (browser HTTP-cache handles repeat visits).  No explicit level preload needed.

import logoUrl from '@/assets/logo.png';
import { audioManager } from '@/game/audio/AudioManager';
import { assetCache } from './AssetCache';

export interface BootResult {
  ok: boolean;
  failed: string[];
}

const W_AUDIO = 60;
const W_LOGO  = 40;

export async function runBootLoad(
  onProgress: (percent: number) => void,
): Promise<BootResult> {
  let audioFrac = 0;
  let logoFrac  = 0;

  const emit = () =>
    onProgress(
      Math.min(100, Math.round(audioFrac * W_AUDIO + logoFrac * W_LOGO)),
    );

  emit();

  const logoFailed: string[] = [];

  assetCache.pin(logoUrl);
  const logoPromise = assetCache
    .decode(logoUrl, '__global__')
    .catch(() => { logoFailed.push(logoUrl); })
    .finally(() => { logoFrac = 1; emit(); });

  const audioPromise = audioManager.whenReady(6000).then(() => {
    audioFrac = 1;
    emit();
  });

  await Promise.all([audioPromise, logoPromise]);

  onProgress(100);

  return { ok: true, failed: logoFailed };
}
