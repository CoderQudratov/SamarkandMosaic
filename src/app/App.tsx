import { useEffect } from 'react';
import { useTelegram } from '@/hooks/useTelegram';
import { useGameStatus } from '@/game/hooks/useGameStatus';
import { useAudioSync } from '@/game/hooks/useAudioSync';
import { useBgMusic } from '@/game/hooks/useBgMusic';
import { audioManager } from '@/game/audio/AudioManager';
import { useUIStore } from '@/store/uiStore';
import { AppShell } from '@/components/layout/AppShell';
import { LoadingOverlay } from '@/components/ui/LoadingOverlay';
import { ShopModal } from '@/components/shop/ShopModal';
import { GameErrorBoundary } from '@/components/errors/GameErrorBoundary';

// UI shell screens
import { SplashScreen }    from '@/screens/SplashScreen';
import { WelcomeScreen }   from '@/screens/WelcomeScreen';
import { NameInputScreen } from '@/screens/NameInputScreen';
import { MainMenuScreen }  from '@/screens/MainMenuScreen';
import { LevelSelectScreen } from '@/screens/LevelSelectScreen';

// Game phase
import { PuzzleBoard }   from '@/game/board/PuzzleBoard';
import { WinScene }      from '@/components/scenes/WinScene';
import { GameOverScene } from '@/components/scenes/GameOverScene';

export function App() {
  const scene     = useUIStore((s) => s.scene);
  const isLoading = useUIStore((s) => s.isLoading);
  const shopOpen  = useUIStore((s) => s.shopOpen);
  const setShopOpen = useUIStore((s) => s.setShopOpen);

  // Preload all Howl instances once on mount (before any user interaction)
  useEffect(() => { audioManager.init(); }, []);

  // Subscribes to Telegram viewport + theme change events
  useTelegram();

  // Sync audio store → AudioManager (mute/volume)
  useAudioSync();

  // Start / stop bg music based on active scene
  useBgMusic();

  // Game-level reactive side-effects (safe to run even before game starts)
  useGameStatus();

  return (
    <>
      <AppShell>
        {/* ── UI Shell ───────────────────────────────────────────────────── */}
        {scene === 'splash'    && <SplashScreen />}
        {scene === 'welcome'   && <WelcomeScreen />}
        {scene === 'nameInput' && <NameInputScreen />}
        {scene === 'mainMenu'  && <MainMenuScreen />}
        {scene === 'levelSelect' && <LevelSelectScreen />}

        {/* ── Game phase — wrapped in error boundary ──────────────────────── */}
        <GameErrorBoundary>
          {scene === 'game'     && <PuzzleBoard />}
          {scene === 'win'      && <WinScene />}
          {scene === 'gameover' && <GameOverScene />}
        </GameErrorBoundary>

        {isLoading && <LoadingOverlay />}
      </AppShell>

      {/* ── Global shop modal — rendered OUTSIDE AppShell so overflow:hidden  ── */}
      {/* ── and stacking contexts inside AppShell cannot obscure it.          ── */}
      <ShopModal isOpen={shopOpen} onClose={() => setShopOpen(false)} />
    </>
  );
}
