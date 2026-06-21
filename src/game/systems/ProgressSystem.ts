import { useGameStore } from '@/store/gameStore';

class ProgressSystem {
  getProgress(): number {
    const { snappedCount, totalPieces } = useGameStore.getState();
    if (totalPieces === 0) return 0;
    return snappedCount / totalPieces;
  }

  getProgressPercent(): number {
    return Math.round(this.getProgress() * 100);
  }

  isComplete(): boolean {
    const { snappedCount, totalPieces } = useGameStore.getState();
    return totalPieces > 0 && snappedCount === totalPieces;
  }
}

export const progressSystem = new ProgressSystem();
