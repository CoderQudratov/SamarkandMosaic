import { useEffect } from 'react';
import { useUIStore } from '@/store/uiStore';
import { audioManager } from '@/game/audio/AudioManager';
import type { SceneKey } from '@/game/types';

const MUSIC_SCENES = new Set<SceneKey>(['welcome', 'nameInput', 'mainMenu', 'game']);
const STOP_SCENES  = new Set<SceneKey>(['win', 'gameover']);

export function useBgMusic(): void {
  const scene = useUIStore((s) => s.scene);

  useEffect(() => {
    if (MUSIC_SCENES.has(scene)) {
      audioManager.playBg();
    } else if (STOP_SCENES.has(scene)) {
      audioManager.stopBg();
    }
  }, [scene]);
}
