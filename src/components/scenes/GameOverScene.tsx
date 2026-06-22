import { useUIStore } from '@/store/uiStore';
import { useBoardStore } from '@/store/boardStore';
import { OrnamentalDivider } from '@/components/ui/OrnamentalDivider';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { COLORS } from '@/constants';

// Reserved for future fail states (lives are not part of the puzzle core phase).
export function GameOverScene() {
  const tryAgain = () => {
    useBoardStore.getState().reset();
    useUIStore.getState().setScene('game');
  };
  const toMenu = () => useUIStore.getState().setScene('mainMenu');

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '20px',
        padding: '32px',
        textAlign: 'center',
      }}
    >
      <h1
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(20px, 5.5vw, 26px)',
          fontWeight: 700,
          letterSpacing: '4px',
          textTransform: 'uppercase',
          color: COLORS.brick,
        }}
      >
        Not Yet
      </h1>

      <OrnamentalDivider width="160px" />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', maxWidth: '280px' }}>
        <PrimaryButton size="md" fullWidth onClick={tryAgain}>
          Try Again
        </PrimaryButton>
        <SecondaryButton size="md" fullWidth onClick={toMenu}>
          Menu
        </SecondaryButton>
      </div>
    </div>
  );
}
