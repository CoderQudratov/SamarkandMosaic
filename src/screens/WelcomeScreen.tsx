import { useRef, useEffect } from 'react';
import { gsap } from '@/lib/gsap';
import { COLORS } from '@/constants';
import { TimuridStar } from '@/components/ui/TimuridStar';
import { OrnamentalDivider } from '@/components/ui/OrnamentalDivider';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { useScreenTransition } from '@/hooks/useScreenTransition';
import { usePlayerStore } from '@/store/playerStore';

export function WelcomeScreen() {
  const { containerRef, navigateTo } = useScreenTransition();

  const emblemRef   = useRef<HTMLDivElement>(null);
  const titleRef    = useRef<HTMLDivElement>(null);
  const dividerRef  = useRef<HTMLDivElement>(null);
  const subtitleRef = useRef<HTMLDivElement>(null);
  const buttonRef   = useRef<HTMLDivElement>(null);

  // Stagger the content entrance so each element feels handcrafted
  useEffect(() => {
    const elements = [emblemRef, titleRef, dividerRef, subtitleRef, buttonRef];
    gsap.set(elements.map((r) => r.current), { opacity: 0, y: 20 });

    gsap.to(
      elements.map((r) => r.current),
      {
        opacity: 1,
        y: 0,
        duration: 0.5,
        ease: 'power2.out',
        stagger: 0.1,
        delay: 0.1,
      },
    );
  }, []);

  const handleStart = () => {
    // Skip name input if player already has a custom name
    const hasName = !!usePlayerStore.getState().customName;
    navigateTo(hasName ? 'mainMenu' : 'nameInput');
  };

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
        padding: '32px 28px',
        gap: '0',
        overflow: 'hidden',
      }}
    >
      {/* Ambient background gradient */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: '10%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '320px',
          height: '320px',
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(212,175,55,0.09) 0%, transparent 65%)',
          pointerEvents: 'none',
        }}
      />

      {/* Emblem */}
      <div
        ref={emblemRef}
        style={{
          animation: 'floatY 4s ease-in-out infinite',
          marginBottom: '28px',
        }}
      >
        <TimuridStar size={72} glowing />
      </div>

      {/* Main title */}
      <div ref={titleRef} style={{ textAlign: 'center', marginBottom: '16px' }}>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(20px, 5.5vw, 28px)',
            fontWeight: 700,
            letterSpacing: '5px',
            textTransform: 'uppercase',
            color: COLORS.gold,
            lineHeight: 1.15,
            textShadow: '0 0 24px rgba(212,175,55,0.5)',
          }}
        >
          Samarkand
          <br />
          Mosaic
        </h1>
      </div>

      {/* Divider */}
      <div ref={dividerRef} style={{ marginBottom: '16px' }}>
        <OrnamentalDivider width="180px" />
      </div>

      {/* Subtitle */}
      <div ref={subtitleRef} style={{ textAlign: 'center', marginBottom: '40px', maxWidth: '280px' }}>
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '12px',
            lineHeight: 1.7,
            letterSpacing: '1px',
            color: COLORS.sandstone,
            opacity: 0.85,
          }}
        >
          Restore ancient mosaics of Samarkand.
          <br />
          Each piece holds a thousand years of beauty.
        </p>
      </div>

      {/* CTA button */}
      <div ref={buttonRef}>
        <PrimaryButton size="lg" onClick={handleStart}>
          Start Journey
        </PrimaryButton>
      </div>

      {/* Tagline */}
      <p
        style={{
          position: 'absolute',
          bottom: '32px',
          fontFamily: 'var(--font-body)',
          fontSize: '9px',
          letterSpacing: '3px',
          textTransform: 'uppercase',
          color: COLORS.ivory,
          opacity: 0.25,
        }}
      >
        Timeless · Royal · Restored
      </p>
    </div>
  );
}
