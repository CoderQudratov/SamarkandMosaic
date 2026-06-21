import { telegramService } from '@/services/telegram.service';
import { supabaseService } from '@/services/supabase.service';
import { storageService } from '@/services/storage.service';
import { usePlayerStore } from '@/store/playerStore';

export async function bootstrap(): Promise<void> {
  // 1. Init Telegram
  telegramService.init();

  // 2. Get player profile
  const profile = telegramService.getPlayerProfile();
  if (profile) {
    usePlayerStore.getState().setProfile(profile);

    // 3. Load player progress from Supabase
    const remoteProgress = await supabaseService.loadPlayerProgress(profile.telegramId);
    if (remoteProgress) {
      usePlayerStore.getState().setProgress(remoteProgress);
    } else {
      // Fallback to local storage
      const localProgress = storageService.get('progress');
      if (localProgress) {
        usePlayerStore.getState().setProgress(localProgress);
      }
    }
  }
}
