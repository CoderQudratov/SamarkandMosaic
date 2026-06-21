import { useGameStore } from '@/store/gameStore';

export function useProgress(): { percent: number; snapped: number; total: number } {
  const snappedCount = useGameStore((s) => s.snappedCount);
  const totalPieces = useGameStore((s) => s.totalPieces);
  const percent = totalPieces > 0 ? Math.round((snappedCount / totalPieces) * 100) : 0;
  return { percent, snapped: snappedCount, total: totalPieces };
}
