// ─── SyncManager ─────────────────────────────────────────────────────────────
// Multi-device save sync with three-source conflict resolution.
//
// Sources (in order of query during boot):
//   1. localStorage   — always present, always fast, the primary write target
//   2. Supabase       — cloud persistence, requires network + auth
//   3. Telegram CloudStorage — per-user cloud tied to the Telegram account
//
// Responsibilities:
//   • bootSync()  — loads all 3, resolves conflicts, hydrates stores, writes back
//   • push()      — debounced 500ms write of current store state to all clouds
//   • bumpVersion() — increment saveVersion on meaningful game events
//
// Merge rules (field-by-field, no source "wins" globally):
//   completedLevels  → union
//   stars            → max per level
//   coins, hints     → max
//   highestLevel     → max
//   totalSnaps       → sum
//   hearts           → take from most-recent source (by updatedAt)
//   daily streak     → take from most-recent source (by lastClaimAt)
//   stats            → sum totals, max wins
//
// Conflict resolution (for time-sensitive fields only):
//   local.saveVersion  > cloud.saveVersion → local value used
//   cloud.saveVersion  > local.saveVersion → cloud value used
//   equal saveVersions → merge (take max / sum as above)

import { storageService } from '@/services/storage.service';
import { usePlayerStore } from '@/store/playerStore';
import { useGameStore, MAX_HEARTS } from '@/store/gameStore';
import { progressService } from '@/services/progress.service';
import { economyService } from '@/services/economy.service';
import { dailyRewardsService } from '@/services/daily_rewards.service';
import { saveSystem } from './SaveSystem';
import * as TelegramStorage from '@/integrations/telegram/TelegramStorage';
import type { CloudSave } from '@/game/types/save';

// ── Constants ─────────────────────────────────────────────────────────────────

const TG_CLOUD_KEY = 'sm_cloud_save';   // Telegram CloudStorage key
const LOCAL_CLOUD_KEY = 'cloud_save';   // localStorage mirror of the cloud save
const BOOT_TIMEOUT_MS = 3000;
const PUSH_DEBOUNCE_MS = 500;

// ── Module state ──────────────────────────────────────────────────────────────

let _saveVersion = 0;
let _pushTimer: ReturnType<typeof setTimeout> | null = null;

// ── Helpers ───────────────────────────────────────────────────────────────────

function now(): string {
  return new Date().toISOString();
}

function tsMs(iso: string | number): number {
  if (typeof iso === 'number') return iso;
  const t = Date.parse(iso);
  return isNaN(t) ? 0 : t;
}

function cap<T extends number>(v: T, max: T): T {
  return Math.min(v, max) as T;
}

// ── Snapshot builder ──────────────────────────────────────────────────────────

export function buildCloudSave(): CloudSave {
  const p = usePlayerStore.getState();
  const g = useGameStore.getState();
  const { progress } = p;

  const daily = storageService.get<{ streakDay: number; lastClaimAt: number }>('daily') ?? {
    streakDay: 1,
    lastClaimAt: 0,
  };

  const stats = saveSystem.getStats();

  return {
    schemaVersion: 1,
    saveVersion: _saveVersion,
    updatedAt: now(),

    progression: {
      completedLevels: progress.completedLevels,
      stars: progress.stars ?? {},
      highestLevel: progress.highestLevel,
      totalSnaps: progress.totalSnaps,
    },

    economy: {
      coins: p.coins,
      hints: p.hints,
      hearts: g.hearts,
      heartLastRefillTs: g.lastRefillTs,
    },

    daily: {
      streakDay: daily.streakDay,
      lastClaimAt: daily.lastClaimAt,
    },

    stats: {
      totalWins: stats.totalWins,
      totalMistakes: stats.totalMistakes,
      totalHintsUsed: stats.totalHintsUsed,
    },
  };
}

// ── Validation ────────────────────────────────────────────────────────────────

function isValidCloudSave(raw: unknown): raw is CloudSave {
  if (typeof raw !== 'object' || raw === null) return false;
  const d = raw as Record<string, unknown>;
  return (
    d.schemaVersion === 1 &&
    typeof d.saveVersion === 'number' &&
    typeof d.updatedAt === 'string' &&
    typeof d.progression === 'object' && d.progression !== null &&
    typeof d.economy === 'object' && d.economy !== null &&
    typeof d.daily === 'object' && d.daily !== null &&
    typeof d.stats === 'object' && d.stats !== null
  );
}

