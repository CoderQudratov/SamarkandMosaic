import { getTWA, isTelegramEnv } from '@/lib/telegram';
import type { PlayerProfile } from '@/game/types';

// Used when running in a browser outside Telegram during development
const MOCK_PLAYER: PlayerProfile = {
  telegramId: 0,
  username: 'dev_user',
  firstName: 'Developer',
  lastName: '',
  displayName: 'Developer',
  language: 'en',
  photoUrl: null,
  isPremium: false,
};

export function isMockMode(): boolean {
  return !isTelegramEnv();
}

export function getTelegramUser(): PlayerProfile {
  if (!isTelegramEnv()) return MOCK_PLAYER;

  const user = getTWA()?.initDataUnsafe?.user;
  if (!user) return MOCK_PLAYER;

  const firstName = user.first_name;
  const lastName = user.last_name ?? '';
  const displayName = lastName ? `${firstName} ${lastName}`.trim() : firstName;

  return {
    telegramId: user.id,
    username: user.username ?? '',
    firstName,
    lastName,
    displayName,
    language: user.language_code ?? 'en',
    photoUrl: user.photo_url ?? null,
    isPremium: user.is_premium ?? false,
  };
}
