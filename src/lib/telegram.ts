// ─── Telegram WebApp SDK — complete type declarations ───────────────────────
// Covers TWA 6.x–8.x. Optional fields guard against older clients.

export interface TelegramThemeParams {
  bg_color?: string;
  text_color?: string;
  hint_color?: string;
  link_color?: string;
  button_color?: string;
  button_text_color?: string;
  secondary_bg_color?: string;
  header_bg_color?: string;
  accent_text_color?: string;
  section_bg_color?: string;
  section_header_text_color?: string;
  subtitle_text_color?: string;
  destructive_text_color?: string;
}

export interface TelegramWebAppUser {
  id: number;
  is_bot?: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  photo_url?: string;
}

export interface TelegramWebAppInitData {
  query_id?: string;
  user?: TelegramWebAppUser;
  auth_date: number;
  hash: string;
  start_param?: string;
  chat_type?: string;
  chat_instance?: string;
}

export interface TelegramSafeAreaInset {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface TelegramHapticFeedback {
  impactOccurred(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'): void;
  notificationOccurred(type: 'error' | 'success' | 'warning'): void;
  selectionChanged(): void;
}

export type TelegramEventType =
  | 'themeChanged'
  | 'viewportChanged'
  | 'mainButtonClicked'
  | 'backButtonClicked'
  | 'settingsButtonClicked'
  | 'popupClosed'
  | 'clipboardTextReceived';

export interface ViewportChangedPayload {
  isStateStable: boolean;
}

export interface TelegramWebApp {
  // Identity
  initData: string;
  initDataUnsafe: TelegramWebAppInitData;
  version: string;
  platform: string;

  // Theme
  colorScheme: 'light' | 'dark';
  themeParams: TelegramThemeParams;

  // Viewport
  isExpanded: boolean;
  viewportHeight: number;
  viewportStableHeight: number;

  // Safe area (TWA 7.x+)
  safeAreaInset: TelegramSafeAreaInset;
  contentSafeAreaInset: TelegramSafeAreaInset;

  // Closing
  isClosingConfirmationEnabled: boolean;

  // Lifecycle
  ready(): void;
  expand(): void;
  close(): void;
  enableClosingConfirmation(): void;
  disableClosingConfirmation(): void;

  // Events — handler is intentionally loose to accommodate all event payloads
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onEvent(eventType: TelegramEventType, handler: (payload?: any) => void): void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  offEvent(eventType: TelegramEventType, handler: (payload?: any) => void): void;

  // Popups
  showAlert(message: string, callback?: () => void): void;
  showConfirm(message: string, callback?: (confirmed: boolean) => void): void;

  // Links
  openLink(url: string, options?: { try_instant_view?: boolean }): void;
  openTelegramLink(url: string): void;

  // Haptic
  HapticFeedback: TelegramHapticFeedback;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp;
    };
  }
}

export function getTWA(): TelegramWebApp | null {
  return window.Telegram?.WebApp ?? null;
}

// initData is non-empty only inside a real Telegram client
export function isTelegramEnv(): boolean {
  const twa = getTWA();
  return !!(twa && twa.initData && twa.initData.length > 0);
}
