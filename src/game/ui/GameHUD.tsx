import { useEffect, useRef, type RefObject } from 'react';
import { gsap } from '@/lib/gsap';
import { COLORS, CONFIG } from '@/constants';
import { audioManager } from '@/game/audio/AudioManager';
import { hapticsManager } from '@/game/haptics/HapticsManager';
import { useHeartRefill, formatCountdown } from '@/game/hooks/useHeartRefill';

// ── Icons ─────────────────────────────────────────────────────────────────────

function BurgerIcon() {
  return (
    <svg width="20" height="16" viewBox="0 0 20 16" fill="none">
      <rect x="0" y="0"  width="20" height="2.5" rx="1.25" fill={COLORS.gold} />
      <rect x="2" y="6.75" width="16" height="2.5" rx="1.25" fill={COLORS.gold} />
      <rect x="4" y="13.5" width="12" height="2.5" rx="1.25" fill={COLORS.gold} />
    </svg>
  );
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="18" height="16" viewBox="0 0 18 16" fill="none">
      <path
        d="M9 14S2 9.5 2 5.5C2 3.57 3.57 2 5.5 2c1.12 0 2.1.52 2.75 1.32L9 4.2l.75-.88A3.5 3.5 0 0 1 12.5 2C14.43 2 16 3.57 16 5.5 16 9.5 9 14 9 14Z"
        fill={filled ? '#CC2200' : 'none'}
        stroke={filled ? '#CC2200' : 'rgba(204,34,0,0.35)'}
        strokeWidth="1.5"
      />
    </svg>
  );
}

function CoinIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <circle cx="7.5" cy="7.5" r="6.5" fill={COLORS.gold} opacity="0.95" />
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

