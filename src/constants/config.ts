export const CONFIG = {
  snapRadius: 80,

  startHearts: 3,
  maxHearts: 3,

  levels: {
    1: { pieces: 4 },
    2: { pieces: 6 },
    3: { pieces: 8 },
    4: { pieces: 10 },
    5: { pieces: 12 },
  },

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

  // Optional — empty strings when not configured. Never assume these exist.
  supabase: {
    url: (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? '',
    anonKey: (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? '',
  },
} as const;
