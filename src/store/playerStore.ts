import { create } from 'zustand';
import type { PlayerProfile, PlayerProgress } from '@/game/types';
import { storageService } from '@/services/storage.service';

const COINS_KEY = 'coins';
const HINTS_KEY = 'hints';
const SHARDS_KEY = 'shards';
const PROGRESS_KEY = 'progress';

const EMPTY_PROGRESS: PlayerProgress = {
  completedLevels: [],
  highestLevel: 0,
  totalSnaps: 0,
  stars: {},
};

// Load + sanitize persisted level progress (completed levels, stars, etc.).
function loadProgress(): PlayerProgress {
  const saved = storageService.get<Partial<PlayerProgress>>(PROGRESS_KEY);
  if (!saved) return { ...EMPTY_PROGRESS };
  return {
    completedLevels: Array.isArray(saved.completedLevels) ? saved.completedLevels : [],
    highestLevel: typeof saved.highestLevel === 'number' ? saved.highestLevel : 0,
    totalSnaps: typeof saved.totalSnaps === 'number' ? saved.totalSnaps : 0,
    stars: saved.stars && typeof saved.stars === 'object' ? saved.stars : {},
  };
}

function persistProgress(progress: PlayerProgress): void {
  storageService.set(PROGRESS_KEY, progress);
}

/** A level is unlocked if it's the first level or the previous one is complete. */
export function isLevelUnlocked(progress: PlayerProgress, levelId: number): boolean {
  return levelId <= 1 || progress.completedLevels.includes(levelId - 1);
}

// Currencies persist independently of `progress` so they never interfere with
// the Supabase progress-merge logic in bootstrap. Loaded synchronously at module
// eval so the HUD shows the saved balances on first paint.
function loadCount(key: string): number {
  const v = storageService.get<number>(key);
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;
}

interface PlayerStore {
  // Telegram identity — null until bootstrap resolves
  profile: PlayerProfile | null;

  // Player-chosen display name (overrides profile.displayName in UI)
  customName: string | null;

  // Game progress
  progress: PlayerProgress;

  // Persisted currencies / inventory
  coins: number;
  hints: number;
  shards: number;

  // Derived helpers
  isGuest: boolean; // true when running in browser dev mode (telegramId === 0)

  // Actions
  setProfile: (profile: PlayerProfile) => void;
  setCustomName: (name: string) => void;
  setProgress: (partial: Partial<PlayerProgress>) => void;
  markLevelComplete: (levelId: number) => void;
  /** Mark a level complete and record its best star count (persists). */
  completeLevel: (levelId: number, stars: number) => void;
  incrementSnaps: () => void;
  addCoins: (amount: number) => void;
  /**
   * Deduct `amount` coins. Returns true if successful, false if insufficient.
   * The balance is floored to 0; negative balances are never written.
   */
  spendCoins: (amount: number) => boolean;
  addHint: () => void;
  /**
   * Use one hint: free if hints > 0, else spends `coinCost` coins.
   * Returns false when both hint inventory and coins are insufficient.
   */
  spendHint: (coinCost: number) => boolean;
  addShard: () => void;
  /** Wipe coins, hints, shards to 0 and clear their localStorage keys. */
  resetEconomy: () => void;

  // Computed — returns customName ?? profile.displayName ?? 'Guest'
  getDisplayName: () => string;
}

export const usePlayerStore = create<PlayerStore>((set, get) => ({
  profile: null,
  customName: null,
  isGuest: true,
  coins: loadCount(COINS_KEY),
  hints: loadCount(HINTS_KEY),
  shards: loadCount(SHARDS_KEY),
  progress: loadProgress(),

  setProfile: (profile) =>
    set({ profile, isGuest: profile.telegramId === 0 }),

  setCustomName: (name) => set({ customName: name.trim() }),

  getDisplayName: () => {
    const { customName, profile } = get();
    return customName ?? profile?.displayName ?? 'Guest';
  },

  setProgress: (partial) =>
    set((s) => {
      const progress = { ...s.progress, ...partial };
      persistProgress(progress);
      return { progress };
    }),

  completeLevel: (levelId, stars) =>
    set((s) => {
      const { progress } = s;
      // No duplicate unlocks — completedLevels stays a unique set.
      const completedLevels = progress.completedLevels.includes(levelId)
        ? progress.completedLevels
        : [...progress.completedLevels, levelId];
      const clamped = Math.max(0, Math.min(3, Math.floor(stars)));
      const best = Math.max(progress.stars[levelId] ?? 0, clamped);
      const next: PlayerProgress = {
        ...progress,
        completedLevels,
        highestLevel: Math.max(progress.highestLevel, levelId),
        stars: { ...progress.stars, [levelId]: best },
      };
      persistProgress(next);
      return { progress: next };
    }),

  markLevelComplete: (levelId) => {
    const { progress } = get();
    const completedLevels = progress.completedLevels.includes(levelId)
      ? progress.completedLevels
      : [...progress.completedLevels, levelId];
    const next: PlayerProgress = {
      ...progress,
      completedLevels,
      highestLevel: Math.max(progress.highestLevel, levelId),
    };
    persistProgress(next);
    set({ progress: next });
  },

  incrementSnaps: () =>
    set((s) => ({
      progress: { ...s.progress, totalSnaps: s.progress.totalSnaps + 1 },
    })),

  addCoins: (amount) => {
    if (!Number.isFinite(amount) || amount <= 0) return;
    // Client-side sanity cap: a single addCoins call cannot grant more than
    // the theoretical maximum per event (10 000 coins). This doesn't prevent
    // a determined attacker but makes accidental bugs obvious in logs.
    const clamped = Math.min(Math.floor(amount), 10_000);
    set((s) => {
      const coins = Math.min(s.coins + clamped, 10_000_000); // DB ceiling
      storageService.set(COINS_KEY, coins);
      return { coins };
    });
  },

  spendCoins: (amount) => {
    if (!Number.isFinite(amount) || amount <= 0) return false;
    const cost = Math.floor(amount);
    let success = false;
    set((s) => {
      if (s.coins < cost) return s; // insufficient — no mutation
      success = true;
      const coins = s.coins - cost;
      storageService.set(COINS_KEY, coins);
      return { coins };
    });
    return success;
  },

  addHint: () =>
    set((s) => {
      const hints = s.hints + 1;
      storageService.set(HINTS_KEY, hints);
      return { hints };
    }),

  spendHint: (coinCost) => {
    let success = false;
    set((s) => {
      if (s.hints > 0) {
        // Use a free hint from inventory.
        success = true;
        const hints = s.hints - 1;
        storageService.set(HINTS_KEY, hints);
        return { hints };
      }
      // No free hints — try to spend coins.
      if (s.coins < coinCost) return s; // insufficient
      success = true;
      const coins = s.coins - coinCost;
      storageService.set(COINS_KEY, coins);
      return { coins };
    });
    return success;
  },

  addShard: () =>
    set((s) => {
      const shards = s.shards + 1;
      storageService.set(SHARDS_KEY, shards);
      return { shards };
    }),

  resetEconomy: () => {
    storageService.set(COINS_KEY, 0);
    storageService.set(HINTS_KEY, 0);
    storageService.set(SHARDS_KEY, 0);
    set({ coins: 0, hints: 0, shards: 0 });
  },
}));
