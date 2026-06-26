import { useEffect, useRef, useState } from 'react';
import { gsap } from '@/lib/gsap';
import { COLORS } from '@/constants';
import { Modal } from '@/components/modals/Modal';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { audioManager } from '@/game/audio/AudioManager';
import { hapticsManager } from '@/game/haptics/HapticsManager';
import { spawnCoinReward } from '@/game/effects/coinFX';
import {
  DAILY_REWARDS,
  getDailyStatus,
  claimDailyReward,
} from '@/game/systems/DailyRewardSystem';

interface DailyRewardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Format a millisecond duration as HH:MM:SS.
function formatHMS(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}

function DayDot({
  day,
  currentDay,
  earnedCoins,
}: {
  day: number;
  currentDay: number;
  earnedCoins: number;
}) {
  const done = day < currentDay;
  const active = day === currentDay;
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '4px',
        flex: 1,
      }}
    >
      <div
        style={{
          width: active ? 36 : 28,
          height: active ? 36 : 28,
          borderRadius: '50%',
          background: done
            ? `linear-gradient(135deg, ${COLORS.gold}, ${COLORS.darkGold})`
            : active
              ? `linear-gradient(135deg, ${COLORS.gold}, ${COLORS.darkGold})`
              : 'rgba(212,175,55,0.12)',
          border: active
            ? `2px solid ${COLORS.gold}`
            : done
              ? `1.5px solid ${COLORS.darkGold}`
              : '1.5px solid rgba(212,175,55,0.25)',
          boxShadow: active ? `0 0 14px rgba(212,175,55,0.7)` : 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s ease',
        }}
      >
        {done ? (
          <span style={{ fontSize: '13px', color: '#1a0f00', fontWeight: 700 }}>✓</span>
        ) : (
          <span
            style={{
              fontSize: active ? '12px' : '10px',
              color: active ? '#1a0f00' : 'rgba(212,175,55,0.45)',
              fontFamily: 'var(--font-heading)',
              fontWeight: 700,
            }}
          >
            {day}
          </span>
        )}
      </div>
      <span
        style={{
          fontFamily: 'var(--font-heading)',
          fontSize: '8px',
          letterSpacing: '0.5px',
          color: active ? COLORS.gold : done ? COLORS.sandstone : 'rgba(212,175,55,0.3)',
          opacity: active ? 1 : 0.8,
        }}
      >
        {earnedCoins}
      </span>
    </div>
  );
}

export function DailyRewardModal({ isOpen, onClose }: DailyRewardModalProps) {
  const claimedRef = useRef(false);
  const coinsBadgeRef = useRef<HTMLDivElement>(null);

  const status = getDailyStatus();
  const [msLeft, setMsLeft] = useState(status.msUntilNextClaim);

  // Live countdown when already claimed today.
  useEffect(() => {
    if (!isOpen || status.claimable) return;
    setMsLeft(getDailyStatus().msUntilNextClaim);
    const id = window.setInterval(() => {
      const ms = getDailyStatus().msUntilNextClaim;
      setMsLeft(ms);
      if (ms <= 0) window.clearInterval(id);
    }, 1000);
    return () => window.clearInterval(id);
  }, [isOpen, status.claimable]);

  // Reset claim guard when modal opens.
  useEffect(() => {
    if (isOpen) claimedRef.current = false;
  }, [isOpen]);

  // Coin badge pulse on open.
  useEffect(() => {
    if (!isOpen || !coinsBadgeRef.current) return;
    try {
      gsap.fromTo(
        coinsBadgeRef.current,
        { scale: 0.7, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.45, ease: 'back.out(2)', delay: 0.2 },
      );
    } catch { /* noop */ }
  }, [isOpen]);

  const handleClaim = () => {
    if (claimedRef.current || !status.claimable) return;
    claimedRef.current = true;

    const coins = claimDailyReward();
    audioManager.play('click');
    hapticsManager.trigger('success');

    // Coin burst from the badge centre.
    if (coinsBadgeRef.current) {
      const r = coinsBadgeRef.current.getBoundingClientRect();
      spawnCoinReward(coins, r.left + r.width / 2, r.top + r.height / 2);
    }

    // Brief delay so the coin float is visible before the modal closes.
    setTimeout(onClose, 640);
  };

  const todayReward = DAILY_REWARDS[Math.min(status.streakDay - 1, 6)];

  return (
    <Modal isOpen={isOpen} title="Daily Reward" locked>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '20px',
        }}
      >
        {/* ── Day streak row ─────────────────────────────────────────────────── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: '4px',
            width: '100%',
            padding: '4px 0',
          }}
        >
          {DAILY_REWARDS.map((r) => (
            <DayDot
              key={r.day}
              day={r.day}
              currentDay={status.streakDay}
              earnedCoins={r.coins}
            />
          ))}
        </div>

        {/* Connector line under dots */}
        <div
          aria-hidden
          style={{
            width: '100%',
            height: 2,
            marginTop: -16,
            background: `linear-gradient(90deg, ${COLORS.darkGold}, ${COLORS.gold}, ${COLORS.darkGold})`,
            opacity: 0.25,
            borderRadius: 1,
          }}
        />

        {/* ── Today's coin badge ─────────────────────────────────────────────── */}
        <div
          ref={coinsBadgeRef}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '6px',
            padding: '18px 28px',
            borderRadius: '8px',
            background: 'linear-gradient(180deg, rgba(40,24,5,0.95), rgba(24,14,2,0.98))',
            border: `1px solid rgba(212,175,55,0.45)`,
            boxShadow: '0 0 28px rgba(212,175,55,0.25)',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '9px',
              letterSpacing: '3px',
              textTransform: 'uppercase',
              color: COLORS.sandstone,
              opacity: 0.7,
            }}
          >
            Day {todayReward.day}
          </span>
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '38px',
              fontWeight: 700,
              color: COLORS.gold,
              textShadow: '0 0 20px rgba(212,175,55,0.7)',
              lineHeight: 1,
            }}
          >
            ✦
          </span>
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '28px',
              fontWeight: 700,
              color: COLORS.ivory,
              letterSpacing: '1px',
            }}
          >
            +{todayReward.coins}
            <span
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '13px',
                color: COLORS.gold,
                marginLeft: '4px',
                verticalAlign: 'middle',
              }}
            >
              Coins
            </span>
          </span>
        </div>

        {/* ── CTA or countdown ──────────────────────────────────────────────── */}
        {status.claimable ? (
          <PrimaryButton size="md" fullWidth onClick={handleClaim}>
            ✦ &nbsp; Claim Reward
          </PrimaryButton>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '6px',
              width: '100%',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '9px',
                letterSpacing: '3px',
                textTransform: 'uppercase',
                color: COLORS.sandstone,
                opacity: 0.65,
              }}
            >
              Next reward in
            </span>
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '26px',
                fontWeight: 700,
                color: COLORS.gold,
                letterSpacing: '4px',
                fontVariantNumeric: 'tabular-nums',
                textShadow: '0 0 14px rgba(212,175,55,0.4)',
              }}
            >
              {formatHMS(msLeft)}
            </span>
            <button
              onClick={onClose}
              style={{
                marginTop: '8px',
                background: 'none',
                border: `1px solid rgba(212,175,55,0.28)`,
                borderRadius: '3px',
                padding: '8px 24px',
                fontFamily: 'var(--font-heading)',
                fontSize: '10px',
                letterSpacing: '2px',
                textTransform: 'uppercase',
                color: COLORS.sandstone,
                cursor: 'pointer',
                opacity: 0.75,
              }}
            >
              Close
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
