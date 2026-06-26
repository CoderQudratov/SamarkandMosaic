import { gsap } from '@/lib/gsap';
import { TIMINGS } from '@/constants';
import type { Rect } from '@/game/utils/geometry';

// sandstone, light-red (softer than error red), ivory
const DUST_COLORS = ['#D2B48C', '#CC6655', '#F8F1E5'] as const;

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/**
 * Fires all wrong-drop FX at the given viewport-coordinate piece rect.
 * All DOM elements self-remove via GSAP onComplete — no leaks.
 */
export function triggerWrongFX(rect: Rect): void {
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const size = Math.max(rect.width, rect.height);

  // ── 1. Wrong slot pulse — soft red radial burst at the drop zone ───────────
  const pulse = document.createElement('div');
  Object.assign(pulse.style, {
    position: 'fixed',
    left: `${cx}px`,
    top: `${cy}px`,
    width: `${size * 1.8}px`,
    height: `${size * 1.8}px`,
    borderRadius: '50%',
    background:
      'radial-gradient(circle, rgba(204,34,0,0.65) 0%, rgba(204,34,0,0.28) 45%, transparent 70%)',
    pointerEvents: 'none',
    zIndex: '49',
  });
  document.body.appendChild(pulse);
  gsap.set(pulse, { xPercent: -50, yPercent: -50, scale: 0.9, opacity: 0.6 });
  gsap.to(pulse, {
    scale: 1.3,
    opacity: 0,
    duration: TIMINGS.wrongPulse,
    ease: 'power2.out',
    onComplete: () => pulse.remove(),
  });

  // ── 4. Soft red glow — piece border 0 → 1 → 0 ─────────────────────────────
  const redGlow = document.createElement('div');
  Object.assign(redGlow.style, {
    position: 'fixed',
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    border: '2px solid rgba(204,34,0,0.75)',
    boxShadow:
      '0 0 14px rgba(204,34,0,0.8), 0 0 28px rgba(204,34,0,0.35), inset 0 0 8px rgba(204,34,0,0.2)',
    borderRadius: '3px',
    pointerEvents: 'none',
    zIndex: '51',
  });
  document.body.appendChild(redGlow);
  gsap.set(redGlow, { opacity: 0 });
  gsap
    .timeline({ onComplete: () => redGlow.remove() })
    .to(redGlow, {
      opacity: 1,
      duration: TIMINGS.wrongRedGlow * 0.5,
      ease: 'power2.out',
    })
    .to(redGlow, {
      opacity: 0,
      duration: TIMINGS.wrongRedGlow * 0.5,
      ease: 'power2.in',
    });

  // ── 3. Crack dust — 5–8 small particles, fast fade ────────────────────────
  const count = Math.round(rand(5, 8));
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + rand(-0.5, 0.5);
    const dist = rand(10, 38);
    const pSize = rand(2, 5);
    const color = DUST_COLORS[Math.floor(Math.random() * DUST_COLORS.length)];
    const isRound = Math.random() > 0.45;
    const duration = rand(TIMINGS.wrongDust * 0.6, TIMINGS.wrongDust);
    const delay = rand(0, 0.04);

    const p = document.createElement('div');
    Object.assign(p.style, {
      position: 'fixed',
      left: `${cx}px`,
      top: `${cy}px`,
      width: `${pSize}px`,
      height: `${pSize}px`,
      borderRadius: isRound ? '50%' : '1px',
      background: color,
      pointerEvents: 'none',
      zIndex: '52',
    });
    document.body.appendChild(p);
    gsap.set(p, { xPercent: -50, yPercent: -50, opacity: 0.88 });
    gsap.to(p, {
      x: Math.cos(angle) * dist,
      y: Math.sin(angle) * dist + rand(4, 14),
      opacity: 0,
      scale: rand(0.1, 0.4),
      duration,
      delay,
      ease: 'power2.out',
      onComplete: () => p.remove(),
    });
  }
}
