import { create } from 'zustand';

interface AudioStore {
  muted: boolean;
  sfxVolume: number;
  ambientVolume: number;
  ambientPlaying: boolean;

  toggleMute: () => void;
  setSfxVolume: (v: number) => void;
  setAmbientVolume: (v: number) => void;
  setAmbientPlaying: (playing: boolean) => void;
}

export const useAudioStore = create<AudioStore>((set) => ({
  muted: false,
  sfxVolume: 0.8,
  ambientVolume: 0.3,
  ambientPlaying: false,

  toggleMute: () => set((s) => ({ muted: !s.muted })),
  setSfxVolume: (sfxVolume) => set({ sfxVolume }),
  setAmbientVolume: (ambientVolume) => set({ ambientVolume }),
  setAmbientPlaying: (ambientPlaying) => set({ ambientPlaying }),
}));
