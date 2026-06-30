import { useState, useRef, useEffect, useCallback } from 'react';
import { gsap } from '@/lib/gsap';
import { COLORS, TIMINGS } from '@/constants';
import { OrnamentalDivider } from '@/components/ui/OrnamentalDivider';
import { CornerFlourish } from '@/components/ui/CornerFlourish';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { useScreenTransition } from '@/hooks/useScreenTransition';
import { usePlayerStore } from '@/store/playerStore';

export function NameInputScreen() {
  const { containerRef, navigateTo } = useScreenTransition();
  const inputRef  = useRef<HTMLInputElement>(null);
  const wrapRef   = useRef<HTMLDivElement>(null);
  const errorRef  = useRef<HTMLParagraphElement>(null);

  const profile = usePlayerStore((s) => s.profile);
  const [name, setName]   = useState(profile?.displayName ?? '');
  const [error, setError] = useState('');

  // Stagger entrance
  useEffect(() => {
    const children = containerRef.current?.children;
    if (!children) return;
    gsap.fromTo(
      Array.from(children),
      { opacity: 0, y: 14 },
      { opacity: 1, y: 0, duration: 0.4, stagger: 0.08, ease: 'power2.out', delay: 0.05 },
    );
  }, [containerRef]);

  const handleFocus = useCallback(() => {
    if (!wrapRef.current) return;
    gsap.to(wrapRef.current, {
      boxShadow: `0 0 0 1px ${COLORS.gold}, 0 0 20px rgba(212,175,55,0.3)`,
      duration: TIMINGS.inputFocusGlow,
      ease: 'power2.out',
    });
    wrapRef.current.style.borderColor = COLORS.gold;
  }, []);

  const handleBlur = useCallback(() => {
    if (!wrapRef.current) return;
    gsap.to(wrapRef.current, {
      boxShadow: '0 0 0 1px rgba(212,175,55,0.3)',
      duration: TIMINGS.inputFocusGlow,
      ease: 'power2.out',
    });
    wrapRef.current.style.borderColor = 'rgba(212,175,55,0.35)';
  }, []);

  const shakeError = useCallback(() => {
    if (!wrapRef.current) return;
    gsap.fromTo(
      wrapRef.current,
      { x: -6 },
      { x: 0, duration: 0.4, ease: 'elastic.out(1, 0.3)' },
    );
    // Error pulse — red border flash
    wrapRef.current.style.borderColor = '#CC2200';
    setTimeout(() => {
      if (wrapRef.current) wrapRef.current.style.borderColor = 'rgba(212,175,55,0.35)';
    }, 600);
  }, []);

  const handleContinue = useCallback(() => {
    const trimmed = name.trim();

    if (!trimmed) {
      setError('Please enter your name');
      shakeError();
      return;
    }
    if (trimmed.length < 2) {
      setError('Name must be at least 2 characters');
      shakeError();
      return;
    }
    if (trimmed.length > 24) {
      setError('Name must be 24 characters or fewer');
      shakeError();
      return;
    }

    setError('');
    usePlayerStore.getState().setCustomName(trimmed);
    navigateTo('mainMenu');
  }, [name, navigateTo, shakeError]);

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
      }}
    >
      {/* Screen title */}
      <h2
        style={{
          fontFamily: 'var(--font-heading)',
          fontSize: '11px',
          letterSpacing: '5px',
          textTransform: 'uppercase',
          color: COLORS.sandstone,
          opacity: 0.7,
          marginBottom: '8px',
        }}
      >
        Your Name
      </h2>

      <h1
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(18px, 5vw, 24px)',
          fontWeight: 700,
          letterSpacing: '4px',
          color: COLORS.gold,
          marginBottom: '20px',
          textAlign: 'center',
        }}
      >
        Who seeks
        <br />
        the Mosaic?
      </h1>

      <OrnamentalDivider width="160px" />

      {/* Input card */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '320px',
          marginTop: '28px',
          marginBottom: '8px',
          padding: '28px 24px',
          background: 'linear-gradient(180deg, rgba(30,18,4,0.95) 0%, rgba(20,12,2,0.98) 100%)',
          border: '1px solid rgba(212,175,55,0.25)',
          borderRadius: '4px',
        }}
      >
        <CornerFlourish corner="tl" size={16} inset={4} />
        <CornerFlourish corner="tr" size={16} inset={4} />
        <CornerFlourish corner="bl" size={16} inset={4} />
        <CornerFlourish corner="br" size={16} inset={4} />

        {/* Label */}
        <label
          htmlFor="player-name"
          style={{
            display: 'block',
            fontFamily: 'var(--font-heading)',
            fontSize: '9px',
            letterSpacing: '3px',
            textTransform: 'uppercase',
            color: COLORS.sandstone,
            opacity: 0.7,
            marginBottom: '10px',
          }}
        >
          Enter your name
        </label>

        {/* Input wrapper */}
        <div
          ref={wrapRef}
          style={{
            borderRadius: '2px',
            border: '1px solid rgba(212,175,55,0.35)',
            background: 'rgba(212,175,55,0.04)',
            boxShadow: '0 0 0 1px rgba(212,175,55,0.3)',
            transition: 'border-color 0.15s ease',
          }}
        >
          <input
            id="player-name"
            ref={inputRef}
            type="text"
            value={name}
            maxLength={24}
            autoComplete="off"
            spellCheck={false}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onChange={(e) => {
              setName(e.target.value);
              if (error) setError('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleContinue();
            }}
            placeholder="e.g. Tamerlane"
            style={{
              display: 'block',
              width: '100%',
              padding: '12px 14px',
              fontFamily: 'var(--font-heading)',
              fontSize: '15px',
              fontWeight: 600,
              letterSpacing: '2px',
              color: COLORS.ivory,
              caretColor: COLORS.gold,
              background: 'transparent',
            }}
          />
        </div>

        {/* Character count */}
        <p
          style={{
            marginTop: '6px',
            fontFamily: 'var(--font-body)',
            fontSize: '9px',
            letterSpacing: '1.5px',
            color: COLORS.sandstone,
            opacity: 0.4,
            textAlign: 'right',
          }}
        >
          {name.trim().length} / 24
        </p>
      </div>

      {/* Error message */}
      <p
        ref={errorRef}
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: '10px',
          letterSpacing: '1px',
          color: '#CC2200',
          opacity: error ? 1 : 0,
          height: '16px',
          marginBottom: '24px',
          transition: 'opacity 0.2s ease',
        }}
      >
        {error || ' '}
      </p>

      <PrimaryButton
        size="md"
        fullWidth
        onClick={handleContinue}
        disabled={name.trim().length === 0}
        style={{ maxWidth: '320px' }}
      >
        Continue
      </PrimaryButton>
    </div>
  );
}
