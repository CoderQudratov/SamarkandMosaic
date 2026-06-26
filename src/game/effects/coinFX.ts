import { gsap } from '@/lib/gsap';
import { COLORS, TIMINGS } from '@/constants';

// Floating "+N" coin reward text. DOM-only, self-removing — same pattern as the
// other FX modules. Rises upward, fades out, with a brief scale pulse.
export function spawnCoinReward(amount: number, x: number, y: number): void {
  if (amount <= 0) return;

  const el = document.createElement('div');
  el.textContent = `+${amount}`;
  Object.assign(el.style, {
    position: 'fixed',
    left: `${x}px`,
    top: `${y}px`,
    fontFamily: 'var(--font-display)',
    fontWeight: '700',
    fontSize: `${Math.min(34, 16 + amount * 0.4)}px`,
    letterSpacing: '1px',
    color: COLORS.gold,
    textShadow: '0 2px 8px rgba(0,0,0,0.55), 0 0 14px rgba(212,175,55,0.7)',
    pointerEvents: 'none',
    zIndex: '210',
    whiteSpace: 'nowrap',
  });
  document.body.appendChild(el);

  gsap.set(el, { xPercent: -50, yPercent: -50, opacity: 0, scale: 0.6 });

  // All tweens are positioned absolutely on one timeline so the full lifetime is
  // exactly coinFloat (0.8s): rise spans the whole time; a scale pulse plays at
  // the start; the fade runs over the back half.
  const D = TIMINGS.coinFloat;
  gsap
    .timeline({ onComplete: () => el.remove() })
    .to(el, { y: '-=58', duration: D, ease: 'power1.out' }, 0)
    .to(el, { opacity: 1, scale: 1.15, duration: D * 0.275, ease: 'back.out(2.5)' }, 0)
    .to(el, { scale: 1, duration: D * 0.175, ease: 'power2.out' }, D * 0.275)
    .to(el, { opacity: 0, duration: D * 0.45, ease: 'power1.in' }, D * 0.55);
}
