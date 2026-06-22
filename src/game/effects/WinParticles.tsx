import { useEffect, useRef } from 'react';
import { gsap } from '@/lib/gsap';

const COUNT = 60;

// ── Palette ──────────────────────────────────────────────────────────────────
const GOLD_SHADES    = ['#D4AF37', '#F0C040', '#FFD700', '#C8960C', '#E8B820'];
const TURQUOISE      = ['#30D5C8', '#22C5B8', '#3AE5D8', '#20B5A8'];
const BLUE_CERAMIC   = ['#0F52BA', '#1A62CA', '#0A42AA', '#2472DA'];
const IVORY_DUST     = ['#F5E6C8', '#EDD8A0', '#FFF0D0', '#E8D8B8'];

type ParticleType = 'goldShard' | 'turquoiseFrag' | 'blueCeramic' | 'ivoryDust';

interface ParticleConfig {
  type: ParticleType;
  size: number;
  color: string;
  tx: number;
  ty: number;
  rotation: number;
  spinDelta: number;
  duration: number;
  delay: number;
  blur: number;
  opacity: number;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function buildParticles(): ParticleConfig[] {
  const configs: ParticleConfig[] = [];

  for (let i = 0; i < COUNT; i++) {
    // Spread evenly around 360° with randomised jitter
    const baseAngle = (Math.PI * 2 * i) / COUNT;
    const angle = baseAngle + rand(-Math.PI / 5, Math.PI / 5);

    // Strong velocity: primary burst + extra energy for outer ring
    const ring    = i % 3 === 0 ? 1.4 : 1.0; // every 3rd goes extra far
    const dist    = rand(120, 310) * ring;
    const gravity = rand(80, 200);             // downward pull

    const tx = Math.cos(angle) * dist;
    const ty = Math.sin(angle) * dist + gravity;

    // Type distribution: 40% gold, 25% turquoise, 20% blue, 15% ivory
    const roll = Math.random();
    let type: ParticleType;
    let color: string;
    if (roll < 0.40) {
      type  = 'goldShard';
      color = pick(GOLD_SHADES);
    } else if (roll < 0.65) {
      type  = 'turquoiseFrag';
      color = pick(TURQUOISE);
    } else if (roll < 0.85) {
      type  = 'blueCeramic';
      color = pick(BLUE_CERAMIC);
    } else {
      type  = 'ivoryDust';
      color = pick(IVORY_DUST);
    }

    configs.push({
      type,
      size:       rand(8, 26),
      color,
      tx,
      ty,
      rotation:   rand(0, 360),
      spinDelta:  rand(-540, 540),
      duration:   rand(1.4, 2.4),
      delay:      rand(0, 0.18),
      blur:       pick([0, 0, 0, 2, 4]),  // most are sharp, a few are soft
      opacity:    rand(0.82, 1.0),
    });
  }

  return configs;
}

function applyStyle(el: HTMLElement, cfg: ParticleConfig): void {
  const s = el.style;
  s.position   = 'fixed';
  s.left       = '0';
  s.top        = '0';
  s.pointerEvents = 'none';
  s.willChange = 'transform, opacity';
  s.zIndex     = '200';
  if (cfg.blur > 0) s.filter = `blur(${cfg.blur}px)`;

  switch (cfg.type) {
    case 'goldShard': {
      // Tall thin rectangle — like a mosaic tile shard
      const w = rand(2, 5);
      s.width        = `${w}px`;
      s.height       = `${cfg.size}px`;
      s.borderRadius = '1px';
      s.background   = cfg.color;
      s.boxShadow    = `0 0 ${Math.round(w * 3)}px ${cfg.color}99`;
      break;
    }
    case 'turquoiseFrag': {
      // Diamond / rotated square — mosaic fragment
      const side = cfg.size * 0.72;
      s.width      = `${side}px`;
      s.height     = `${side}px`;
      s.background = cfg.color;
      s.borderRadius = '2px';
      // transform rotate is handled by GSAP; add a small static skew for shape variety
      s.boxShadow = `0 2px 8px ${cfg.color}88`;
      break;
    }
    case 'blueCeramic': {
      // Irregular polygon approximated with a rounded rectangle
      const w = cfg.size * rand(0.5, 1.0);
      const h = cfg.size * rand(0.5, 1.0);
      s.width        = `${w}px`;
      s.height       = `${h}px`;
      s.background   = `linear-gradient(135deg, ${cfg.color} 40%, ${cfg.color}99 100%)`;
      s.borderRadius = `${rand(2, 6)}px`;
      s.boxShadow    = `0 1px 4px rgba(0,0,0,0.4)`;
      break;
    }
    case 'ivoryDust': {
      // Soft circle — glowing dust mote
      s.width        = `${cfg.size}px`;
      s.height       = `${cfg.size}px`;
      s.borderRadius = '50%';
      s.background   = `radial-gradient(circle at 35% 35%, white 0%, ${cfg.color} 60%, transparent 100%)`;
      s.boxShadow    = `0 0 ${Math.round(cfg.size * 0.8)}px ${cfg.color}cc`;
      break;
    }
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

interface WinParticlesProps {
  active: boolean;
  originX: number;
  originY: number;
}

export function WinParticles({ active, originX, originY }: WinParticlesProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const firedRef     = useRef(false);

  useEffect(() => {
    if (!active || firedRef.current || !containerRef.current) return;
    firedRef.current = true;

    const container = containerRef.current;
    const elements: HTMLElement[] = [];
    const configs   = buildParticles();

    for (const cfg of configs) {
      const el = document.createElement('div');
      applyStyle(el, cfg);
      container.appendChild(el);
      elements.push(el);

      gsap.set(el, {
        x:        originX,
        y:        originY,
        rotation: cfg.rotation,
        scale:    rand(0.5, 1.0),
        opacity:  cfg.opacity,
      });

      gsap.to(el, {
        x:        originX + cfg.tx,
        y:        originY + cfg.ty,
        rotation: cfg.rotation + cfg.spinDelta,
        opacity:  0,
        scale:    rand(0.05, 0.3),
        duration: cfg.duration,
        ease:     'power1.out',
        delay:    cfg.delay,
      });
    }

    // Sweep cleanup once longest possible animation finishes
    const cleanup = window.setTimeout(() => {
      elements.forEach((el) => {
        gsap.killTweensOf(el);
        el.remove();
      });
    }, 2800);

    return () => {
      window.clearTimeout(cleanup);
      elements.forEach((el) => {
        gsap.killTweensOf(el);
        if (el.parentNode) el.remove();
      });
    };
  }, [active, originX, originY]);

  return (
    <div
      ref={containerRef}
      style={{
        position:      'fixed',
        inset:         0,
        pointerEvents: 'none',
        zIndex:        200,
        overflow:      'hidden',
      }}
    />
  );
}