function sanitise(raw: unknown): CloudSave | null {
  if (!isValidCloudSave(raw)) return null;
  const d = raw;

  // Clamp all economy values at DB constraint limits.
  const coins  = Math.max(0, Math.min(Math.floor(d.economy.coins  ?? 0), 10_000_000));
  const hints  = Math.max(0, Math.min(Math.floor(d.economy.hints  ?? 0), 9_999));
  const hearts = Math.max(0, Math.min(Math.floor(d.economy.hearts ?? MAX_HEARTS), MAX_HEARTS));
  const streak = Math.max(1, Math.min(Math.floor(d.daily.streakDay ?? 1), 7));

  return {
    ...d,
    economy: { ...d.economy, coins, hints, hearts },
    daily:   { ...d.daily,   streakDay: streak },
  };
}

// ── Merge logic ───────────────────────────────────────────────────────────────

/**
 * Merge two CloudSave snapshots field-by-field.
 * `refSave` is the "reference" (higher saveVersion) used for time-sensitive
 * fields (hearts, daily streak) where "latest wins" rather than "max wins".
 */
function mergeSaves(a: CloudSave, b: CloudSave): CloudSave {
  // Determine which is the reference source for time-sensitive fields.
  // Higher saveVersion = more recent writes; ISO updatedAt breaks ties.
  const aIsRef =
    a.saveVersion > b.saveVersion ||
    (a.saveVersion === b.saveVersion && tsMs(a.updatedAt) >= tsMs(b.updatedAt));
  const ref = aIsRef ? a : b;

  // ── completedLevels: union ─────────────────────────────────────────────────
  const completedSet = new Set([
    ...a.progression.completedLevels,
    ...b.progression.completedLevels,
  ]);
  const completedLevels = Array.from(completedSet).sort((x, y) => x - y);

  // ── stars: max per level ───────────────────────────────────────────────────
  const allLevelKeys = new Set([
    ...Object.keys(a.progression.stars),
    ...Object.keys(b.progression.stars),
  ]);
  const stars: Record<string, number> = {};
  for (const k of allLevelKeys) {
    stars[k] = Math.max(a.progression.stars[k] ?? 0, b.progression.stars[k] ?? 0);
  }

  // ── highestLevel: max ──────────────────────────────────────────────────────
  const highestLevel = Math.max(
    a.progression.highestLevel,
    b.progression.highestLevel,
  );

  // ── totalSnaps: sum ────────────────────────────────────────────────────────
  const totalSnaps = a.progression.totalSnaps + b.progression.totalSnaps;

  // ── coins, hints: max ──────────────────────────────────────────────────────
  const coins = Math.max(a.economy.coins, b.economy.coins);
  const hints = Math.max(a.economy.hints, b.economy.hints);

  // ── hearts + regen timestamp: take from reference ─────────────────────────
  // Both come from the same source so the countdown stays correct.
  const hearts            = cap(ref.economy.hearts, MAX_HEARTS as number);
  const heartLastRefillTs = ref.economy.heartLastRefillTs;

  // ── daily streak: take the more recently claimed ───────────────────────────
  const daily = a.daily.lastClaimAt >= b.daily.lastClaimAt ? a.daily : b.daily;

  // ── stats: sum wins + mistakes + hints ────────────────────────────────────
  const stats = {
    totalWins:      a.stats.totalWins      + b.stats.totalWins,
    totalMistakes:  a.stats.totalMistakes  + b.stats.totalMistakes,
    totalHintsUsed: a.stats.totalHintsUsed + b.stats.totalHintsUsed,
  };

  return {
    schemaVersion: 1,
    saveVersion: Math.max(a.saveVersion, b.saveVersion),
    updatedAt: aIsRef ? a.updatedAt : b.updatedAt,
    progression: { completedLevels, stars, highestLevel, totalSnaps },
    economy:     { coins, hints, hearts, heartLastRefillTs },
    daily,
    stats,
  };
}

/**
 * Resolve an arbitrary number of nullable sources into one merged CloudSave.
 * Returns null if every source is null (first launch / completely fresh device).
 */
function resolveAll(...sources: Array<CloudSave | null>): CloudSave | null {
  const valid = sources.filter((s): s is CloudSave => s !== null);
  if (valid.length === 0) return null;
  return valid.reduce(mergeSaves);
}

// ── Apply to stores ───────────────────────────────────────────────────────────

