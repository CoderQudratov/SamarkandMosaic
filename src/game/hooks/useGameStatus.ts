import { useEffect } from 'react';
import { useGameStore } from '@/store/gameStore';
import { effectManager } from '@/game/effects/EffectManager';

// Watches game status for side-effects that live outside the puzzle board.
// Win audio + scene change are owned by PuzzleBoard.tsx to sequence with animations.
export function useGameStatus(): void {
  const status = useGameStore((s) => s.status);

  useEffect(() => {
    if (status === 'won') {
      effectManager.trigger({ type: 'complete' });
    }
  }, [status]);
}
