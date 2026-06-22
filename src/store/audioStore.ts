import { create } from 'zustand';

const LS_KEY = 'smAudio_v2';

interface AudioPersisted {
  musicMuted: boolean;
  sfxMuted: boolean;
}

function loadPersisted(): AudioPersisted {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw) as AudioPersisted;
  } catch { /* localStorage blocked in some sandboxes */ }
  return { musicMuted: false, sfxMuted: false };
}

function savePersisted(state: AudioPersisted): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  } catch { /* noop */ }
}

interface AudioStore extends AudioPersisted {
  musicVolume: number;
  sfxVolume: number;

  toggleMusic: () => void;
  toggleSfx: () => void;
  setMusicVolume: (v: number) => void;
  setSfxVolume: (v: number) => void;
}

const persisted = loadPersisted();

export const useAudioStore = create<AudioStore>((set, get) => ({
  musicMuted: persisted.musicMuted,
  sfxMuted: persisted.sfxMuted,
  musicVolume: 0.35,
  sfxVolume: 0.8,

  toggleMusic: () => {
    const next = !get().musicMuted;
    set({ musicMuted: next });
    savePersisted({ musicMuted: next, sfxMuted: get().sfxMuted });
  },

  toggleSfx: () => {
    const next = !get().sfxMuted;
    set({ sfxMuted: next });
    savePersisted({ musicMuted: get().musicMuted, sfxMuted: next });
  },

  setMusicVolume: (musicVolume) => set({ musicVolume }),
  setSfxVolume: (sfxVolume) => set({ sfxVolume }),
}));
