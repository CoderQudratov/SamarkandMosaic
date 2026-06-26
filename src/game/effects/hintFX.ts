import { gsap } from '@/lib/gsap';
import { COLORS, TIMINGS } from '@/constants';

const HINT_COLORS = [COLORS.gold, COLORS.timurBlue, COLORS.ivory] as const;

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export interface BoardRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Spawns 12–18 magical particles that rise upward from within the board area.
 * All DOM elements self-remove via GSAP onComplete — no leaks.
 */
export function spawnHintParticles(boardRect: BoardRect): void {
  const count = Math.round(rand(12, 18));

  for (let i = 0; i < count; i++) {
    const startX = boardRect.left + rand(0.12, 0.88) * boardRect.width;
    const startY = boardRect.top + rand(0.3, 0.92) * boardRect.height;
    const pSize = rand(3, 8);
    const color = HINT_COLORS[Math.floor(Math.random() * HINT_COLORS.length)];
    const duration = rand(TIMINGS.hintParticle * 0.6, TIMINGS.hintParticle);
    const delay = rand(0, 0.45);
    const tx = rand(-38, 38);
    const ty = -(rand(50, 115));

    const p = document.createElement('div');
    Object.assign(p.style, {
      position: 'fixed',
      left: `${startX}px`,
      top: `${startY}px`,
      width: `${pSize}px`,
      height: `${pSize}px`,
      borderRadius: '50%',
      background: color,
      pointerEvents: 'none',
      zIndex: '60',
    });
    document.body.appendChild(p);
    gsap.set(p, { xPercent: -50, yPercent: -50, opacity: 0, scale: rand(0.6, 1.2) });

    // Fade in quickly, then drift up and fade out
    gsap
      .timeline({ delay, onComplete: () => p.remove() })
      .to(p, { opacity: rand(0.55, 0.95), duration: duration * 0.22, ease: 'power2.out' })
      .to(p, {
        x: tx,
        y: ty,
        opacity: 0,
        scale: rand(0.1, 0.45),
        duration: duration * 0.78,
        ease: 'power1.out',
      });
  }
}
