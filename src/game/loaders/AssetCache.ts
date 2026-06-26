// ─── AssetCache ───────────────────────────────────────────────────────────────
// Smart cache of *fully decoded* images. Keeping the HTMLImageElement reference
// alive holds the decoded bitmap in the browser's resource cache, so when React
// later renders `<img src={sameUrl}>` it paints instantly — no re-fetch, no
// decode flicker.
//
// Responsibilities (Phase: Smart Progressive Asset Loading):
//   • decode-once with in-flight de-duplication
//   • retry a failed asset exactly once
//   • group assets by level so whole levels can be released
//   • pin global assets (logo) that must never be unloaded
//   • cap resident memory by unloading far-away levels

interface CacheEntry {
  img: HTMLImageElement;
  levels: Set<string>; // which level ids reference this url
  lastUsed: number;
}

class AssetCache {
  private cache = new Map<string, CacheEntry>();
  private inflight = new Map<string, Promise<HTMLImageElement>>();
  private pinned = new Set<string>();

  // ── Queries ───────────────────────────────────────────────────────────────

  has(url: string): boolean {
    return this.cache.has(url);
  }

  get(url: string): HTMLImageElement | undefined {
    const entry = this.cache.get(url);
    if (entry) entry.lastUsed = Date.now();
    return entry?.img;
  }

  /** Mark a url so it is never released by unloadExcept (e.g. the logo). */
  pin(url: string): void {
    this.pinned.add(url);
  }

  // ── Decode ──────────────────────────────────────────────────────────────────

  /**
   * Fully load + decode `url`, associating it with `levelId`. Resolves with the
   * decoded image. De-duplicates concurrent callers and reuses cached entries.
   * Retries once on failure before rejecting.
   */
  decode(url: string, levelId: string): Promise<HTMLImageElement> {
    const existing = this.cache.get(url);
    if (existing) {
      existing.levels.add(levelId);
      existing.lastUsed = Date.now();
      return Promise.resolve(existing.img);
    }

    const pending = this.inflight.get(url);
    if (pending) {
      // Still tag the requested level once it resolves.
      return pending.then((img) => {
        this.cache.get(url)?.levels.add(levelId);
        return img;
      });
    }

    const task = this.loadWithRetry(url)
      .then((img) => {
        this.cache.set(url, {
          img,
          levels: new Set([levelId]),
          lastUsed: Date.now(),
        });
        this.inflight.delete(url);
        return img;
      })
      .catch((err) => {
        this.inflight.delete(url);
        throw err;
      });

    this.inflight.set(url, task);
    return task;
  }

  private async loadWithRetry(url: string): Promise<HTMLImageElement> {
    try {
      return await this.loadOne(url);
    } catch {
      // Fail-safe: a single retry covers transient mobile-network blips.
      return await this.loadOne(url);
    }
  }

  private loadOne(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.decoding = 'async';
      img.onerror = () => reject(new Error(`asset failed: ${url}`));
      img.src = url;

      // Prefer decode() — it guarantees the bitmap is fully ready off the main
      // thread, so the first on-screen paint can't stutter. Some engines reject
      // decode() spuriously even when the image will load fine; fall back to the
      // load event in that case.
      if (typeof img.decode === 'function') {
        img
          .decode()
          .then(() => resolve(img))
          .catch(() => {
            if (img.complete && img.naturalWidth > 0) resolve(img);
            else {
              img.onload = () => resolve(img);
            }
          });
      } else {
        img.onload = () => resolve(img);
      }
    });
  }

  // ── Memory management ─────────────────────────────────────────────────────────

  /**
   * Release every cached asset that is NOT referenced by one of `keepLevelIds`
   * and is not pinned. Called by the streaming loader to bound memory to a small
   * window of levels (current + next two).
   */
  unloadExcept(keepLevelIds: string[]): void {
    const keep = new Set(keepLevelIds);
    for (const [url, entry] of this.cache) {
      if (this.pinned.has(url)) continue;
      let stillNeeded = false;
      for (const lvl of entry.levels) {
        if (keep.has(lvl)) {
          stillNeeded = true;
          break;
        }
      }
      if (!stillNeeded) {
        // Dropping the reference + clearing src lets the browser reclaim the
        // decoded bitmap.
        entry.img.src = '';
        this.cache.delete(url);
      }
    }
  }

  /** Number of resident decoded images — used by diagnostics/tests. */
  size(): number {
    return this.cache.size;
  }
}

export const assetCache = new AssetCache();
