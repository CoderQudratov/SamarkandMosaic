import { useRef, useCallback } from 'react';
import { gsap } from '@/lib/gsap';
import { TIMINGS } from '@/constants';

const BASE_SHADOW   = '0 4px 24px rgba(212,175,55,0.35), 0 1px 0 rgba(255,255,255,0.15) inset';
const HOVER_SHADOW  = '0 8px 36px rgba(212,175,55,0.6),  0 1px 0 rgba(255,255,255,0.2) inset';

export function useButtonAnimation(disabled = false) {
  const ref = useRef<HTMLButtonElement>(null);

  const onPointerEnter = useCallback(() => {
    if (disabled || !ref.current) return;
    ref.current.style.boxShadow = HOVER_SHADOW;
    gsap.to(ref.current, {
      scale: 1.04,
      duration: TIMINGS.buttonHover,
      ease: 'power2.out',
      overwrite: 'auto',
    });
  }, [disabled]);

  const onPointerLeave = useCallback(() => {
    if (!ref.current) return;
    ref.current.style.boxShadow = BASE_SHADOW;
    gsap.to(ref.current, {
      scale: 1,
      duration: TIMINGS.buttonHover,
      ease: 'power2.out',
      overwrite: 'auto',
    });
  }, []);

  const onPointerDown = useCallback(() => {
    if (disabled || !ref.current) return;
    gsap.to(ref.current, {
      scale: 0.96,
      duration: TIMINGS.buttonPress,
      ease: 'power2.in',
      overwrite: 'auto',
    });
  }, [disabled]);

  const onPointerUp = useCallback(() => {
    if (!ref.current) return;
    gsap.to(ref.current, {
      scale: 1,
      duration: TIMINGS.buttonHover,
      ease: 'back.out(1.5)',
      overwrite: 'auto',
    });
  }, []);

  return {
    ref,
    handlers: {
      onPointerEnter,
      onPointerLeave,
      onPointerDown,
      onPointerUp,
    },
  };
}
