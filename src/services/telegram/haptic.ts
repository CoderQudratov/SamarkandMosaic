import { getTWA } from '@/lib/telegram';

// All functions are safe no-ops in browser mode (getTWA returns null)

function impact(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'): void {
  getTWA()?.HapticFeedback.impactOccurred(style);
}

function notify(type: 'success' | 'error' | 'warning'): void {
  getTWA()?.HapticFeedback.notificationOccurred(type);
}

export const haptic = {
  light: (): void => impact('light'),
  medium: (): void => impact('medium'),
  heavy: (): void => impact('heavy'),
  success: (): void => notify('success'),
  error: (): void => notify('error'),
  warning: (): void => notify('warning'),
  selection: (): void => { getTWA()?.HapticFeedback.selectionChanged(); },
} as const;
