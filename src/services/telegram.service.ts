import { getTelegramWebApp, isTelegramContext } from '@/lib/telegram';
import type { PlayerProfile } from '@/game/types';

export class TelegramService {
  init(): void {
    const twa = getTelegramWebApp();
    if (!twa) return;
    twa.ready();
    twa.expand();
  }

  getPlayerProfile(): PlayerProfile | null {
    if (!isTelegramContext()) return null;
    const user = getTelegramWebApp()?.initDataUnsafe?.user;
    if (!user) return null;
    return {
      telegramId: user.id,
      username: user.username ?? '',
      firstName: user.first_name,
      photoUrl: user.photo_url ?? null,
    };
  }

  hapticLight(): void {
    getTelegramWebApp()?.HapticFeedback.impactOccurred('light');
  }

  hapticMedium(): void {
    getTelegramWebApp()?.HapticFeedback.impactOccurred('medium');
  }

  hapticSuccess(): void {
    getTelegramWebApp()?.HapticFeedback.notificationOccurred('success');
  }

  hapticError(): void {
    getTelegramWebApp()?.HapticFeedback.notificationOccurred('error');
  }
}

export const telegramService = new TelegramService();
