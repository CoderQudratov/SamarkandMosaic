import { useProgress } from '@/game/hooks/useProgress';
import { useHearts } from '@/game/hooks/useHearts';
import { useUIStore } from '@/store/uiStore';
import { gameManager } from '@/game/GameManager';

export function GameScene() {
  const { percent } = useProgress();
  const { hearts } = useHearts();

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
      }}
    >
      {/* Hearts row */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          left: 16,
          display: 'flex',
          gap: 8,
          pointerEvents: 'none',
        }}
      >
        {Array.from({ length: hearts }).map((_, i) => (
          <span key={i} style={{ color: '#D4AF37', fontSize: 24 }}>♥</span>
        ))}
      </div>

      {/* Progress bar */}
      <div
        style={{
          position: 'absolute',
          bottom: 24,
          left: 24,
          right: 24,
          height: 8,
          background: '#3a2a00',
          borderRadius: 4,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${percent}%`,
            height: '100%',
            background: '#D4AF37',
            transition: 'width 0.3s ease',
          }}
        />
      </div>

      {/* Pause button */}
      <button
        onClick={() => gameManager.pause()}
        style={{
          position: 'absolute',
          top: 16,
          right: 16,
          pointerEvents: 'all',
          background: 'none',
          border: 'none',
          color: '#D4AF37',
          fontSize: 24,
          cursor: 'pointer',
        }}
      >
        ⏸
      </button>

      {/* Pause menu */}
      {useUIStore((s) => s.showPauseMenu) && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(26,15,0,0.85)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'all',
          }}
        >
          <button onClick={() => gameManager.resume()}>Resume</button>
          <button onClick={() => useUIStore.getState().setScene('mainMenu')} style={{ marginTop: 16 }}>
            Exit
          </button>
        </div>
      )}
    </div>
  );
}
