import { useEffect, useRef } from 'react';
import { gsap } from '@/lib/gsap';
import { TIMINGS, COLORS } from '@/constants';
import { GameLogo } from '@/components/ui/GameLogo';
import { useUIStore } from '@/store/uiStore';

export function SplashScreen() {
  const containerRef = useRef<HTMLDivElement>(null);
  const glowRingRef  = useRef<HTMLDivElement>(null);
  const starRef      = useRef<HTMLDivElement>(null);
  const titleRef     = useRef<HTMLDivElement>(null);
  const subtitleRef  = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Advance to welcome — idempotent, fires from whichever path wins.
    let advanced = false;
    const advance = () => {
      if (advanced) return;
      advanced = true;
      useUIStore.getState().setScene('welcome');
    };

    // Guaranteed fallback: never let the splash soft-lock, even if GSAP's
    // onComplete never fires (animation failure, tab throttling, etc.).
    const fallbackTimer = window.setTimeout(advance, 4000);

    let tl: ReturnType<typeof gsap.timeline> | null = null;

    try {
      // Set start states
      gsap.set([starRef.current, titleRef.current, subtitleRef.current], {
        opacity: 0,
        y: 16,
      });
      gsap.set(glowRingRef.current, { opacity: 0, scale: 0.6 });

      tl = gsap.timeline({ onComplete: advance });

      tl
        // 1. Glow ring expands
        .to(glowRingRef.current, {
          opacity: 1,
          scale: 1,
          duration: TIMINGS.splashGlowIn,
          ease: 'power3.out',
        })
        // 2. Star materializes
        .to(
          starRef.current,
          { opacity: 1, y: 0, duration: TIMINGS.splashLogoIn, ease: 'power3.out' },
          '-=0.4',
        )
        // 3. Title fades up
        .to(
          titleRef.current,
          { opacity: 1, y: 0, duration: TIMINGS.splashSubtitleIn, ease: 'power2.out' },
          '-=0.25',
        )
        // 4. Subtitle fades up
        .to(
          subtitleRef.current,
          { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' },
          '-=0.1',
        )
        // 5. Glow pulse
        .to(glowRingRef.current, {
          scale: 1.12,
          opacity: 0.7,
          duration: TIMINGS.splashHold / 2,
          ease: 'sine.inOut',
          yoyo: true,
          repeat: 1,
        })
        // 6. Hold a beat then fade out everything
        .to(containerRef.current, {
          opacity: 0,
          duration: TIMINGS.splashOut,
          ease: 'power2.in',
          delay: 0.15,
        });
    } catch (err) {
      // GSAP failed — force all content visible so the splash is never blank,
      // then advance shortly after so the user is never stuck.
      // eslint-disable-next-line no-console
      console.warn('[splash] GSAP animation failed — showing static splash.', err);
      [glowRingRef, starRef, titleRef, subtitleRef].forEach((r) => {
        if (r.current) {
          r.current.style.opacity = '1';
          r.current.style.transform = 'none';
        }
      });
      window.setTimeout(advance, 1500);
    }

    return () => {
      window.clearTimeout(fallbackTimer);
      tl?.kill();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#1a0f00',
        zIndex: 100,
        overflow: 'hidden',
      }}
    >
      {/* Ambient radial glow */}
      <div
        ref={glowRingRef}
        style={{
          position: 'absolute',
          width: '280px',
          height: '280px',
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(212,175,55,0.18) 0%, rgba(212,175,55,0.06) 45%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      {/* Timurid star emblem */}
      <div ref={starRef} style={{ marginBottom: '28px', position: 'relative', zIndex: 1 }}>
        <GameLogo size={220} />
      </div>

      {/* Title */}
      <div ref={titleRef} style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(22px, 6vw, 30px)',
            fontWeight: 700,
            letterSpacing: '6px',
            textTransform: 'uppercase',
            color: COLORS.gold,
            lineHeight: 1.1,
            textShadow: `0 0 30px rgba(212,175,55,0.6)`,
          }}
        >
          Samarkand
        </h1>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(22px, 6vw, 30px)',
            fontWeight: 700,
            letterSpacing: '6px',
            textTransform: 'uppercase',
            color: COLORS.gold,
            lineHeight: 1.1,
            textShadow: `0 0 30px rgba(212,175,55,0.6)`,
          }}
        >
          Mosaic
        </h1>
      </div>

      {/* Subtitle */}
      <div ref={subtitleRef} style={{ marginTop: '16px', zIndex: 1 }}>
        <p
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '10px',
            letterSpacing: '4px',
            textTransform: 'uppercase',
            color: COLORS.sandstone,
            opacity: 0.8,
          }}
        >
          Restore · Discover · Preserve
        </p>
      </div>
    </div>
  );
}
