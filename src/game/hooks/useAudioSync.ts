import { useEffect } from 'react';
import { useAudioStore } from '@/store/audioStore';
import { audioManager } from '@/game/audio/AudioManager';

export function useAudioSync(): void {
  const muted = useAudioStore((s) => s.muted);
  const sfxVolume = useAudioStore((s) => s.sfxVolume);
  const ambientVolume = useAudioStore((s) => s.ambientVolume);

  useEffect(() => {
    audioManager.setMuted(muted);
  }, [muted]);

  useEffect(() => {
    audioManager.setSfxVolume(sfxVolume);
  }, [sfxVolume]);

  useEffect(() => {
    audioManager.setAmbientVolume(ambientVolume);
  }, [ambientVolume]);
}
