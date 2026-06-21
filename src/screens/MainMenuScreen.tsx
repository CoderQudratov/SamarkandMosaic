import { useRef, useEffect, useState } from 'react';
import { gsap } from '@/lib/gsap';
import { COLORS } from '@/constants';
import { TimuridStar } from '@/components/ui/TimuridStar';
import { OrnamentalDivider } from '@/components/ui/OrnamentalDivider';
import { CornerFlourish } from '@/components/ui/CornerFlourish';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { Modal } from '@/components/modals/Modal';
import { useScreenTransition } from '@/hooks/useScreenTransition';
import { usePlayerStore } from '@/store/playerStore';
import { CONFIG } from '@/constants';

// Heart & coin icons as inline SVG components
function HeartIcon({ filled = true }: { filled?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M8 14S1.5 9.5 1.5 5.5C1.5 3.57 3.07 2 5 2c1.1 0 2.07.5 2.71 1.29L8 4l.29-.71A3.5 3.5 0 0 1 11 2c1.93 0 3.5 1.57 3.5 3.5C14.5 9.5 8 14 8 14Z"
        fill={filled ? '#CC2200' : 'none'}
        stroke={filled ? '#CC2200' : 'rgba(204,34,0,0.4)'}
        strokeWidth="1.2"
      />
    </svg>
  );
}

function CoinIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <circle cx="7.5" cy="7.5" r="6.5" fill={COLORS.gold} opacity="0.9" />
      <circle cx="7.5" cy="7.5" r="4.5" fill="none" stroke="rgba(26,15,0,0.4)" strokeWidth="0.8" />
      <text
        x="7.5" y="10.5"
        textAnchor="middle"
        fontFamily="serif"
        fontSize="7"
        fontWeight="bold"
        fill="#1a0f00"
        opacity="0.6"
      >
        ✦
      </text>
    </svg>
  );
}

