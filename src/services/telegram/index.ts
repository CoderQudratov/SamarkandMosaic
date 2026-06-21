export {
  initTelegramSDK,
  getSafeArea,
  applySafeAreaToCSSVars,
  getViewportInfo,
  applyViewportToCSSVars,
  onViewportChanged,
  onThemeChanged,
  isTelegramEnv,
} from './telegram';

export type { SafeArea, ViewportInfo } from './telegram';

export { getTelegramUser, isMockMode } from './telegramUser';

export {
  getCurrentTheme,
  applyThemeToCSSVars,
  initTheme,
} from './telegramTheme';

export type { AppTheme } from './telegramTheme';

export { haptic } from './haptic';
