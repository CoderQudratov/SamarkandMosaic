import { useTelegram } from '@/hooks/useTelegram';
import { useGameStatus } from '@/game/hooks/useGameStatus';
import { useAudioSync } from '@/game/hooks/useAudioSync';
import { useUIStore } from '@/store/uiStore';
import { AppShell } from '@/components/layout/AppShell';
import { LoadingOverlay } from '@/components/ui/LoadingOverlay';

// UI shell screens
import { SplashScreen }    from '@/screens/SplashScreen';
import { WelcomeScreen }   from '@/screens/WelcomeScreen';
import { NameInputScreen } from '@/screens/NameInputScreen';
import { MainMenuScreen }  from '@/screens/MainMenuScreen';

// Game phase scenes (stubs — wired in next phases)
import { GameScene }     from '@/components/scenes/GameScene';
import { WinScene }      from '@/components/scenes/WinScene';
import { GameOverScene } from '@/components/scenes/GameOverScene';

export function App() {
  const scene     = useUIStore((s) => s.scene);
  const isLoading = useUIStore((s) => s.isLoading);

  // Subscribes to Telegram viewport + theme change events
  useTelegram();

  // Game-level reactive side-effects (safe to run even before game starts)
  useGameStatus();
  useAudioSync();

  return (
    <AppShell>
      {/* ── UI Shell ─────────────────────────────────────────────────────── */}
      {scene === 'splash'    && <SplashScreen />}
      {scene === 'welcome'   && <WelcomeScreen />}
      {scene === 'nameInput' && <NameInputScreen />}
      {scene === 'mainMenu'  && <MainMenuScreen />}

      {/* ── Game phase ───────────────────────────────────────────────────── */}
      {/* Canvas + gameManager.init added in board phase */}
      {scene === 'game'     && <GameScene />}
      {scene === 'win'      && <WinScene />}
      {scene === 'gameover' && <GameOverScene />}

      {isLoading && <LoadingOverlay />}
    </AppShell>
  );
}
