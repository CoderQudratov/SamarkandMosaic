// ─── LevelLoader ──────────────────────────────────────────────────────────────
// The single asset loader for level art (per the architecture's Folder Contract).
// It reads a level manifest, derives every image URL, and decodes them through
// the AssetCache. Used by:
//   • BootLoader        → preload level-1 before first play
//   • StreamLoader      → silently prefetch upcoming levels
//   • BoardSystem       → gate "ready" until the active level is fully decoded
//
// Level directories are named `level-<n>` under /assets/levels/.

import { levelBaseUrl } from '@/game/systems/BoardSystem';
import { assetCache } from './AssetCache';

interface ManifestLite {
  board: string;
  guide: string;
  pieceImages: string[];
}

export interface PreloadResult {
  ok: boolean;
  total: number;
  loaded: number;
  failed: string[];
}

const manifestCache = new Map<string, ManifestLite>();

/** Normalise any level reference to its directory id, e.g. 3 → "level-3". */
export function levelDirId(id: string | number): string {
  if (typeof id === 'number') return `level-${id}`;
  return id.startsWith('level-') ? id : `level-${id}`;
}

/** Fetch + lightly parse a level manifest. Returns null if the level is absent. */
async function fetchManifest(levelId: string): Promise<ManifestLite | null> {
  const cached = manifestCache.get(levelId);
  if (cached) return cached;

  try {
    const base = levelBaseUrl(levelId);
    const res = await fetch(`${base}/level.json`);
    if (!res.ok) return null; // level not authored yet — silent for streaming
    const raw = await res.json();

    const board = typeof raw?.board === 'string' ? raw.board : '';
    const guide = typeof raw?.guide === 'string' ? raw.guide : '';
    const pieceImages = Array.isArray(raw?.pieces)
      ? raw.pieces
          .map((p: unknown) =>
            p && typeof p === 'object' && typeof (p as { image?: unknown }).image === 'string'
              ? (p as { image: string }).image
              : '',
          )
          .filter(Boolean)
      : [];

    const manifest: ManifestLite = { board, guide, pieceImages };
    manifestCache.set(levelId, manifest);
    return manifest;
  } catch {
    return null;
  }
}

/** All decodable image URLs for a level, in load priority order. */
function manifestUrls(levelId: string, m: ManifestLite): string[] {
  const base = levelBaseUrl(levelId);
  const urls: string[] = [];
  if (m.board) urls.push(`${base}/${m.board}`);
  if (m.guide) urls.push(`${base}/${m.guide}`);
  for (const img of m.pieceImages) urls.push(`${base}/${img}`);
  return urls;
}

/**
 * Decode every image for `levelId`. Never throws — returns a summary so callers
 * can decide what to do. `onProgress` reports 0→1 across this level's assets.
 */
export async function preloadLevel(
  levelId: string,
  onProgress?: (fraction: number) => void,
): Promise<PreloadResult> {
  const manifest = await fetchManifest(levelId);
  if (!manifest) {
    onProgress?.(1);
    return { ok: false, total: 0, loaded: 0, failed: [] };
  }

  const urls = manifestUrls(levelId, manifest);
  if (urls.length === 0) {
    onProgress?.(1);
    return { ok: true, total: 0, loaded: 0, failed: [] };
  }

  let loaded = 0;
  const failed: string[] = [];

  await Promise.all(
    urls.map(async (url) => {
      try {
        await assetCache.decode(url, levelId);
      } catch {
        failed.push(url);
      } finally {
        loaded++;
        onProgress?.(loaded / urls.length);
      }
    }),
  );

  return { ok: failed.length === 0, total: urls.length, loaded, failed };
}

/** True once a level's manifest has been fetched (cheap cache check). */
export function isManifestCached(levelId: string): boolean {
  return manifestCache.has(levelId);
}