function LampIcon({ dim }: { dim: boolean }) {
  const col = dim ? 'rgba(212,175,55,0.3)' : COLORS.gold;
  return (
    <svg width="20" height="22" viewBox="0 0 20 22" fill="none">
      {/* Bulb body */}
      <path
        d="M10 2C6.69 2 4 4.69 4 8c0 2.21 1.19 4.14 2.97 5.22V15h6.06v-1.78C14.81 12.14 16 10.21 16 8c0-3.31-2.69-6-6-6Z"
        fill={dim ? 'rgba(212,175,55,0.15)' : 'rgba(212,175,55,0.25)'}
        stroke={col}
        strokeWidth="1.4"
      />
      {/* Base */}
      <rect x="7" y="15" width="6" height="1.5" rx="0.5" fill={col} />
      <rect x="7.5" y="17" width="5" height="1.5" rx="0.5" fill={col} />
      {/* Shine */}
      {!dim && (
        <circle cx="7.5" cy="7" r="1.2" fill="rgba(255,255,200,0.6)" />
      )}
    </svg>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

interface GameHUDProps {
  levelTitle: string;
  placed: number;
  total: number;
  percent: number;
  hearts: number;
  coins: number;
  hintUsed: boolean;
  onBurger: () => void;
  onHint: () => void;
  onShop?: () => void;
  disabled?: boolean;
  hintBtnRef?: RefObject<HTMLButtonElement>;
}

export function GameHUD({
  levelTitle,
  placed,
  total,
  percent,
  hearts,
  coins,
  hintUsed,
  onBurger,
  onHint,
  onShop,
  disabled,
  hintBtnRef,
}: GameHUDProps) {
  const heartRefs = useRef<(HTMLDivElement | null)[]>([]);
  const prevHeartsRef = useRef(hearts);

  // Live regeneration countdown (ticks every second, grants due hearts).
  const { full: heartsFull, msUntilNext } = useHeartRefill();

  // Animate hearts on change: shake/flash on loss, pop+glow on refill.
  useEffect(() => {
    const prev = prevHeartsRef.current;

    if (hearts < prev) {
      // Lost a heart — shake + flash the one that just emptied.
      const el = heartRefs.current[hearts]; // 0-based index of newly-emptied heart
      if (el) {
        try {
          gsap.killTweensOf(el);
          gsap.timeline()
            .to(el, { x: 6, scale: 1.3, duration: 0.06 })
            .to(el, { x: -6, duration: 0.08 })
            .to(el, { x: 4, duration: 0.06 })
            .to(el, { x: -3, duration: 0.05 })
            .to(el, { x: 0, scale: 1, duration: 0.05 });
        } catch { /* noop */ }
      }
    } else if (hearts > prev) {
      // Regenerated — pop + glow each heart that just refilled.
      for (let idx = prev; idx < hearts; idx++) {
        const el = heartRefs.current[idx];
        if (!el) continue;
        try {
          gsap.killTweensOf(el);
          // Pop: scale 1 → 1.2 → 1
          gsap.timeline()
            .fromTo(el, { scale: 1 }, { scale: 1.2, duration: 0.18, ease: 'back.out(3)' })
            .to(el, { scale: 1, duration: 0.16, ease: 'power2.out' });
          // Soft glow that fades out.
          gsap.fromTo(
            el,
            { filter: 'drop-shadow(0 0 8px rgba(204,34,0,0.95))' },
            { filter: 'drop-shadow(0 0 0px rgba(204,34,0,0))', duration: 0.55, ease: 'power2.out' },
          );
        } catch { /* noop */ }
      }
      audioManager.play('click'); // soft refill sound
      hapticsManager.trigger('light');
    }

    prevHeartsRef.current = hearts;
  }, [hearts]);

  const iconBtn: React.CSSProperties = {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '6px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '4px',
    flexShrink: 0,
  };

  return (
    <div
      style={{
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(180deg, rgba(26,15,0,0.99) 0%, rgba(18,10,0,0.97) 100%)',
        borderBottom: '1px solid rgba(212,175,55,0.18)',
        boxShadow: '0 2px 12px rgba(0,0,0,0.5)',
        position: 'relative',
        zIndex: 10,
      }}
    >
      {/* Main row */}
      <div
        style={{
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
        }}
      >
        {/* Left — burger + coin balance */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <button
            onClick={disabled ? undefined : onBurger}
            style={iconBtn}
            aria-label="Pause menu"
          >
            <BurgerIcon />
          </button>

          {/* Coin balance — tappable to open shop */}
          <button
            onClick={onShop}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 8px',
              borderRadius: '20px',
              background: 'rgba(212,175,55,0.1)',
              border: '1px solid rgba(212,175,55,0.25)',
              cursor: onShop ? 'pointer' : 'default',
              fontFamily: 'var(--font-heading)',
              fontSize: '12px',
              fontWeight: 600,
              letterSpacing: '0.5px',
              color: COLORS.gold,
            }}
            aria-label="Open shop"
          >
            <CoinIcon />
            <span style={{ minWidth: '12px', textAlign: 'center' }}>{coins}</span>
          </button>
        </div>

        {/* Center — title + piece count */}
        <div
          style={{
            flex: 1,
            textAlign: 'center',
            minWidth: 0,
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '13px',
              letterSpacing: '3px',
              textTransform: 'uppercase',
              color: COLORS.gold,
              textShadow: '0 0 14px rgba(212,175,55,0.4)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {levelTitle}
          </div>
          <div
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '9px',
              letterSpacing: '2px',
              color: COLORS.sandstone,
              opacity: 0.55,
              marginTop: '1px',
            }}
          >
            {placed} / {total} pieces
          </div>
        </div>

        {/* Right — hearts + hint */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          {/* Hearts + regen timer */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '1px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
              {Array.from({ length: CONFIG.maxHearts }).map((_, i) => (
                <div
                  key={i}
                  ref={(el) => { heartRefs.current[i] = el; }}
                  style={{ display: 'flex', alignItems: 'center' }}
                >
                  <HeartIcon filled={i < hearts} />
                </div>
              ))}
            </div>

            {/* Countdown to next heart — only while not full */}
            {!heartsFull && (
              <span
                style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: '8px',
                  letterSpacing: '1px',
                  color: COLORS.sandstone,
                  opacity: 0.7,
                  lineHeight: 1,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {formatCountdown(msUntilNext)}
              </span>
            )}
          </div>

          {/* Divider */}
          <div
            style={{ width: 1, height: 18, background: 'rgba(212,175,55,0.2)', flexShrink: 0 }}
          />

          {/* Hint button */}
          <button
            ref={hintBtnRef}
            onClick={!disabled && !hintUsed ? onHint : undefined}
            style={{
              ...iconBtn,
              opacity: hintUsed ? 0.3 : 0.9,
              cursor: hintUsed || disabled ? 'default' : 'pointer',
              transition: 'opacity 0.3s ease',
              transformOrigin: 'center center',
            }}
            aria-label={hintUsed ? 'Hint used' : 'Use hint'}
            disabled={hintUsed || disabled}
          >
            <LampIcon dim={hintUsed} />
          </button>
        </div>
      </div>

      {/* Progress line — 2px gold bar at bottom of HUD */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          height: '2px',
          width: `${percent}%`,
          background: `linear-gradient(90deg, ${COLORS.darkGold}, ${COLORS.gold})`,
          transition: 'width 0.35s ease',
          boxShadow: `0 0 6px rgba(212,175,55,0.6)`,
        }}
      />
    </div>
  );
}
