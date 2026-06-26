import { useEffect, useRef, useState } from 'react';
import { gsap } from '@/lib/gsap';
import { TIMINGS, COLORS } from '@/constants';
import { GameLogo } from '@/components/ui/GameLogo';
import { Modal } from '@/components/modals/Modal';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { useUIStore } from '@/store/uiStore';
import { runBootLoad } from '@/game/loaders/BootLoader';

// Splash doubles as the boot loading screen: it preloads audio, the logo, and
// level-1 art while showing branded progress, then advances to welcome only once
// everything is decoded (so the first play is instant — no blank board).

const MIN_VISIBLE_MS = 1500; // keep the brand moment readable even on fast loads
const HARD_TIMEOUT_MS = 14000; // never soft-lock the splash

export function SplashScreen() {
  const containerRef = useRef<HTMLDivElement>(null);
  const glowRingRef  = useRef<HTMLDivElement>(null);
  const starRef      = useRef<HTMLDivElement>(null);
  const titleRef     = useRef<HTMLDivElement>(null);
  const subtitleRef  = useRef<HTMLDivElement>(null);
  const progressRef  = useRef<HTMLDivElement>(null);

  const [progress, setProgress] = useState(0);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0); // bump to retry boot

  // Smooth progress interpolation — avoids jumps from 0→100 on fast loads.
  const smoothObj = useRef({ val: 0 });

  // ── Boot asset preload ──────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    let advanced = false;
    const startedAt = Date.now();
    smoothObj.current.val = 0;

    const advance = () => {
      if (advanced || cancelled) return;
      advanced = true;
      useUIStore.getState().setScene('welcome');
    };

    const finishWhenSettled = () => {
      // Ensure the bar reaches 100% visually before advancing.
      gsap.to(smoothObj.current, {
        val: 100,
        duration: 0.3,
        ease: 'power2.out',
        onUpdate: () => setProgress(Math.round(smoothObj.current.val)),
        onComplete: () => {
          const wait = Math.max(0, MIN_VISIBLE_MS - (Date.now() - startedAt));
          window.setTimeout(advance, wait);
        },
      });
    };

    // Guaranteed fallback.
    const hardTimer = window.setTimeout(advance, HARD_TIMEOUT_MS);

    setFailed(false);
    setProgress(0);

    runBootLoad((pct) => {
      if (cancelled) return;
      // Animate the bar to the new target — never jump backwards.
      if (pct > smoothObj.current.val) {
        gsap.to(smoothObj.current, {
          val: pct,
          duration: 0.25,
          ease: 'power1.out',
          overwrite: 'auto',
          onUpdate: () => {
            if (!cancelled) {
              const rounded = Math.round(smoothObj.current.val);
              setProgress(rounded);
              useUIStore.getState().setLoadingProgress(rounded);
            }
          },
        });
      }
    })
      .then((res) => {
        if (cancelled) return;
        if (res.ok) finishWhenSettled();
        else setFailed(true);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      window.clearTimeout(hardTimer);
      gsap.killTweensOf(smoothObj.current);
    };
  }, [attempt]);

  // ── Intro animation (visual only — advancement is driven by boot above) ──────
  useEffect(() => {
    let tl: ReturnType<typeof gsap.timeline> | null = null;
    try {
      // NOTE: progressRef is intentionally NOT hidden — the loader bar + status
      // must be visible from the first frame (it is the boot loading UI).
      gsap.set([starRef.current, titleRef.current, subtitleRef.current], {
        opacity: 0,
        y: 16,
      });
      gsap.set(glowRingRef.current, { opacity: 0, scale: 0.6 });

      tl = gsap.timeline();
      tl
        .to(glowRingRef.current, {
          opacity: 1,
          scale: 1,
          duration: TIMINGS.splashGlowIn,
          ease: 'power3.out',
        })
        .to(
          starRef.current,
          { opacity: 1, y: 0, duration: TIMINGS.splashLogoIn, ease: 'power3.out' },
          '-=0.4',
        )
        .to(
          titleRef.current,
          { opacity: 1, y: 0, duration: TIMINGS.splashSubtitleIn, ease: 'power2.out' },
          '-=0.25',
        )
        .to(
          subtitleRef.current,
          { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' },
          '-=0.1',
        )
        // Gentle breathing glow while assets stream in.
        .to(glowRingRef.current, {
          scale: 1.12,
          opacity: 0.7,
          duration: TIMINGS.splashHold / 2,
          ease: 'sine.inOut',
          yoyo: true,
          repeat: -1,
        });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[splash] GSAP animation failed — showing static splash.', err);
      [glowRingRef, starRef, titleRef, subtitleRef, progressRef].forEach((r) => {
        if (r.current) {
          r.current.style.opacity = '1';
          r.current.style.transform = 'none';
        }
      });
    }

    return () => {
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

      {/* Boot progress */}
      <div
        ref={progressRef}
        style={{
          marginTop: '40px',
          width: 'min(260px, 70vw)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '10px',
          zIndex: 1,
        }}
      >
        {/* Track */}
        <div
          style={{
            width: '100%',
            height: '4px',
            borderRadius: '2px',
            background: 'rgba(212,175,55,0.14)',
            overflow: 'hidden',
            boxShadow: 'inset 0 0 0 1px rgba(212,175,55,0.12)',
          }}
        >
          {/* Fill */}
          <div
            style={{
              width: `${progress}%`,
              height: '100%',
              background: `linear-gradient(90deg, ${COLORS.darkGold}, ${COLORS.gold})`,
              boxShadow: '0 0 8px rgba(212,175,55,0.7)',
              transition: 'width 0.25s ease',
            }}
          />
        </div>

        {/* Status + percentage */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '9px',
              letterSpacing: '2px',
              textTransform: 'uppercase',
              color: COLORS.sandstone,
              opacity: 0.7,
            }}
          >
            Preparing Samarkand Mosaic…
          </span>
          <span
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '9px',
              letterSpacing: '1px',
              color: COLORS.gold,
              opacity: 0.85,
            }}
          >
            {progress}%
          </span>
        </div>
      </div>

      {/* Fallback modal — boot assets failed even after a retry */}
      <Modal
        isOpen={failed}
        onClose={() => { /* not dismissable — must retry */ }}
        title="Loading Failed"
        locked
      >
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '12px',
            lineHeight: 1.7,
            color: COLORS.sandstone,
            textAlign: 'center',
            marginBottom: '20px',
          }}
        >
          Some mosaic assets could not be loaded.
          <br />
          Please check your connection and try again.
        </p>
        <PrimaryButton size="md" fullWidth onClick={() => setAttempt((a) => a + 1)}>
          ↺ &nbsp; Retry
        </PrimaryButton>
      </Modal>
    </div>
  );
}
