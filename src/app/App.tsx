import { useEffect, useRef } from 'react';
import { useUIStore } from '@/store/uiStore';
import { useGameStatus } from '@/game/hooks/useGameStatus';
import { useAudioSync } from '@/game/hooks/useAudioSync';
import { gameManager } from '@/game/GameManager';
import { MenuScene } from '@/components/scenes/MenuScene';
import { GameScene } from '@/components/scenes/GameScene';
import { WinScene } from '@/components/scenes/WinScene';
import { GameOverScene } from '@/components/scenes/GameOverScene';
import { LoadingOverlay } from '@/components/ui/LoadingOverlay';

export function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scene = useUIStore((s) => s.scene);
  const isLoading = useUIStore((s) => s.isLoading);

  useGameStatus();
  useAudioSync();

  useEffect(() => {
    if (!canvasRef.current) return;
    gameManager.init(canvasRef.current);
  }, []);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      />

      {/* React UI layer — never touches Pixi objects directly */}
      {scene === 'menu' && <MenuScene />}
      {scene === 'game' && <GameScene />}
      {scene === 'win' && <WinScene />}
      {scene === 'gameover' && <GameOverScene />}

      {isLoading && <LoadingOverlay />}
    </div>
  );
}
