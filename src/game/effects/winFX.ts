import { gsap } from '@/lib/gsap';
import { COLORS, TIMINGS } from '@/constants';

// ── Palettes ──────────────────────────────────────────────────────────────────

const CONFETTI_COLORS = [
  COLORS.gold, '#F0C040', '#FFD700',
  '#1F5FA8', '#2472DA',
  '#30D5C8', '#3AE5D8', '#22C5B8',
  COLORS.ivory, '#FFF0D0',
];

const SHARD_COLORS = [
  '#D4AF37', '#F0C040', '#E8B820',
  '#30D5C8', '#22C5B8',
  '#D2B48C', '#F8F1E5',
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── 2. Confetti rain ─────────────────────────────────────────────────────────

export function spawnWinConfetti(): void {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const count = 42;

  for (let i = 0; i < count; i++) {
    const isRect  = Math.random() > 0.38;
    const w       = isRect ? rand(4, 9) : rand(7, 13);
    const h       = isRect ? rand(10, 20) : rand(7, 13);
    const color   = pick(CONFETTI_COLORS);
    const startX  = rand(0, W);
    const delay   = rand(0, 1.0);
    const duration = rand(TIMINGS.winConfetti * 0.68, TIMINGS.winConfetti);
    const xDrift  = rand(-50, 50);
    const spin    = rand(-600, 600);

    const p = document.createElement('div');
    Object.assign(p.style, {
      position: 'fixed',
      left: `${startX}px`,
      top: '-24px',
      width: `${w}px`,
      height: `${h}px`,
      borderRadius: isRect ? '1px' : `${rand(1, 4)}px`,
      background: color,
      pointerEvents: 'none',
      zIndex: '200',
    });
    document.body.appendChild(p);
    gsap.set(p, { opacity: rand(0.65, 1), rotation: rand(0, 360) });
    gsap.to(p, {
      y: H + 36,
      x: xDrift,
      rotation: `+=${spin}`,
      opacity: 0,
      duration,
      delay,
      ease: 'none',
      onComplete: () => p.remove(),
    });
  }
}

// ── 4. Mosaic shard explosion ─────────────────────────────────────────────────

export function spawnMosaicShards(originX: number, originY: number): void {
  const count = 20;

  for (let i = 0; i < count; i++) {
    const angle   = (i / count) * Math.PI * 2 + rand(-0.45, 0.45);
    const dist    = rand(70, 210);
    const gravity = rand(140, 320);
    const tx      = Math.cos(angle) * dist;
    const ty      = Math.sin(angle) * dist + gravity;
    const size    = rand(4, 15);
    const isSlim  = Math.random() > 0.5;
    const spin    = rand(-720, 720);
    const color   = pick(SHARD_COLORS);
    const duration = rand(TIMINGS.winShard * 0.65, TIMINGS.winShard);

    const p = document.createElement('div');
    Object.assign(p.style, {
      position: 'fixed',
      left: `${originX}px`,
      top: `${originY}px`,
      width: isSlim ? `${rand(2, 5)}px` : `${size}px`,
      height: isSlim ? `${size}px` : `${size * rand(0.5, 1.0)}px`,
      borderRadius: isSlim ? '1px' : `${rand(1, 3)}px`,
      background: color,
      boxShadow: `0 0 ${Math.round(size * 0.6)}px ${color}99`,
      pointerEvents: 'none',
      zIndex: '199',
    });
    document.body.appendChild(p);
    gsap.set(p, {
      xPercent: -50,
      yPercent: -50,
      opacity: rand(0.8, 1),
      rotation: rand(0, 360),
    });
    gsap.to(p, {
      x: tx,
      y: ty,
      rotation: `+=${spin}`,
      opacity: 0,
      scale: rand(0.05, 0.28),
      duration,
      delay: rand(0, 0.1),
      ease: 'power2.out',
      onComplete: () => p.remove(),
    });
  }
}

// ── 5. Screen edge flash ──────────────────────────────────────────────────────

export function spawnScreenEdgeFlash(): void {
  const flash = document.createElement('div');
  Object.assign(flash.style, {
    position: 'fixed',
    inset: '0',
    background:
      'radial-gradient(ellipse at 50% 50%, transparent 28%, rgba(212,175,55,0.38) 100%)',
    pointerEvents: 'none',
    zIndex: '198',
  });
  document.body.appendChild(flash);
  gsap.set(flash, { opacity: 1 });
  gsap.to(flash, {
    opacity: 0,
    duration: TIMINGS.winEdgeFlash,
    ease: 'power2.out',
    onComplete: () => flash.remove(),
  });
}

// ── 6. Coin sparkles ──────────────────────────────────────────────────────────

export function spawnCoinSparkles(): void {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const count = 12;

  for (let i = 0; i < count; i++) {
    const x = rand(W * 0.06, W * 0.94);
    const y = rand(H * 0.08, H * 0.78);
    const size = rand(5, 12);
    const delay = rand(0, 0.9);
    const lifetime = rand(TIMINGS.winSparkle * 0.55, TIMINGS.winSparkle);
    const floatUp = rand(18, 48);

    const p = document.createElement('div');
    Object.assign(p.style, {
      position: 'fixed',
      left: `${x}px`,
      top: `${y}px`,
      width: `${size}px`,
      height: `${size}px`,
      background: COLORS.gold,
      boxShadow: `0 0 ${Math.round(size * 1.6)}px ${Math.round(size * 0.9)}px rgba(212,175,55,0.65)`,
      transform: 'rotate(45deg)',
      pointerEvents: 'none',
      zIndex: '201',
    });
    document.body.appendChild(p);
    gsap.set(p, { xPercent: -50, yPercent: -50, opacity: 0, scale: 0.25 });

    // Phase 1: burst in + start rising
    // Phase 2: fade out while still rising
    gsap
      .timeline({ delay, onComplete: () => p.remove() })
      .to(p, {
        opacity: rand(0.75, 1.0),
        scale: 1,
        y: -(floatUp * 0.4),
        duration: lifetime * 0.3,
        ease: 'power2.out',
      })
      .to(p, {
        opacity: 0,
        scale: 0.2,
        y: -floatUp,
        duration: lifetime * 0.7,
        ease: 'power1.in',
      });
  }
}
