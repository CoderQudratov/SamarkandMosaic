// ─── SaveSystem ───────────────────────────────────────────────────────────────
// Unified, versioned save on top of the existing per-key persistence.
//
// Design:
//   • Per-key stores (sm_hearts, sm_progress, sm_coins, …) remain unchanged —
//     they are written on every action and are the hot path for individual fields.
//   • SaveSystem writes one additional key (sm_save) containing a full snapshot.
//     This key is the source of truth for: stats, version metadata, and backup
//     restoration if individual keys are wiped.
//   • load()    — called synchronously before React mounts; patches stores from
//                 the unified save (stats + backup progression/economy).
//   • save()    — debounced 300 ms; triggered by store subscriptions and
//                 explicit track*() calls.
//   • reset()   — clears all sm_* keys and resets stores to factory defaults.

import { storageService } from '@/services/storage.service';
import { usePlayerStore } from '@/store/playerStore';
import { useGameStore, MAX_HEARTS } from '@/store/gameStore';
import { useLevelStore } from '@/store/levelStore';
import { SAVE_VERSION, type SaveData, type SaveStats } from '@/game/types/save';

const SAVE_KEY = 'save';

// ── Per-key identifiers (must match each store's own constant) ───────────────
const ALL_KEYS = ['save', 'progress', 'coins', 'hints', 'shards', 'hearts', 'daily', 'last_level'];

// ── In-memory stats (not tracked in any Zustand store) ──────────────────────
let _stats: SaveStats = { totalWins: 0, totalMistakes: 0, totalHintsUsed: 0 };

// ── Debounce ─────────────────────────────────────────────────────────────────
let _debounceTimer: ReturnType<typeof setTimeout> | null = null;
const DEBOUNCE_MS = 300;

// ── Helpers ──────────────────────────────────────────────────────────────────

