import { useEffect } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useUIStore } from '@/store/uiStore';
import { audioManager } from '@/game/audio/AudioManager';
import { effectManager } from '@/game/effects/EffectManager';

export function useGameStatus(): void {
  const status = useGameStore((s) => s.status);

  useEffect(() => {
    if (status === 'won') {
      audioManager.play('complete');
      effectManager.trigger({ type: 'complete' });
      setTimeout(() => useUIStore.getState().setScene('win'), 500);
    }

    if (status === 'gameover') {
      setTimeout(() => useUIStore.getState().setScene('gameover'), 300);
    }
  }, [status]);
}
