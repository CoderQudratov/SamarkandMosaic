import { useGameStore } from '@/store/gameStore';
import { CONFIG } from '@/constants';

export function useHearts(): { hearts: number; maxHearts: number } {
  const hearts = useGameStore((s) => s.hearts);
  return { hearts, maxHearts: CONFIG.maxHearts };
}
