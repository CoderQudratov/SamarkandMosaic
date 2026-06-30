import { Fragment, useEffect } from 'react';
import { COLORS, CONFIG } from '@/constants';
import { useScreenTransition } from '@/hooks/useScreenTransition';
import { usePlayerStore, isLevelUnlocked } from '@/store/playerStore';
import { useUIStore } from '@/store/uiStore';
import { registerBackButton, unregisterBackButton } from '@/integrations/telegram';
import { useLevelStore } from '@/store/levelStore';
import { useHeartRefill, formatCountdown } from '@/game/hooks/useHeartRefill';
import { audioManager } from '@/game/audio/AudioManager';
import { hapticsManager } from '@/game/haptics/HapticsManager';
import { OrnamentalDivider } from '@/components/ui/OrnamentalDivider';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { LevelCard, type LevelStatus } from '@/components/levels/LevelCard';
import { LevelPath } from '@/components/levels/LevelPath';
import { TOTAL_LEVELS, LEVEL_REGISTRY, isLevelAvailable } from '@/game/levels/registry';

// ── HUD icons ───────────────────────────────────────────────────────────────
function CoinIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <circle cx="7.5" cy="7.5" r="6.5" fill={COLORS.gold} opacity="0.95" />
      <circle cx="7.5" cy="7.5" r="4.5" fill="none" stroke="rgba(26,15,0,0.4)" strokeWidth="0.8" />
    </svg>
  );
}
function HeartMini({ filled }: { filled: boolean }) {
  return (
    <svg width="14" height="13" viewBox="0 0 16 16" fill="none">
      <path
        d="M8 14S1.5 9.5 1.5 5.5C1.5 3.57 3.07 2 5 2c1.1 0 2.07.5 2.71 1.29L8 4l.29-.71A3.5 3.5 0 0 1 11 2c1.93 0 3.5 1.57 3.5 3.5C14.5 9.5 8 14 8 14Z"
        fill={filled ? '#CC2200' : 'none'}
        stroke={filled ? '#CC2200' : 'rgba(204,34,0,0.4)'}
        strokeWidth="1.3"
      />
    </svg>
  );
}
function LampMini() {
  return (
    <svg width="14" height="16" viewBox="0 0 20 22" fill="none">
      <path
        d="M10 2C6.69 2 4 4.69 4 8c0 2.21 1.19 4.14 2.97 5.22V15h6.06v-1.78C14.81 12.14 16 10.21 16 8c0-3.31-2.69-6-6-6Z"
        fill="rgba(212,175,55,0.25)" stroke={COLORS.gold} strokeWidth="1.4"
      />
      <rect x="7" y="15" width="6" height="1.5" rx="0.5" fill={COLORS.gold} />
    </svg>
  );
}

function SummaryItem({ label, value, glyph }: { label: string; value: string; glyph: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '1px',
        minWidth: 56,
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '16px',
          color: COLORS.gold,
          textShadow: '0 0 10px rgba(212,175,55,0.5)',
        }}
      >
        {glyph}
      </span>
      <span
        style={{
          fontFamily: 'var(--font-heading)',
          fontSize: '13px',
          fontWeight: 700,
          letterSpacing: '0.5px',
          color: COLORS.ivory,
        }}
      >
        {value}
      </span>
      <span
        style={{
          fontFamily: 'var(--font-heading)',
          fontSize: '8px',
          letterSpacing: '2px',
          textTransform: 'uppercase',
          color: COLORS.sandstone,
          opacity: 0.65,
        }}
      >
        {label}
      </span>
    </div>
  );
}

function StatChip({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '5px',
        padding: '4px 10px',
        borderRadius: '20px',
        background: 'rgba(212,175,55,0.1)',
        border: '1px solid rgba(212,175,55,0.25)',
        fontFamily: 'var(--font-heading)',
        fontSize: '12px',
        fontWeight: 600,
        color: COLORS.gold,
        letterSpacing: '0.5px',
      }}
    >
      {children}
    </div>
  );
}

