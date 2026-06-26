export const CONFIG = {
  snapRadius: 80,

  startHearts: 3,
  maxHearts: 3,

  // Coin economy — rewards and costs
  coins: {
    perSnap: 5,          // each correct placement
    completion: 50,      // finishing a puzzle (base)
    perfectBonus: 30,    // additional when no mistakes + no hint (3 stars)
    speedBonus: 20,      // additional when cleared in < 60 s
    hintCost: 25,        // buy a hint with coins
    heartRefillCost: 40, // refill all hearts with coins
  },

  // Post-level reward chest
  chest: {
    spawnChance: 0.30, // probability a chest appears after a win
    coinMin: 30,       // coin reward range (inclusive)
    coinMax: 100,
  },

  levels: {
     1: { pieces:  4 },
     2: { pieces:  6 },
     3: { pieces:  8 },
     4: { pieces: 10 },
     5: { pieces: 12 },
     6: { pieces: 16 },
     7: { pieces: 20 },
     8: { pieces: 24 },
     9: { pieces: 28 },
    10: { pieces: 32 },
  } as Record<number, { pieces: number }>,

  board: {
    width: 600,
    height: 600,
  },

  pixi: {
    backgroundColor: 0x1a0f00,
    antialias: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  },

  audio: {
    ambientVolume: 0.3,
    sfxVolume: 0.8,
  },

  // Puzzle board system
  puzzle: {
    snapTolerance: 40,   // px radius (screen space) for a valid drop — see gameplay.md note
    grabScale: 1.05,     // piece scale while dragging
    trayPieceHeight: 76, // px height of pieces shown in the bottom tray
    boardMargin: 16,     // px gap between board edge and screen
  },

  // Optional — empty strings when not configured. Never assume these exist.
  supabase: {
    url: (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? '',
    anonKey: (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? '',
  },
} as const;
