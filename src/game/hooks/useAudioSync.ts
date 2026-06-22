import { useEffect } from 'react';
import { useAudioStore } from '@/store/audioStore';
import { audioManager } from '@/game/audio/AudioManager';

export function useAudioSync(): void {
  const musicMuted   = useAudioStore((s) => s.musicMuted);
  const sfxMuted     = useAudioStore((s) => s.sfxMuted);
  const musicVolume  = useAudioStore((s) => s.musicVolume);
  const sfxVolume    = useAudioStore((s) => s.sfxVolume);

  useEffect(() => { audioManager.setMusicMuted(musicMuted); },  [musicMuted]);
  useEffect(() => { audioManager.setSfxMuted(sfxMuted); },      [sfxMuted]);
  useEffect(() => { audioManager.setMusicVolume(musicVolume); }, [musicVolume]);
  useEffect(() => { audioManager.setSfxVolume(sfxVolume); },    [sfxVolume]);
}