export function MainMenuScreen() {
  const { containerRef, navigateTo } = useScreenTransition();
  const topBarRef    = useRef<HTMLDivElement>(null);
  const emblemRef    = useRef<HTMLDivElement>(null);
  const panelRef     = useRef<HTMLDivElement>(null);
  const buttonsRef   = useRef<HTMLDivElement>(null);

  const getDisplayName = usePlayerStore((s) => s.getDisplayName);
  const hearts = CONFIG.startHearts; // placeholder until game phase
  const coins  = 0;                  // placeholder

  const [showSettings, setShowSettings] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  // Stagger entrance
  useEffect(() => {
    const targets = [topBarRef.current, emblemRef.current, panelRef.current, buttonsRef.current];
    gsap.fromTo(
      targets,
      { opacity: 0, y: 18 },
      { opacity: 1, y: 0, duration: 0.45, stagger: 0.09, ease: 'power2.out', delay: 0.08 },
    );
  }, []);

  const handlePlay = () => {
    // Game phase hook-in point — navigateTo('game') when board is ready
    navigateTo('game');
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        overflow: 'hidden',
      }}
    >
      {/* ── Top bar ────────────────────────────────────────────────────────── */}
      <div
        ref={topBarRef}
        style={{
          width: '100%',
          padding: '14px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(212,175,55,0.12)',
          flexShrink: 0,
        }}
      >
        {/* Player name */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            minWidth: 0,
          }}
        >
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              border: `1px solid rgba(212,175,55,0.4)`,
              background: 'rgba(212,175,55,0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: '13px', color: COLORS.gold }}>✦</span>
          </div>
          <span
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '12px',
              letterSpacing: '1.5px',
              color: COLORS.ivory,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '110px',
            }}
          >
            {getDisplayName()}
          </span>
        </div>

        {/* Hearts + Coins */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
          {/* Hearts */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
            {Array.from({ length: CONFIG.maxHearts }).map((_, i) => (
              <HeartIcon key={i} filled={i < hearts} />
            ))}
          </div>

          {/* Divider */}
          <div
            style={{ width: '1px', height: '16px', background: 'rgba(212,175,55,0.2)' }}
          />

          {/* Coins */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <CoinIcon />
            <span
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '12px',
                fontWeight: 600,
                color: COLORS.gold,
                letterSpacing: '1px',
              }}
            >
              {coins}
            </span>
          </div>
        </div>
      </div>

      {/* ── Main area ──────────────────────────────────────────────────────── */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px 28px',
          gap: '0',
          width: '100%',
        }}
      >
        {/* Emblem */}
        <div
          ref={emblemRef}
          style={{
            marginBottom: '24px',
            animation: 'floatY 5s ease-in-out infinite',
          }}
        >
          <TimuridStar size={68} glowing />
        </div>

        {/* Ornamental panel */}
        <div
          ref={panelRef}
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: '300px',
            padding: '24px 20px 20px',
            background:
              'linear-gradient(180deg, rgba(28,16,3,0.97) 0%, rgba(18,10,2,0.99) 100%)',
            border: '1px solid rgba(212,175,55,0.22)',
            borderRadius: '4px',
            marginBottom: '16px',
            textAlign: 'center',
          }}
        >
          <CornerFlourish corner="tl" size={16} inset={4} />
          <CornerFlourish corner="tr" size={16} inset={4} />
          <CornerFlourish corner="bl" size={16} inset={4} />
          <CornerFlourish corner="br" size={16} inset={4} />

          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(16px, 4.5vw, 22px)',
              fontWeight: 700,
              letterSpacing: '4px',
              textTransform: 'uppercase',
              color: COLORS.gold,
              marginBottom: '6px',
              textShadow: '0 0 20px rgba(212,175,55,0.4)',
            }}
          >
            Samarkand
            <br />
            Mosaic
          </h1>

          <OrnamentalDivider width="140px" />

          <p
            style={{
              marginTop: '10px',
              fontFamily: 'var(--font-body)',
              fontSize: '10px',
              letterSpacing: '2px',
              textTransform: 'uppercase',
              color: COLORS.sandstone,
              opacity: 0.65,
            }}
          >
            Ancient · Royal · Restored
          </p>
        </div>

        {/* Buttons */}
        <div
          ref={buttonsRef}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
            width: '100%',
            maxWidth: '300px',
          }}
        >
          <PrimaryButton size="lg" fullWidth onClick={handlePlay}>
            ▶ &nbsp; Play
          </PrimaryButton>

          <SecondaryButton size="md" fullWidth onClick={() => setShowSettings(true)}>
            ⚙ &nbsp; Settings
          </SecondaryButton>

          <SecondaryButton size="md" fullWidth onClick={() => setShowExitConfirm(true)}>
            ✕ &nbsp; Exit
          </SecondaryButton>
        </div>
      </div>

      {/* ── Settings modal ─────────────────────────────────────────────────── */}
      <Modal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        title="Settings"
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            paddingTop: '4px',
          }}
        >
          <SettingsRow label="Sound" value="On" />
          <SettingsRow label="Haptic" value="On" />
          <SettingsRow label="Theme" value="Dark" />

          <div style={{ marginTop: '8px' }}>
            <SecondaryButton
              size="sm"
              fullWidth
              onClick={() => {
                setShowSettings(false);
                navigateTo('nameInput');
              }}
            >
              Change Name
            </SecondaryButton>
          </div>
        </div>
      </Modal>

      {/* ── Exit confirm modal ─────────────────────────────────────────────── */}
      <Modal
        isOpen={showExitConfirm}
        onClose={() => setShowExitConfirm(false)}
        title="Leave the Mosaic?"
      >
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '12px',
            lineHeight: 1.7,
            letterSpacing: '0.5px',
            color: COLORS.sandstone,
            textAlign: 'center',
            marginBottom: '24px',
          }}
        >
          Your progress is saved.
          <br />
          The mosaics will await your return.
        </p>
        <div style={{ display: 'flex', gap: '12px' }}>
          <SecondaryButton
            size="sm"
            fullWidth
            onClick={() => setShowExitConfirm(false)}
          >
            Stay
          </SecondaryButton>
          <PrimaryButton
            size="sm"
            fullWidth
            onClick={() => window.Telegram?.WebApp?.close()}
          >
            Leave
          </PrimaryButton>
        </div>
      </Modal>
    </div>
  );
}

// Small settings row
function SettingsRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '10px 0',
        borderBottom: '1px solid rgba(212,175,55,0.1)',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-heading)',
          fontSize: '11px',
          letterSpacing: '2px',
          textTransform: 'uppercase',
          color: COLORS.sandstone,
          opacity: 0.8,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: 'var(--font-heading)',
          fontSize: '11px',
          letterSpacing: '2px',
          color: COLORS.gold,
          opacity: 0.9,
        }}
      >
        {value}
      </span>
    </div>
  );
}
