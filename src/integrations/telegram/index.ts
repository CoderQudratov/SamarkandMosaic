// ─── Telegram Integration — public API ──────────────────────────────────────

export {
  isTelegram,
  getTelegramWebApp,
  init,
  expand,
  closeMiniApp,
  getUser,
  getUserDisplayName,
  getTheme,
  getPlatform,
  getVersion,
} from './TelegramSDK';
export type { TelegramUser, TelegramThemeSnapshot } from './TelegramSDK';

export { setupTheme, getCurrentTheme, applyThemeToCSSVars } from './TelegramTheme';
export type { AppTheme } from './TelegramTheme';

export {
  impactLight,
  impactMedium,
  hapticSuccess,
  hapticError,
  onSnap,
  onWrongDrop,
  onWin,
  onPurchase,
  onTap,
} from './TelegramHaptics';

export {
  save,
  load,
  remove,
  listKeys,
  saveJSON,
  loadJSON,
} from './TelegramStorage';

export {
  showMainButton,
  hideMainButton,
  registerBackButton,
  unregisterBackButton,
} from './TelegramButtons';
