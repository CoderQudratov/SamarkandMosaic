// ─── Persistent Save Types ────────────────────────────────────────────────────
// Two distinct "version" concepts live here:
//   schemaVersion — static; bump when the shape changes (triggers migration).
//   saveVersion   — monotonic counter; incremented on every meaningful event
//                   (level complete, purchase, reward claim, hint, heart loss).
//                   Used by SyncManager for conflict resolution across devices.

export const SAVE_VERSION = 1; // schema version — alias kept for SaveSystem

// ─── Cloud save — the shape written to Supabase + Telegram CloudStorage ──────
// Separate from SaveData (localStorage unified snapshot) to keep concerns clean.

export interface CloudSave {
  schemaVersion: 1;
  /** Monotonically increasing per-device write counter. */
  saveVersion: number;
  /** ISO-8601 timestamp of last write on this device. */
  updatedAt: string;

  progression: {
    completedLevels: number[];
    /** levelId (string) → best star count 0–3 */
    stars: Record<string, number>;
    highestLevel: number;
    totalSnaps: number;
  };

  economy: {
    coins: number;
    hints: number;
    hearts: number;
    /** epoch ms — needed to restore the heart regen countdown. */
    heartLastRefillTs: number;
  };

  daily: {
    streakDay: number;     // 1–7: next day to award
    lastClaimAt: number;   // epoch ms, 0 = never claimed
  };

  stats: {
    totalWins: number;
    totalMistakes: number;
    totalHintsUsed: number;
  };
}

export interface SaveStats {
  totalWins: number;
  totalMistakes: number;
  totalHintsUsed: number;
}

export interface SaveProgression {
  /** Numeric id of the level the player was working on last. */
  currentLevel: number;
  /** "level-N" strings of all unlocked levels. */
  unlockedLevels: string[];
  /** "level-N" strings of all completed levels. */
  completedLevels: string[];
  /** Best star count keyed by "level-N". */
  stars: Record<string, number>;
}

export interface SaveEconomy {
  hearts: number;
  hints: number;
  coins: number;
}

export interface SaveData {
  version: number;
  progression: SaveProgression;
  economy: SaveEconomy;
  stats: SaveStats;
}
