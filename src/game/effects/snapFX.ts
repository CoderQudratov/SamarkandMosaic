import { gsap } from '@/lib/gsap';
import { COLORS, TIMINGS } from '@/constants';
import type { Rect } from '@/game/utils/geometry';

const DUST_COLORS = [COLORS.gold, COLORS.timurBlue, COLORS.ivory] as const;

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/**
 * Fires all five snap FX at the given viewport-coordinate slot rect.
 * All DOM elements are self-removing via GSAP onComplete — no leaks.
 */
export function triggerSnapFX(slot: Rect): void {
  const cx = slot.left + slot.width / 2;
  const cy = slot.top + slot.height / 2;
  const size = Math.max(slot.width, slot.height);

  // ── 1. Golden flash — radial burst spawned behind the piece ────────────────
  const flash = document.createElement('div');
  Object.assign(flash.style, {
    position: 'fixed',
    left: `${cx}px`,
    top: `${cy}px`,
    width: `${size * 2.2}px`,
    height: `${size * 2.2}px`,
    borderRadius: '50%',
    background:
      'radial-gradient(circle, rgba(212,175,55,0.95) 0%, rgba(212,175,55,0.5) 35%, rgba(212,175,55,0.1) 65%, transparent 80%)',
    pointerEvents: 'none',
    zIndex: '49',
  });
  document.body.appendChild(flash);
  gsap.set(flash, { xPercent: -50, yPercent: -50, scale: 0.7, opacity: 0.8 });
  gsap.to(flash, {
    scale: 1.6,
    opacity: 0,
    duration: TIMINGS.snapGlow,
    ease: 'power2.out',
    onComplete: () => flash.remove(),
  });

  // ── 2. Glow pulse — piece border lights up gold then fades ─────────────────
  const glowBorder = document.createElement('div');
  Object.assign(glowBorder.style, {
    position: 'fixed',
    left: `${slot.left}px`,
    top: `${slot.top}px`,
    width: `${slot.width}px`,
    height: `${slot.height}px`,
    border: `2px solid ${COLORS.gold}`,
    boxShadow: `0 0 18px rgba(212,175,55,0.9), 0 0 36px rgba(212,175,55,0.45), inset 0 0 10px rgba(212,175,55,0.3)`,
    borderRadius: '3px',
    pointerEvents: 'none',
    zIndex: '51',
  });
  document.body.appendChild(glowBorder);
  gsap.set(glowBorder, { opacity: 0 });
  gsap
    .timeline({ onComplete: () => glowBorder.remove() })
    .to(glowBorder, {
      opacity: 1,
      duration: TIMINGS.snapGlowPulse * 0.5,
      ease: 'power2.out',
    })
    .to(glowBorder, {
      opacity: 0,
      duration: TIMINGS.snapGlowPulse * 0.5,
      ease: 'power2.in',
    });

  // ── 3. Ceramic dust — 8–12 particles, outward burst with slight gravity ─────
  const count = Math.round(rand(8, 12));
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + rand(-0.45, 0.45);
    const dist = rand(18, 58);
    const pSize = rand(3, 7);
    const color = DUST_COLORS[Math.floor(Math.random() * DUST_COLORS.length)];
    const duration = rand(TIMINGS.snapDust * 0.65, TIMINGS.snapDust);
    const delay = rand(0, 0.055);

    const particle = document.createElement('div');
    Object.assign(particle.style, {
      position: 'fixed',
      left: `${cx}px`,
      top: `${cy}px`,
      width: `${pSize}px`,
      height: `${pSize}px`,
      borderRadius: '50%',
      background: color,
      pointerEvents: 'none',
      zIndex: '52',
    });
    document.body.appendChild(particle);
    gsap.set(particle, { xPercent: -50, yPercent: -50, opacity: 0.92 });
    gsap.to(particle, {
      x: Math.cos(angle) * dist,
      y: Math.sin(angle) * dist + rand(10, 26),
      opacity: 0,
      scale: rand(0.2, 0.55),
      duration,
      delay,
      ease: 'power2.out',
      onComplete: () => particle.remove(),
    });
  }
}
