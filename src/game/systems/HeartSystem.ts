import { useGameStore } from '@/store/gameStore';
import { telegramService } from '@/services/telegram.service';

class HeartSystem {
  lose(): void {
    useGameStore.getState().loseHeart();
    telegramService.hapticError();
  }

  isGameOver(): boolean {
    return useGameStore.getState().hearts === 0;
  }

  getHearts(): number {
    return useGameStore.getState().hearts;
  }

  reset(): void {
    useGameStore.getState().resetHearts();
  }
}

export const heartSystem = new HeartSystem();
