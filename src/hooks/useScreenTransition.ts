import { useEffect, useCallback, useRef } from 'react';
import { gsap } from '@/lib/gsap';
import { TIMINGS } from '@/constants';
import { useUIStore } from '@/store/uiStore';
import type { SceneKey } from '@/game/types';

export function useScreenTransition() {
  const containerRef = useRef<HTMLDivElement>(null);
  // Prevents double-tap bugs: locks navigateTo for the duration of the exit animation.
  const transitioning = useRef(false);

  // Fade in on mount
  useEffect(() => {
    if (!containerRef.current) return;
    gsap.fromTo(
      containerRef.current,
      { opacity: 0, y: 12 },
      { opacity: 1, y: 0, duration: TIMINGS.screenEnter, ease: 'power2.out', clearProps: 'y' },
    );
  }, []);

  // Fade out then change scene (double-tap safe)
  const navigateTo = useCallback((scene: SceneKey) => {
    if (transitioning.current) return;
    transitioning.current = true;

    if (!containerRef.current) {
      useUIStore.getState().setScene(scene);
      return;
    }
    gsap.to(containerRef.current, {
      opacity: 0,
      y: -10,
      duration: TIMINGS.screenExit,
      ease: 'power2.in',
      onComplete: () => {
        useUIStore.getState().setScene(scene);
        // Component unmounts after setScene — no need to reset the flag.
      },
    });
  }, []);

  return { containerRef, navigateTo };
}
