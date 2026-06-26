import { create } from 'zustand';
import type { GameStatus, PieceStatus } from '@/game/types';
import { storageService } from '@/services/storage.service';
import { CONFIG } from '@/constants';

interface PieceRuntimeState {
  id: string;
  status: PieceStatus;
}

interface GameStore {
  status: GameStatus;
  hearts: number;
  /** Baseline timestamp the regen countdown measures from (ms epoch). */
  lastRefillTs: number;
  currentLevelId: number | null;
  pieces: PieceRuntimeState[];
  snappedCount: number;
  totalPieces: number;

  setStatus: (status: GameStatus) => void;
  setLevel: (levelId: number, totalPieces: number) => void;
  setPieces: (pieces: PieceRuntimeState[]) => void;
  updatePieceStatus: (id: string, status: PieceStatus) => void;
  loseHeart: () => void;
  resetHearts: () => void;
  /** Add a single heart (capped at MAX) — used by rewards. */
  addHeart: () => void;
  /** Grant any hearts that have regenerated since lastRefillTs. */
  applyRefill: () => void;
  snapPiece: (id: string) => void;
  reset: () => void;
}

// ── Heart regeneration ──────────────────────────────────────────────────────
// Hearts are a PERSISTENT, regenerating resource (not per-level). They survive
// app close and refill +1 every REGEN_MS, capped at MAX_HEARTS.
export const MAX_HEARTS = CONFIG.maxHearts;
export const HEART_REGEN_MS = 20 * 60 * 1000; // +1 heart every 20 minutes
const HEARTS_KEY = 'hearts';

interface PersistedHearts {
  hearts: number;
  lastRefillTs: number;
}

function persistHearts(hearts: number, lastRefillTs: number): void {
  storageService.set<PersistedHearts>(HEARTS_KEY, { hearts, lastRefillTs });
}

// Advance hearts/timestamp by however many full regen intervals have elapsed.
// Returns the inputs UNCHANGED when nothing accrues, so callers can cheaply skip
// state writes (no localStorage churn while waiting or when full).
function accrue(
  hearts: number,
  lastRefillTs: number,
  now: number,
): { hearts: number; lastRefillTs: number } {
  if (hearts >= MAX_HEARTS) return { hearts, lastRefillTs };
  const elapsed = now - lastRefillTs;
  if (elapsed < HEART_REGEN_MS) return { hearts, lastRefillTs };
  const earned = Math.floor(elapsed / HEART_REGEN_MS);
  const next = Math.min(MAX_HEARTS, hearts + earned);
  return {
    hearts: next,
    // When full, the countdown is irrelevant — reset the baseline to `now`.
    lastRefillTs: next >= MAX_HEARTS ? now : lastRefillTs + earned * HEART_REGEN_MS,
  };
}

// Load persisted hearts and apply any offline refill that accrued while closed.
function loadHearts(): { hearts: number; lastRefillTs: number } {
  const now = Date.now();
  const saved = storageService.get<PersistedHearts>(HEARTS_KEY);

  if (!saved || typeof saved.hearts !== 'number') {
    return { hearts: MAX_HEARTS, lastRefillTs: now };
  }

  const startHearts = Math.max(0, Math.min(MAX_HEARTS, Math.floor(saved.hearts)));
  const startTs = typeof saved.lastRefillTs === 'number' ? saved.lastRefillTs : now;
  const result = accrue(startHearts, startTs, now);
  if (result.hearts !== startHearts || result.lastRefillTs !== startTs) {
    persistHearts(result.hearts, result.lastRefillTs);
  }
  return result;
}

const initialHearts = loadHearts();

export const useGameStore = create<GameStore>((set, get) => ({
  status: 'idle',
  hearts: initialHearts.hearts,
  lastRefillTs: initialHearts.lastRefillTs,
  currentLevelId: null,
  pieces: [],
  snappedCount: 0,
  totalPieces: 0,

  setStatus: (status) => set({ status }),

  setLevel: (levelId, totalPieces) =>
    set({ currentLevelId: levelId, totalPieces, snappedCount: 0 }),

  setPieces: (pieces) => set({ pieces }),

  updatePieceStatus: (id, status) =>
    set((s) => ({
      pieces: s.pieces.map((p) => (p.id === id ? { ...p, status } : p)),
    })),

  loseHeart: () => {
    const { hearts, lastRefillTs } = get();
    if (hearts <= 0) {
      set({ status: 'gameover' });
      return;
    }
    const next = hearts - 1;
    // Start (or keep) the regen clock the moment we drop below full.
    const ts = hearts >= MAX_HEARTS ? Date.now() : lastRefillTs;
    persistHearts(next, ts);
    set({ hearts: next, lastRefillTs: ts, status: next === 0 ? 'gameover' : 'playing' });
  },

  resetHearts: () => {
    const ts = Date.now();
    persistHearts(MAX_HEARTS, ts);
    set({ hearts: MAX_HEARTS, lastRefillTs: ts });
  },

  addHeart: () => {
    const { hearts, lastRefillTs } = get();
    if (hearts >= MAX_HEARTS) return;
    const next = hearts + 1;
    // If this fills the bar, the countdown becomes irrelevant — reset baseline.
    const ts = next >= MAX_HEARTS ? Date.now() : lastRefillTs;
    persistHearts(next, ts);
    set({ hearts: next, lastRefillTs: ts });
  },

  applyRefill: () => {
    const { hearts, lastRefillTs } = get();
    const result = accrue(hearts, lastRefillTs, Date.now());
    if (result.hearts === hearts && result.lastRefillTs === lastRefillTs) return;
    persistHearts(result.hearts, result.lastRefillTs);
    set({ hearts: result.hearts, lastRefillTs: result.lastRefillTs });
  },

  snapPiece: (id) => {
    const { snappedCount, totalPieces } = get();
    const next = snappedCount + 1;
    set({
      snappedCount: next,
      status: next === totalPieces ? 'won' : 'playing',
    });
    get().updatePieceStatus(id, 'snapped');
  },

  // NOTE: reset() intentionally does NOT touch hearts/lastRefillTs — hearts are
  // a persistent resource that must survive level restarts and app close.
  reset: () =>
    set({
      status: 'idle',
      currentLevelId: null,
      pieces: [],
      snappedCount: 0,
      totalPieces: 0,
    }),
}));
