import { getTWA, isTelegramEnv } from '@/lib/telegram';
import type { TelegramThemeParams } from '@/lib/telegram';
import { COLORS } from '@/constants';

export interface AppTheme {
  bgColor: string;
  textColor: string;
  hintColor: string;
  linkColor: string;
  buttonColor: string;
  buttonTextColor: string;
  secondaryBgColor: string;
  colorScheme: 'light' | 'dark';
}

// Timurid luxury defaults — used in browser mode and as fallbacks
const DEFAULT_THEME: AppTheme = {
  bgColor: '#1a0f00',
  textColor: COLORS.ivory,
  hintColor: COLORS.sandstone,
  linkColor: COLORS.gold,
  buttonColor: COLORS.gold,
  buttonTextColor: '#1a0f00',
  secondaryBgColor: '#2a1a00',
  colorScheme: 'dark',
};

function mapParams(params: TelegramThemeParams, scheme: 'light' | 'dark'): AppTheme {
  return {
    bgColor: params.bg_color ?? DEFAULT_THEME.bgColor,
    textColor: params.text_color ?? DEFAULT_THEME.textColor,
    hintColor: params.hint_color ?? DEFAULT_THEME.hintColor,
    linkColor: params.link_color ?? DEFAULT_THEME.linkColor,
    buttonColor: params.button_color ?? DEFAULT_THEME.buttonColor,
    buttonTextColor: params.button_text_color ?? DEFAULT_THEME.buttonTextColor,
    secondaryBgColor: params.secondary_bg_color ?? DEFAULT_THEME.secondaryBgColor,
    colorScheme: scheme,
  };
}

export function getCurrentTheme(): AppTheme {
  const twa = getTWA();
  if (!twa || !isTelegramEnv()) return DEFAULT_THEME;
  return mapParams(twa.themeParams, twa.colorScheme);
}

// Writes Telegram colors as CSS custom properties on :root.
// Game UI components consume these via var(--tg-*)
export function applyThemeToCSSVars(theme: AppTheme): void {
  const r = document.documentElement;
  r.style.setProperty('--tg-bg-color', theme.bgColor);
  r.style.setProperty('--tg-text-color', theme.textColor);
  r.style.setProperty('--tg-hint-color', theme.hintColor);
  r.style.setProperty('--tg-link-color', theme.linkColor);
  r.style.setProperty('--tg-button-color', theme.buttonColor);
  r.style.setProperty('--tg-button-text-color', theme.buttonTextColor);
  r.style.setProperty('--tg-secondary-bg-color', theme.secondaryBgColor);
  r.style.setProperty('--tg-color-scheme', theme.colorScheme);
}

// One-shot: read current theme, apply to DOM, and return the value
export function initTheme(): AppTheme {
  const theme = getCurrentTheme();
  applyThemeToCSSVars(theme);
  return theme;
}
