import { useUIStore } from '@/store/uiStore';

export function LoadingOverlay() {
  const progress = useUIStore((s) => s.loadingProgress);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: '#1a0f00',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'all',
      }}
    >
      <div style={{ color: '#D4AF37', fontFamily: 'serif', fontSize: 18 }}>
        Loading… {progress}%
      </div>
      <div
        style={{
          marginTop: 16,
          width: 200,
          height: 6,
          background: '#3a2a00',
          borderRadius: 3,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${progress}%`,
            height: '100%',
            background: '#D4AF37',
            transition: 'width 0.2s ease',
          }}
        />
      </div>
    </div>
  );
}
