import { useUIStore } from '@/store/uiStore';
import { useBoardStore } from '@/store/boardStore';
import { GameLogo } from '@/components/ui/GameLogo';
import { OrnamentalDivider } from '@/components/ui/OrnamentalDivider';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { COLORS } from '@/constants';

export function WinScene() {
  const playAgain = () => {
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
      <GameLogo size={180} />

      <h1
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(20px, 5.5vw, 26px)',
          fontWeight: 700,
          letterSpacing: '4px',
          textTransform: 'uppercase',
          color: COLORS.gold,
          textShadow: '0 0 24px rgba(212,175,55,0.5)',
        }}
      >
        Mosaic Restored
      </h1>

      <OrnamentalDivider width="180px" />

      <p
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: '12px',
          lineHeight: 1.7,
          letterSpacing: '1px',
          color: COLORS.sandstone,
          opacity: 0.85,
          maxWidth: '260px',
        }}
      >
        A thousand years of beauty, made whole again by your hand.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px', width: '100%', maxWidth: '280px' }}>
        <PrimaryButton size="md" fullWidth onClick={playAgain}>
          Play Again
        </PrimaryButton>
        <SecondaryButton size="md" fullWidth onClick={toMenu}>
          Menu
        </SecondaryButton>
      </div>
    </div>
  );
}
