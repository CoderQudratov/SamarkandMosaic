// Thin facade kept for backward compatibility with existing callers.
// New code should import directly from '@/services/telegram'.

import {
  initTelegramSDK,
  isTelegramEnv,
} from '@/services/telegram/telegram';
import { getTelegramUser } from '@/services/telegram/telegramUser';
import { haptic } from '@/services/telegram/haptic';
import type { PlayerProfile } from '@/game/types';

export class TelegramService {
  init(): void {
    initTelegramSDK();
  }

  getPlayerProfile(): PlayerProfile | null {
    if (!isTelegramEnv()) return null;
    return getTelegramUser();
  }

  hapticLight(): void   { haptic.light(); }
  hapticMedium(): void  { haptic.medium(); }
  hapticHeavy(): void   { haptic.heavy(); }
  hapticSuccess(): void { haptic.success(); }
  hapticError(): void   { haptic.error(); }
  hapticWarning(): void { haptic.warning(); }
}

export const telegramService = new TelegramService();