export function LevelSelectScreen() {
  const { containerRef, navigateTo } = useScreenTransition();

  // Telegram BackButton: LevelSelect → MainMenu
  useEffect(() => {
    registerBackButton(() => navigateTo('mainMenu'));
    return () => unregisterBackButton();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const progress = usePlayerStore((s) => s.progress);
  const coins = usePlayerStore((s) => s.coins);
  const hints = usePlayerStore((s) => s.hints);
  const { hearts, full: heartsFull, msUntilNext } = useHeartRefill();

  const completed = progress.completedLevels;

  // ── Progress summary values ──────────────────────────────────────────────
  const totalStars = Object.values(progress.stars).reduce<number>((s, v) => s + (v ?? 0), 0);
  const completedCount = completed.length;
  const completionPct = Math.round((completedCount / TOTAL_LEVELS) * 100);

  // "Current" = the lowest unlocked level that hasn't been completed yet.
  let currentLevel = -1;
  for (let lvl = 1; lvl <= TOTAL_LEVELS; lvl++) {
    if (isLevelUnlocked(progress, lvl) && !completed.includes(lvl)) {
      currentLevel = lvl;
      break;
    }
  }

  const statusFor = (lvl: number): LevelStatus => {
    if (!isLevelAvailable(lvl)) return 'locked';
    if (!isLevelUnlocked(progress, lvl)) return 'locked';
    if (completed.includes(lvl)) return 'completed';
    if (lvl === currentLevel) return 'current';
    return 'unlocked';
  };

  const handleSelect = (lvl: number) => {
    if (!isLevelAvailable(lvl)) return;
    audioManager.play('click');
    hapticsManager.trigger('light');
    useLevelStore.getState().setSelectedLevelId(lvl);
    navigateTo('game');
  };

  const handleLocked = () => {
    audioManager.play('wrong');
    hapticsManager.trigger('warning');
  };

  const levels = Array.from({ length: TOTAL_LEVELS }, (_, i) => i + 1);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* ── Top HUD ──────────────────────────────────────────────────────────── */}
      <div
        style={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px',
          padding: '12px 16px',
          borderBottom: '1px solid rgba(212,175,55,0.15)',
          background: 'linear-gradient(180deg, rgba(26,15,0,0.98), rgba(18,10,0,0.95))',
        }}
      >
        <button
          onClick={() => useUIStore.getState().setShopOpen(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            padding: '4px 10px',
            borderRadius: '20px',
            background: 'rgba(212,175,55,0.1)',
            border: '1px solid rgba(212,175,55,0.28)',
            cursor: 'pointer',
            fontFamily: 'var(--font-heading)',
            fontSize: '12px',
            fontWeight: 600,
            color: COLORS.gold,
            letterSpacing: '0.5px',
          }}
          aria-label="Open shop"
        >
          <CoinIcon />
          {coins}
        </button>

        <StatChip>
          <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
            {Array.from({ length: CONFIG.maxHearts }).map((_, i) => (
              <HeartMini key={i} filled={i < hearts} />
            ))}
          </div>
          {!heartsFull && (
            <span style={{ fontSize: '10px', opacity: 0.8, fontVariantNumeric: 'tabular-nums' }}>
              {formatCountdown(msUntilNext)}
            </span>
          )}
        </StatChip>

        <StatChip>
          <LampMini />
          {hints}
        </StatChip>
      </div>

      {/* ── Title ────────────────────────────────────────────────────────────── */}
      <div style={{ flexShrink: 0, textAlign: 'center', padding: '16px 0 6px' }}>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(18px, 5vw, 24px)',
            fontWeight: 700,
            letterSpacing: '4px',
            textTransform: 'uppercase',
            color: COLORS.gold,
            textShadow: '0 0 20px rgba(212,175,55,0.4)',
          }}
        >
          Select Mosaic
        </h1>
        <OrnamentalDivider width="150px" />
      </div>

      {/* ── Progress summary ────────────────────────────────────────────────── */}
      <div
        style={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '20px',
          padding: '10px 24px',
          borderBottom: '1px solid rgba(212,175,55,0.1)',
        }}
      >
        <SummaryItem label="Stars" value={`${totalStars} / ${TOTAL_LEVELS * 3}`} glyph="★" />
        <SummaryItem label="Done" value={`${completedCount} / ${TOTAL_LEVELS}`} glyph="✓" />
        <SummaryItem label="Progress" value={`${completionPct}%`} glyph="◈" />
      </div>

      {/* ── Scrollable level trail ───────────────────────────────────────────── */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '12px 16px 28px',
          scrollSnapType: 'y proximity',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {levels.map((lvl, i) => (
          <Fragment key={lvl}>
            <LevelCard
              level={lvl}
              name={LEVEL_REGISTRY.find((l) => l.id === lvl)?.name}
              status={statusFor(lvl)}
              stars={progress.stars[lvl] ?? 0}
              onSelect={handleSelect}
              onLocked={handleLocked}
            />
            {i < levels.length - 1 && <LevelPath lit={completed.includes(lvl)} />}
          </Fragment>
        ))}
      </div>

      {/* ── Bottom: Back ─────────────────────────────────────────────────────── */}
      <div
        style={{
          flexShrink: 0,
          padding: '12px 24px calc(12px + var(--safe-area-bottom, 0px))',
          borderTop: '1px solid rgba(212,175,55,0.12)',
          background: 'rgba(18,10,0,0.95)',
        }}
      >
        <SecondaryButton size="md" fullWidth onClick={() => navigateTo('mainMenu')}>
          ← &nbsp; Back
        </SecondaryButton>
      </div>
    </div>
  );
}
