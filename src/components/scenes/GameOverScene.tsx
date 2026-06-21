import { useUIStore } from '@/store/uiStore';
import { gameManager } from '@/game/GameManager';
import { useGameStore } from '@/store/gameStore';

export function GameOverScene() {
  const levelId = useGameStore((s) => s.currentLevelId);

  const handleRetry = async () => {
    if (!levelId) return;
    await gameManager.startLevel(levelId);
  };

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(26,15,0,0.9)',
        pointerEvents: 'all',
      }}
    >
      <h2 style={{ color: '#CC2200', fontFamily: 'serif' }}>Game Over</h2>
      <button onClick={handleRetry} style={{ marginTop: 24 }}>
        Try Again
      </button>
      <button onClick={() => useUIStore.getState().setScene('menu')} style={{ marginTop: 12 }}>
        Menu
      </button>
    </div>
  );
}