function applyCloudSave(save: CloudSave): void {
  const player = usePlayerStore.getState();
  const game = useGameStore.getState();

  const { progression, economy, daily, stats } = save;

  // ── Progression ────────────────────────────────────────────────────────────
  // Only apply if the remote has at least as much completion as local
  // (prevents accidentally overwriting a session that just completed levels
  // before the network response arrived).
  const local = player.progress;
  const numericStars: Record<number, number> = {};
  for (const [k, v] of Object.entries(progression.stars)) {
    const id = parseInt(k, 10);
    if (id > 0) numericStars[id] = v;
  }
  const mergedStars = { ...numericStars, ...local.stars }; // local stars always win ties

  player.setProgress({
    completedLevels: progression.completedLevels.length >= local.completedLevels.length
      ? progression.completedLevels
      : local.completedLevels,
    highestLevel: Math.max(progression.highestLevel, local.highestLevel),
    totalSnaps: Math.max(progression.totalSnaps, local.totalSnaps),
    stars: mergedStars,
  });

  // ── Economy ────────────────────────────────────────────────────────────────
  if (economy.coins > player.coins) {
    usePlayerStore.setState({ coins: economy.coins });
    storageService.set('coins', economy.coins);
  }
  if (economy.hints > player.hints) {
    usePlayerStore.setState({ hints: economy.hints });
    storageService.set('hints', economy.hints);
  }

  // Hearts: apply only if cloud value is ≥ local AND regen clock looks valid.
  const heartAge = Date.now() - economy.heartLastRefillTs;
  const clockLooksValid = heartAge >= 0 && heartAge < 7 * 24 * 3600 * 1000; // within 7 days
  if (
    clockLooksValid &&
    economy.hearts >= game.hearts &&
    economy.hearts <= MAX_HEARTS
  ) {
    // Directly patch the store state + persist so regen clock is also restored.
    useGameStore.setState({
      hearts: economy.hearts,
      lastRefillTs: economy.heartLastRefillTs,
    });
    storageService.set('hearts', {
      hearts: economy.hearts,
      lastRefillTs: economy.heartLastRefillTs,
    });
    // If we're now below full, the regen timer should be running from the persisted ts.
    // applyRefill() catches any accrued regen from while the device was offline.
    game.applyRefill();
  }

  // ── Daily streak ───────────────────────────────────────────────────────────
  const localDaily = storageService.get<{ streakDay: number; lastClaimAt: number }>('daily');
  if (daily.lastClaimAt > (localDaily?.lastClaimAt ?? 0)) {
    storageService.set('daily', {
      streakDay: daily.streakDay,
      lastClaimAt: daily.lastClaimAt,
    });
  }

  // ── Stats (in-memory only — SaveSystem owns these) ────────────────────────
  // We hand them back via trackWin / trackMistake etc on the next save,
  // so there's no direct hook. Instead we bump the saveSystem state via the
  // existing public API. This is a best-effort restore.
  // No public setter exists — stats are reconstructed via gameplay events,
  // so we only update the in-memory counter if the cloud value is higher.
  const localStats = saveSystem.getStats();
  for (let i = 0; i < Math.max(0, stats.totalWins - localStats.totalWins); i++) {
    saveSystem.trackWin();
  }
  for (let i = 0; i < Math.max(0, stats.totalMistakes - localStats.totalMistakes); i++) {
    saveSystem.trackMistake();
  }
  for (let i = 0; i < Math.max(0, stats.totalHintsUsed - localStats.totalHintsUsed); i++) {
    saveSystem.trackHintUsed();
  }
}

// ── Source loaders ────────────────────────────────────────────────────────────

function loadFromLocalStorage(): CloudSave | null {
  try {
    const raw = storageService.get<unknown>(LOCAL_CLOUD_KEY);
    return sanitise(raw);
  } catch {
    return null;
  }
}

async function loadFromTelegramCloud(): Promise<CloudSave | null> {
  try {
    const raw = await TelegramStorage.loadJSON<unknown>(TG_CLOUD_KEY);
    return sanitise(raw);
  } catch {
    return null;
  }
}

async function loadFromSupabase(telegramId: number): Promise<CloudSave | null> {
  if (!telegramId) return null;
  try {
    const [progress, economy, daily] = await Promise.all([
      progressService.load(telegramId),
      economyService.load(telegramId),
      dailyRewardsService.load(telegramId),
    ]);

    if (!progress && !economy && !daily) return null;

    return sanitise({
      schemaVersion: 1,
      // Supabase rows don't carry saveVersion — use 0 so local/telegram beat it
      // when they have a higher version (they were more recently written).
      saveVersion: 0,
      updatedAt: now(),
      progression: {
        completedLevels: progress?.completedLevels ?? [],
        stars:            progress?.stars            ?? {},
        highestLevel:     progress?.highestLevel     ?? 0,
        totalSnaps:       progress?.totalSnaps       ?? 0,
      },
      economy: {
        coins:            economy?.coins  ?? 0,
        hints:            economy?.hints  ?? 0,
        hearts:           economy?.hearts ?? MAX_HEARTS,
        heartLastRefillTs: 0, // not stored in Supabase
      },
      daily: {
        streakDay:  daily?.streakDay  ?? 1,
        lastClaimAt: daily?.lastClaimAt ?? 0,
      },
      stats: { totalWins: 0, totalMistakes: 0, totalHintsUsed: 0 },
    });
  } catch {
    return null;
  }
}

