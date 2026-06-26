import { useEffect, useRef, useState } from 'react';
import { gsap } from '@/lib/gsap';
import { COLORS, TIMINGS } from '@/constants';
import { Modal } from '@/components/modals/Modal';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { audioManager } from '@/game/audio/AudioManager';
import { hapticsManager } from '@/game/haptics/HapticsManager';
import { spawnMosaicShards } from '@/game/effects/winFX';
import { rollChestReward, applyChestReward, type ChestReward } from '@/game/systems/ChestSystem';

type Phase = 'idle' | 'opening' | 'reveal';

interface ChestModalProps {
  isOpen: boolean;
  /** Called when the chest flow is finished (claimed or skipped). */
  onClose: () => void;
}

// Glyph shown on the reward card per reward type.
function rewardGlyph(reward: ChestReward): string {
  switch (reward.type) {
    case 'coins': return '✦';
    case 'heart': return '♥';
    case 'hint':  return '✸';
    case 'shard': return '◆';
  }
}

export function ChestModal({ isOpen, onClose }: ChestModalProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [reward, setReward] = useState<ChestReward | null>(null);

  const chestRef = useRef<HTMLDivElement>(null);
  const lidRef   = useRef<HTMLDivElement>(null);
  const burstRef = useRef<HTMLDivElement>(null);
  const cardRef  = useRef<HTMLDivElement>(null);

  // Roll is stored in a ref so it never changes after Open (no duplicate rolls).
  const rewardRef  = useRef<ChestReward | null>(null);
  const claimedRef = useRef(false);

  // Reset everything whenever the modal (re)opens.
  useEffect(() => {
    if (!isOpen) return;
    setPhase('idle');
    setReward(null);
    rewardRef.current = null;
    claimedRef.current = false;
    // Restore chest transforms in case it was animated previously.
    if (chestRef.current) gsap.set(chestRef.current, { x: 0, scale: 1 });
    if (lidRef.current) gsap.set(lidRef.current, { rotateX: 0, y: 0 });
    if (burstRef.current) gsap.set(burstRef.current, { opacity: 0, scale: 0.3 });
  }, [isOpen]);

  // ── Idle: soft pulse on the closed chest ────────────────────────────────────
  useEffect(() => {
    if (!isOpen || phase !== 'idle' || !chestRef.current) return;
    const tween = gsap.to(chestRef.current, {
      scale: 1.04,
      duration: 0.9,
      ease: 'sine.inOut',
      yoyo: true,
      repeat: -1,
    });
    return () => { tween.kill(); };
  }, [isOpen, phase]);

  // ── Opening: shake → lid opens → gold burst → particles → reveal ───────────
  useEffect(() => {
    if (phase !== 'opening') return;
    const chest = chestRef.current;
    const lid = lidRef.current;
    const burst = burstRef.current;

    const toReveal = () => {
      // Particles fly out from the chest center.
      if (chest) {
        const r = chest.getBoundingClientRect();
        spawnMosaicShards(r.left + r.width / 2, r.top + r.height / 2);
      }
      audioManager.play('hint');          // reward sparkle sound
      hapticsManager.trigger('success');  // reward haptic
      setReward(rewardRef.current);
      setPhase('reveal');
    };

    if (!chest) { toReveal(); return; }

    let tl: ReturnType<typeof gsap.timeline> | null = null;
    try {
      gsap.killTweensOf(chest);
      gsap.set(chest, { scale: 1, x: 0 }); // clear any leftover idle-pulse scale
      tl = gsap.timeline({ onComplete: toReveal });
      // Shake (0 → ~0.5s)
      tl.to(chest, { x: -6, duration: 0.05, repeat: 7, yoyo: true, ease: 'power1.inOut' }, 0);
      tl.set(chest, { x: 0 }, 0.45);
      // Lid swings open (0.45 → ~0.95s)
      if (lid) {
        tl.to(lid, {
          rotateX: -125,
          y: -3,
          duration: 0.5,
          ease: 'back.out(1.5)',
          transformOrigin: 'center top',
          transformPerspective: 600,
        }, 0.45);
      }
      // Gold light burst (0.55 → 1.2s)
      if (burst) {
        tl.fromTo(
          burst,
          { opacity: 0, scale: 0.3 },
          { opacity: 0.9, scale: 2.3, duration: 0.32, ease: 'power2.out' },
          0.55,
        );
        tl.to(burst, { opacity: 0, duration: 0.5, ease: 'power2.in' }, 0.72);
      }
      // Pad the timeline to the full chestOpen duration.
      tl.to({}, { duration: Math.max(0.01, TIMINGS.chestOpen - 1.1) });
    } catch {
      toReveal();
    }

    return () => { tl?.kill(); };
  }, [phase]);

  // ── Reveal: reward card scales in 0 → 1.1 → 1 with a glow pulse ─────────────
  useEffect(() => {
    if (phase !== 'reveal' || !cardRef.current) return;
    const el = cardRef.current;
    let tl: ReturnType<typeof gsap.timeline> | null = null;
    try {
      tl = gsap.timeline();
      tl.fromTo(
        el,
        { scale: 0, opacity: 0 },
        { scale: 1.1, opacity: 1, duration: TIMINGS.chestReveal * 0.7, ease: 'back.out(2)' },
      ).to(el, { scale: 1, duration: TIMINGS.chestReveal * 0.3, ease: 'power2.out' });
      // Gentle glow pulse loop.
      tl.to(el, {
        boxShadow: '0 0 40px rgba(212,175,55,0.65), 0 0 0 1px rgba(212,175,55,0.4) inset',
        duration: 0.8,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1,
      });
    } catch { /* card already visible via fallback below */ }
    return () => { tl?.kill(); };
  }, [phase, reward]);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleOpen = () => {
    if (phase !== 'idle') return;
    rewardRef.current = rollChestReward(); // rolled once, frozen
    audioManager.play('click');            // chest open sound
    hapticsManager.trigger('medium');
    setPhase('opening');
  };

  const handleClaim = () => {
    if (claimedRef.current) return; // no double-claim
    claimedRef.current = true;
    if (rewardRef.current) applyChestReward(rewardRef.current);
    onClose();
  };

  const handleSkip = () => {
    // Fail-safe: straight to the win scene, no reward applied.
    onClose();
  };

  const title = phase === 'reveal' ? 'Your Reward' : 'A Reward Awaits';

  return (
    <Modal isOpen={isOpen} title={title} locked>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
        {phase !== 'reveal' ? (
          // ── Chest graphic ──────────────────────────────────────────────────
          <div
            ref={chestRef}
            style={{
              position: 'relative',
              width: 130,
              height: 108,
              margin: '8px auto 0',
              transformOrigin: 'center center',
            }}
          >
            {/* Gold light burst (behind the chest) */}
            <div
              ref={burstRef}
              aria-hidden
              style={{
                position: 'absolute',
                left: '50%',
                top: '40%',
                width: 160,
                height: 160,
                transform: 'translate(-50%, -50%)',
                borderRadius: '50%',
                background:
                  'radial-gradient(circle, rgba(255,245,200,0.95) 0%, rgba(212,175,55,0.8) 30%, rgba(212,175,55,0.25) 60%, transparent 78%)',
                opacity: 0,
                pointerEvents: 'none',
              }}
            />

            {/* Lid */}
            <div
              ref={lidRef}
              style={{
                position: 'absolute',
                top: 8,
                left: 5,
                width: 120,
                height: 40,
                borderRadius: '12px 12px 4px 4px',
                background: `linear-gradient(180deg, ${COLORS.gold} 0%, ${COLORS.darkGold} 100%)`,
                border: `2px solid ${COLORS.darkGold}`,
                boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.4)',
                transformOrigin: 'center top',
              }}
            >
              {/* Lid band */}
              <div
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: 0,
                  width: 14,
                  height: '100%',
                  transform: 'translateX(-50%)',
                  background: 'rgba(123,63,0,0.55)',
                }}
              />
            </div>

            {/* Body */}
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                left: 5,
                width: 120,
                height: 64,
                borderRadius: '4px 4px 10px 10px',
                background: `linear-gradient(180deg, ${COLORS.sandstone} 0%, ${COLORS.brick} 100%)`,
                border: `2px solid ${COLORS.darkGold}`,
                boxShadow: 'inset 0 -3px 6px rgba(0,0,0,0.35)',
              }}
            >
              {/* Vertical band */}
              <div
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: 0,
                  width: 14,
                  height: '100%',
                  transform: 'translateX(-50%)',
                  background: 'rgba(123,63,0,0.5)',
                }}
              />
              {/* Lock plate */}
              <div
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: -6,
                  width: 22,
                  height: 24,
                  transform: 'translateX(-50%)',
                  borderRadius: '4px',
                  background: `linear-gradient(180deg, ${COLORS.gold}, ${COLORS.darkGold})`,
                  border: `1.5px solid ${COLORS.brick}`,
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    left: '50%',
                    top: 8,
                    width: 5,
                    height: 5,
                    transform: 'translateX(-50%)',
                    borderRadius: '50%',
                    background: COLORS.brick,
                  }}
                />
              </div>
            </div>
          </div>
        ) : (
          // ── Reward card ────────────────────────────────────────────────────
          reward && (
            <div
              ref={cardRef}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '10px',
                padding: '22px 30px',
                borderRadius: '6px',
                background: 'linear-gradient(180deg, rgba(40,24,5,0.95), rgba(24,14,2,0.98))',
                border: `1px solid rgba(212,175,55,0.45)`,
                boxShadow: '0 0 24px rgba(212,175,55,0.4)',
              }}
            >
              <span
                style={{
                  fontSize: '44px',
                  lineHeight: 1,
                  color: reward.type === 'heart' ? '#CC2200' : COLORS.gold,
                  textShadow: '0 0 18px rgba(212,175,55,0.7)',
                }}
              >
                {rewardGlyph(reward)}
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '20px',
                  fontWeight: 700,
                  letterSpacing: '2px',
                  color: COLORS.ivory,
                  textAlign: 'center',
                }}
              >
                {reward.label}
              </span>
            </div>
          )
        )}

        {/* ── Buttons ────────────────────────────────────────────────────────── */}
        {phase === 'idle' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
            <PrimaryButton size="md" fullWidth onClick={handleOpen}>
              ✦ &nbsp; Open Chest
            </PrimaryButton>
            <SecondaryButton size="md" fullWidth onClick={handleSkip}>
              Skip
            </SecondaryButton>
          </div>
        )}

        {phase === 'reveal' && (
          <PrimaryButton size="md" fullWidth onClick={handleClaim}>
            ✓ &nbsp; Claim
          </PrimaryButton>
        )}
      </div>
    </Modal>
  );
}
