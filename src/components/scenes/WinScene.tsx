import { useUIStore } from '@/store/uiStore';
import { gameManager } from '@/game/GameManager';
import { useGameStore } from '@/store/gameStore';

export function WinScene() {
  const levelId = useGameStore((s) => s.currentLevelId);

  const handleNext = async () => {
    if (!levelId) return;
    await gameManager.startLevel(levelId + 1);
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
      <h2 style={{ color: '#D4AF37', fontFamily: 'serif' }}>Mosaic Restored!</h2>
      <button onClick={handleNext} style={{ marginTop: 24 }}>
        Next Level
      </button>
      <button onClick={() => useUIStore.getState().setScene('mainMenu')} style={{ marginTop: 12 }}>
        Menu
      </button>
    </div>
  );
}