// ── Write back ─────────────────────────────────────────────────────────────────

async function writeAllClouds(save: CloudSave, telegramId: number): Promise<void> {
  const serialised = JSON.stringify(save);

  // 1. localStorage mirror (synchronous — always succeeds if storage available)
  try { storageService.set(LOCAL_CLOUD_KEY, save); } catch { /* noop */ }

  // 2. Telegram CloudStorage (async, best-effort)
  // Only attempt if the serialised value fits within the 4096-char limit.
  if (serialised.length <= 4096) {
    TelegramStorage.saveJSON(TG_CLOUD_KEY, save).catch(() => { /* noop */ });
  }

  // 3. Supabase (async, best-effort via existing services)
  if (telegramId && telegramId !== 0) {
    const { progression, economy, daily } = save;
    progressService.save(telegramId, {
      completedLevels: progression.completedLevels,
      highestLevel:    progression.highestLevel,
      totalSnaps:      progression.totalSnaps,
      stars:           progression.stars,
    }).catch(() => { /* noop */ });

    economyService.save(telegramId, {
      coins:  economy.coins,
      hints:  economy.hints,
      hearts: economy.hearts,
      shards: usePlayerStore.getState().shards ?? 0,
    }).catch(() => { /* noop */ });

    dailyRewardsService.save(telegramId, {
      streakDay:   daily.streakDay,
      lastClaimAt: daily.lastClaimAt,
    }).catch(() => { /* noop */ });
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Increment the monotonic save version counter.
 * Call on: level complete, shop purchase, reward claim, hint use, heart loss.
 * Triggers a debounced push to all cloud backends.
 */
export function bumpVersion(): void {
  _saveVersion++;
  schedulePush();
}

function schedulePush(): void {
  if (_pushTimer) clearTimeout(_pushTimer);
  _pushTimer = setTimeout(() => {
    _pushTimer = null;
    void pushNow();
  }, PUSH_DEBOUNCE_MS);
}

async function pushNow(): Promise<void> {
  const save = buildCloudSave();
  const telegramId = usePlayerStore.getState().profile?.telegramId ?? 0;

  // Also trigger the existing localStorage unified save.
  saveSystem.save();

  await writeAllClouds(save, telegramId);
}

/**
 * Boot sync: load all three sources, resolve, hydrate stores, write back.
 * Never throws. Falls back to local-only if all remote calls fail or time out.
 * Must complete (or time out) before the splash screen advances.
 */
export async function bootSync(telegramId: number): Promise<void> {
  // ── Step 1: local (synchronous — already in stores; just read for merge) ───
  const localSave = loadFromLocalStorage();

  // ── Steps 2 + 3: fetch remote sources concurrently, both capped at 3 s ────
  const timeout = <T>(p: Promise<T>): Promise<T | null> =>
    Promise.race([
      p,
      new Promise<null>((r) => setTimeout(() => r(null), BOOT_TIMEOUT_MS)),
    ]);

  const [supabaseSave, telegramSave] = await Promise.all([
    timeout(loadFromSupabase(telegramId)),
    timeout(loadFromTelegramCloud()),
  ]);

  // ── Step 4: resolve ────────────────────────────────────────────────────────
  const resolved = resolveAll(localSave, supabaseSave, telegramSave);
  if (!resolved) {
    // No cloud save found anywhere — first launch. Stores already have defaults.
    return;
  }

  // Restore the save version counter from the resolved snapshot.
  if (resolved.saveVersion > _saveVersion) {
    _saveVersion = resolved.saveVersion;
  }

  // ── Step 5: hydrate stores ─────────────────────────────────────────────────
  applyCloudSave(resolved);

  // ── Step 6: write resolved snapshot back to all sources ───────────────────
  // Fire-and-forget — don't await so boot isn't delayed by write latency.
  writeAllClouds(resolved, telegramId).catch(() => { /* noop */ });
}

/**
 * Manual push — debounced. Exposed for callers that want to force a sync
 * without bumping the version counter (e.g. page-hide / visibilitychange).
 */
export function push(): void {
  schedulePush();
}

// Exported merge helper for unit testing
export { mergeSaves as merge, resolveAll as resolve };

export const syncManager = { bootSync, bumpVersion, push, buildCloudSave };