/** "level-3" → 3, any bad input → 0 */
function parseLevelId(s: string): number {
  const n = parseInt(s.replace(/\D+/g, ''), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function buildSnapshot(): SaveData {
  const p = usePlayerStore.getState();
  const g = useGameStore.getState();
  const { progress } = p;
  const selected = useLevelStore.getState().selectedLevelId;

  const completedIds = progress.completedLevels;
  const unlockedIds = [1, ...completedIds.map((n) => n + 1)].filter(
    (v, i, a) => a.indexOf(v) === i,
  );

  return {
    version: SAVE_VERSION,
    progression: {
      currentLevel: selected,
      unlockedLevels: unlockedIds.map((n) => `level-${n}`),
      completedLevels: completedIds.map((n) => `level-${n}`),
      stars: Object.fromEntries(
        Object.entries(progress.stars).map(([k, v]) => [`level-${k}`, v]),
      ),
    },
    economy: {
      hearts: g.hearts,
      hints: p.hints,
      coins: p.coins,
    },
    stats: { ..._stats },
  };
}

// ── Validation ───────────────────────────────────────────────────────────────

function isValidSave(raw: unknown): raw is SaveData {
  if (typeof raw !== 'object' || raw === null) return false;
  const d = raw as Record<string, unknown>;
  if (typeof d.version !== 'number') return false;
  if (typeof d.progression !== 'object' || d.progression === null) return false;
  if (typeof d.economy !== 'object' || d.economy === null) return false;
  if (typeof d.stats !== 'object' || d.stats === null) return false;
  return true;
}

// ── Migration ────────────────────────────────────────────────────────────────

function migrate(data: SaveData): SaveData {
  // v1 is the initial version — nothing to migrate yet. Extend as versions grow.
  if (data.version === SAVE_VERSION) return data;

  // Unknown future version: strip unrecognised fields and keep what we understand.
  // eslint-disable-next-line no-console
  console.warn(`[SaveSystem] Unknown save version ${data.version} — falling back to defaults for unrecognised fields.`);
  return {
    version: SAVE_VERSION,
    progression: {
      currentLevel: (data.progression as SaveData['progression'])?.currentLevel ?? 1,
      unlockedLevels: [],
      completedLevels: [],
      stars: {},
    },
    economy: {
      hearts: MAX_HEARTS,
      hints: 0,
      coins: 0,
    },
    stats: { totalWins: 0, totalMistakes: 0, totalHintsUsed: 0 },
  };
}

// ── Restore (apply snapshot → stores) ───────────────────────────────────────

function applySnapshot(data: SaveData): void {
  const playerState = usePlayerStore.getState();
  const { progression, economy, stats } = data;

  // Stats — only tracked in the unified save.
  _stats = {
    totalWins: typeof stats.totalWins === 'number' ? stats.totalWins : 0,
    totalMistakes: typeof stats.totalMistakes === 'number' ? stats.totalMistakes : 0,
    totalHintsUsed: typeof stats.totalHintsUsed === 'number' ? stats.totalHintsUsed : 0,
  };

  // Progression — apply only when the save has more completed levels than what
  // the per-key system already loaded (handles wiped sm_progress scenario).
  const savedCompleted = Array.isArray(progression.completedLevels)
    ? progression.completedLevels.map(parseLevelId).filter((n) => n > 0)
    : [];
  const savedStars: Record<number, number> = {};
  if (progression.stars && typeof progression.stars === 'object') {
    for (const [k, v] of Object.entries(progression.stars)) {
      const id = parseLevelId(k);
      if (id > 0 && typeof v === 'number') savedStars[id] = v;
    }
  }

  const currentProgress = playerState.progress;
  const needsProgressRestore =
    savedCompleted.length > currentProgress.completedLevels.length;
  if (needsProgressRestore) {
    const merged = {
      completedLevels: savedCompleted,
      highestLevel: savedCompleted.length > 0 ? Math.max(...savedCompleted) : 0,
      totalSnaps: currentProgress.totalSnaps,
      stars: { ...savedStars, ...currentProgress.stars }, // local stars win ties
    };
    playerState.setProgress(merged);
  } else {
    // Even if local progress is ahead, merge stars (best of both).
    const mergedStars = { ...savedStars, ...currentProgress.stars };
    const hasNewStars = Object.entries(mergedStars).some(
      ([k, v]) => currentProgress.stars[Number(k)] !== v,
    );
    if (hasNewStars) {
      playerState.setProgress({ stars: mergedStars });
    }
  }

  // Economy — apply if the save has more coins/hints than per-key loaded.
  if (typeof economy.coins === 'number' && economy.coins > playerState.coins) {
    usePlayerStore.setState({ coins: economy.coins });
  }
  if (typeof economy.hints === 'number' && economy.hints > playerState.hints) {
    usePlayerStore.setState({ hints: economy.hints });
  }
  // Hearts: gameStore already loaded from sm_hearts; only restore if save is
  // strictly higher (prevents inadvertent heart grants on migration).
  const gameState = useGameStore.getState();
  if (
    typeof economy.hearts === 'number' &&
    economy.hearts > gameState.hearts &&
    economy.hearts <= MAX_HEARTS
  ) {
    // Use existing addHeart() rather than bypassing the clock logic.
    const needed = Math.min(economy.hearts - gameState.hearts, MAX_HEARTS);
    for (let i = 0; i < needed; i++) useGameStore.getState().addHeart();
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

function scheduleSave(): void {
  if (_debounceTimer) clearTimeout(_debounceTimer);
  _debounceTimer = setTimeout(() => {
    _debounceTimer = null;
    try {
      storageService.set(SAVE_KEY, buildSnapshot());
    } catch {
      // localStorage full or unavailable — non-fatal, per-key data is still safe
    }
  }, DEBOUNCE_MS);
}

function load(): void {
  try {
    const raw = storageService.get<unknown>(SAVE_KEY);
    if (!raw) return; // first launch — per-key fallback already loaded into stores

    if (!isValidSave(raw)) {
      // eslint-disable-next-line no-console
      console.warn('[SaveSystem] Corrupt save data — using per-key fallback.');
      return; // CASE 3: invalid JSON / bad shape — stores already have per-key data
    }

    applySnapshot(migrate(raw));
  } catch (err) {
    // Corruption guard: any unexpected error must not crash the app.
    // eslint-disable-next-line no-console
    console.warn('[SaveSystem] load() threw — using per-key fallback.', err);
  }
}

function save(): void {
  scheduleSave();
}

function reset(): void {
  // Cancel any pending debounced save before clearing keys.
  if (_debounceTimer) {
    clearTimeout(_debounceTimer);
    _debounceTimer = null;
  }

  // Wipe all game state keys.
  for (const key of ALL_KEYS) storageService.remove(key);
  _stats = { totalWins: 0, totalMistakes: 0, totalHintsUsed: 0 };

  // Reset stores via existing public actions (no direct setState hacks).
  usePlayerStore.getState().setProgress({
    completedLevels: [],
    highestLevel: 0,
    totalSnaps: 0,
    stars: {},
  });
  usePlayerStore.getState().resetEconomy();
  useGameStore.getState().resetHearts(); // restores to MAX_HEARTS + persists
}

// Stat trackers — called from PuzzleBoard at game events.
function trackWin(): void {
  _stats.totalWins += 1;
  scheduleSave();
}
function trackMistake(): void {
  _stats.totalMistakes += 1;
  // No forced save — already debounced by the hearts-change subscription.
}
function trackHintUsed(): void {
  _stats.totalHintsUsed += 1;
  scheduleSave();
}

function getStats(): Readonly<SaveStats> {
  return { ..._stats };
}

/**
 * Wire store subscriptions so any relevant state change triggers a debounced
 * save. Call once after stores are initialised (from bootstrapSync).
 */
function init(): void {
  // Hearts / refill timestamp change → save
  useGameStore.subscribe((state, prev) => {
    if (state.hearts !== prev.hearts || state.lastRefillTs !== prev.lastRefillTs) {
      scheduleSave();
    }
  });

  // Progress / coins / hints change → save
  usePlayerStore.subscribe((state, prev) => {
    if (
      state.progress !== prev.progress ||
      state.coins !== prev.coins ||
      state.hints !== prev.hints
    ) {
      scheduleSave();
    }
  });
}

export const saveSystem = { load, save, reset, init, trackWin, trackMistake, trackHintUsed, getStats };
