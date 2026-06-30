import { useEffect, useRef } from 'react';
import { gsap } from '@/lib/gsap';
import { useLevelStore } from '@/store/levelStore';
import { usePlayerStore, isLevelUnlocked } from '@/store/playerStore';
import { useScreenTransition } from '@/hooks/useScreenTransition';
import { GameLogo } from '@/components/ui/GameLogo';
import { OrnamentalDivider } from '@/components/ui/OrnamentalDivider';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { COLORS } from '@/constants';
import { getLastWinPayload } from '@/game/systems/EconomySystem';
import { showMainButton, hideMainButton } from '@/integrations/telegram';

const TOTAL_LEVELS = 10;

// Animates a number from 0 to `target` over `duration` ms.
function useCountUp(target: number, durationMs = 600): React.RefObject<HTMLSpanElement> {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!ref.current || target === 0) return;
    const obj = { val: 0 };
    const tween = gsap.to(obj, {
      val: target,
      duration: durationMs / 1000,
      ease: 'power2.out',
      delay: 0.3,
      onUpdate: () => {
        if (ref.current) ref.current.textContent = `+${Math.round(obj.val)}`;
      },
    });
    return () => { tween.kill(); };
  }, [target, durationMs]);
  return ref;
}

function RewardRow({
  label,
  amount,
  highlight = false,
  delay = 0,
}: {
  label: string;
  amount: number;
  highlight?: boolean;
  delay?: number;
}) {
  const amountRef = useCountUp(amount, 500);
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!rowRef.current) return;
    gsap.fromTo(rowRef.current, { opacity: 0, x: -12 }, { opacity: 1, x: 0, duration: 0.35, ease: 'power2.out', delay: delay / 1000 });
  }, [delay]);

  if (amount === 0) return null;
  return (
    <div
      ref={rowRef}
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '5px 0',
        borderBottom: highlight ? `1px solid rgba(212,175,55,0.3)` : '1px solid rgba(212,175,55,0.08)',
        opacity: 0,
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-heading)',
          fontSize: highlight ? '13px' : '11px',
          letterSpacing: '1.5px',
          color: highlight ? COLORS.gold : COLORS.sandstone,
          textTransform: 'uppercase',
          fontWeight: highlight ? 700 : 400,
        }}
      >
        {label}
      </span>
      <span
        ref={amountRef}
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: highlight ? '18px' : '14px',
          fontWeight: 700,
          color: highlight ? COLORS.gold : COLORS.ivory,
          textShadow: highlight ? '0 0 12px rgba(212,175,55,0.5)' : 'none',
        }}
      >
        +0
      </span>
    </div>
  );
}

export function WinScene() {
  const { containerRef, navigateTo } = useScreenTransition();

  const selectedLevelId = useLevelStore((s) => s.selectedLevelId);
  const progress = usePlayerStore((s) => s.progress);

  const nextLevelId = selectedLevelId + 1;
  const hasNext = nextLevelId <= TOTAL_LEVELS && isLevelUnlocked(progress, nextLevelId);

  const win = getLastWinPayload();

  const handleNext = () => {
    useLevelStore.getState().setSelectedLevelId(nextLevelId);
    navigateTo('game');
  };

  const handleReplay = () => {
    navigateTo('game');
  };

  const handleMenu = () => navigateTo('levelSelect');

  // ── Telegram MainButton ─────────────────────────────────────────────────────
  // Show "NEXT LEVEL" in the Telegram native button bar when a next level is
  // available; hide it when the scene unmounts (player navigated away).
  useEffect(() => {
    if (hasNext) showMainButton('NEXT LEVEL', handleNext);
    return () => hideMainButton();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasNext]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
        padding: '28px 32px',
        textAlign: 'center',
        overflowY: 'auto',
      }}
    >
      <GameLogo size={140} />

      <h1
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(18px, 5vw, 24px)',
          fontWeight: 700,
          letterSpacing: '4px',
          textTransform: 'uppercase',
          color: COLORS.gold,
          textShadow: '0 0 24px rgba(212,175,55,0.5)',
        }}
      >
        Mosaic Restored
      </h1>

      <OrnamentalDivider width="160px" />

      {/* ── Reward breakdown ─────────────────────────────────────────────────── */}
      {win && (
        <div
          style={{
            width: '100%',
            maxWidth: '280px',
            background: 'linear-gradient(180deg, rgba(28,16,3,0.96), rgba(18,10,2,0.99))',
            border: '1px solid rgba(212,175,55,0.2)',
            borderRadius: '6px',
            padding: '14px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
          }}
        >
          <RewardRow label="Base reward" amount={win.breakdown.base} delay={100} />
          <RewardRow label="Perfect clear" amount={win.breakdown.perfectBonus} delay={250} />
          <RewardRow label="Speed bonus" amount={win.breakdown.speedBonus} delay={400} />
          <RewardRow label="Total coins" amount={win.breakdown.total} highlight delay={580} />
        </div>
      )}

      {/* ── Navigation buttons ────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          width: '100%',
          maxWidth: '280px',
        }}
      >
        {hasNext ? (
          <PrimaryButton size="md" fullWidth onClick={handleNext}>
            Next Level →
          </PrimaryButton>
        ) : (
          <PrimaryButton size="md" fullWidth onClick={handleMenu}>
            ✦ &nbsp; Level Select
          </PrimaryButton>
        )}

        <SecondaryButton size="md" fullWidth onClick={handleReplay}>
          ↺ &nbsp; Replay
        </SecondaryButton>

        <SecondaryButton size="md" fullWidth onClick={handleMenu}>
          Menu
        </SecondaryButton>
      </div>
    </div>
  );
}
