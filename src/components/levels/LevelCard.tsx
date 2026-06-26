import { useEffect, useRef, useState } from 'react';
import { gsap } from '@/lib/gsap'; // static import — matches all other callers
import { COLORS } from '@/constants';

export type LevelStatus = 'locked' | 'unlocked' | 'completed' | 'current';

interface LevelCardProps {
  level: number;
  name?: string;   // display name from registry; falls back to "Level N"
  status: LevelStatus;
  stars: number;   // 0–3 earned
  onSelect: (level: number) => void;
  onLocked: () => void;
}

// Spawn a brief red radial pulse on a DOM element — same pattern as wrongFX.
function spawnLockedPulse(el: HTMLElement): void {
  const { left, top, width, height } = el.getBoundingClientRect();
  const overlay = document.createElement('div');
  Object.assign(overlay.style, {
    position: 'fixed',
    left: `${left}px`,
    top: `${top}px`,
    width: `${width}px`,
    height: `${height}px`,
    borderRadius: '8px',
    background: 'rgba(204,34,0,0.18)',
    border: '2px solid rgba(204,34,0,0.7)',
    boxShadow: '0 0 18px rgba(204,34,0,0.55)',
    pointerEvents: 'none',
    zIndex: '300',
    opacity: '1',
  });
  document.body.appendChild(overlay);
  gsap.to(overlay, {
    opacity: 0,
    duration: 0.38,
    ease: 'power2.out',
    onComplete: () => overlay.remove(),
  });
}

const CARD_W = 168;

// Thumbnail with graceful fallback when the level art isn't present yet.
function Thumbnail({ level, dim }: { level: number; dim: boolean }) {
  const [failed, setFailed] = useState(false);
  const src = `/assets/levels/level-${level}/thumbnail.png`;

  if (failed) {
    return (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background:
            'radial-gradient(circle at 50% 40%, rgba(210,180,140,0.18), rgba(26,15,0,0.85))',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '46px',
            fontWeight: 700,
            color: 'rgba(212,175,55,0.4)',
            textShadow: '0 2px 10px rgba(0,0,0,0.5)',
          }}
        >
          {level}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={`Level ${level}`}
      draggable={false}
      onError={() => setFailed(true)}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        filter: dim ? 'grayscale(85%) brightness(0.55)' : undefined,
      }}
    />
  );
}

function Star({ filled }: { filled: boolean }) {
  return (
    <span
      style={{
        fontSize: '13px',
        lineHeight: 1,
        color: filled ? COLORS.gold : 'rgba(212,175,55,0.25)',
        textShadow: filled ? `0 0 6px rgba(212,175,55,0.7)` : 'none',
      }}
    >
      ★
    </span>
  );
}

export function LevelCard({ level, name, status, stars, onSelect, onLocked }: LevelCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const locked = status === 'locked';
  const completed = status === 'completed';
  const current = status === 'current';

  // Glow pulse for the current level.
  useEffect(() => {
    if (!current || !cardRef.current) return;
    const tween = gsap.to(cardRef.current, {
      boxShadow: '0 0 26px rgba(212,175,55,0.85), 0 0 0 2px rgba(212,175,55,0.9) inset',
      duration: 0.9,
      ease: 'sine.inOut',
      yoyo: true,
      repeat: -1,
    });
    return () => { tween.kill(); };
  }, [current]);

  const handleClick = () => {
    if (locked) {
      if (cardRef.current) {
        // Shake
        gsap.killTweensOf(cardRef.current);
        gsap
          .timeline()
          .to(cardRef.current, { x: -6, duration: 0.05 })
          .to(cardRef.current, { x: 6, duration: 0.08 })
          .to(cardRef.current, { x: -4, duration: 0.06 })
          .to(cardRef.current, { x: 0, duration: 0.05 });
        // Red pulse overlay
        spawnLockedPulse(cardRef.current);
      }
      onLocked();
      return;
    }
    onSelect(level);
  };

  // Border / frame per state.
  const border = completed
    ? `2px solid ${COLORS.gold}`
    : current
      ? `2px solid ${COLORS.gold}`
      : locked
        ? '1px solid rgba(212,175,55,0.15)'
        : '1px solid rgba(212,175,55,0.4)';

  const boxShadow = completed
    ? '0 0 18px rgba(212,175,55,0.45)'
    : '0 6px 18px rgba(0,0,0,0.45)';

  return (
    <div
      ref={cardRef}
      onClick={handleClick}
      role="button"
      aria-label={`Level ${level}${locked ? ' (locked)' : ''}`}
      aria-disabled={locked}
      style={{
        position: 'relative',
        width: CARD_W,
        borderRadius: '8px',
        overflow: 'hidden',
        border,
        boxShadow,
        cursor: locked ? 'default' : 'pointer',
        opacity: locked ? 0.55 : 1,
        background: '#1a0f00',
        scrollSnapAlign: 'center',
        flexShrink: 0,
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
    >
      {/* Thumbnail */}
      <div style={{ position: 'relative', width: '100%', aspectRatio: '1 / 1' }}>
        <Thumbnail level={level} dim={locked} />

        {/* Level number badge */}
        <div
          style={{
            position: 'absolute',
            top: 6,
            left: 6,
            minWidth: 22,
            height: 22,
            padding: '0 6px',
            borderRadius: '12px',
            background: 'rgba(26,15,0,0.8)',
            border: `1px solid ${COLORS.gold}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'var(--font-heading)',
            fontSize: '11px',
            fontWeight: 700,
            color: COLORS.gold,
          }}
        >
          {level}
        </div>

        {/* Completed checkmark */}
        {completed && (
          <div
            style={{
              position: 'absolute',
              top: 6,
              right: 6,
              width: 22,
              height: 22,
              borderRadius: '50%',
              background: COLORS.gold,
              color: '#1a0f00',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '13px',
              fontWeight: 700,
              boxShadow: '0 0 10px rgba(212,175,55,0.8)',
            }}
          >
            ✓
          </div>
        )}

        {/* Lock icon */}
        {locked && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="30" height="34" viewBox="0 0 30 34" fill="none">
              <rect x="5" y="14" width="20" height="16" rx="3"
                fill="rgba(26,15,0,0.85)" stroke={COLORS.gold} strokeWidth="1.6" />
              <path d="M9 14v-3a6 6 0 0 1 12 0v3"
                fill="none" stroke={COLORS.gold} strokeWidth="1.6" />
              <circle cx="15" cy="21" r="2.2" fill={COLORS.gold} />
            </svg>
          </div>
        )}
      </div>

      {/* Footer: level name + stars */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '2px',
          padding: '5px 4px 6px',
          background: 'linear-gradient(180deg, rgba(26,15,0,0.4), rgba(26,15,0,0.88))',
        }}
      >
        {name && (
          <span
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '8px',
              letterSpacing: '1px',
              textTransform: 'uppercase',
              color: locked ? 'rgba(212,175,55,0.3)' : COLORS.sandstone,
              opacity: locked ? 0.6 : 0.85,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: '90%',
            }}
          >
            {name}
          </span>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
          {[0, 1, 2].map((i) => (
            <Star key={i} filled={i < stars} />
          ))}
        </div>
      </div>
    </div>
  );
}
