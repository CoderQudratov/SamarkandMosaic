import { gameManager } from '@/game/GameManager';
import { useUIStore } from '@/store/uiStore';

export function MenuScene() {
  const handlePlay = async () => {
    await gameManager.startLevel(1);
    useUIStore.getState().setScene('game');
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
      }}
    >
      <h1 style={{ color: '#D4AF37', fontFamily: 'serif', fontSize: 32 }}>
        Samarkand Mosaic
      </h1>
      <button onClick={handlePlay} style={{ marginTop: 32 }}>
        Play
      </button>
    </div>
  );
}
