import { useEffect, useCallback, useRef } from 'react';
import { gsap } from '@/lib/gsap';
import { TIMINGS } from '@/constants';
import { useUIStore } from '@/store/uiStore';
import type { SceneKey } from '@/game/types';

export function useScreenTransition() {
  const containerRef = useRef<HTMLDivElement>(null);

  // Fade in on mount
  useEffect(() => {
    if (!containerRef.current) return;
    gsap.fromTo(
      containerRef.current,
      { opacity: 0, y: 12 },
      { opacity: 1, y: 0, duration: TIMINGS.screenEnter, ease: 'power2.out', clearProps: 'y' },
    );
  }, []);

  // Fade out then change scene
  const navigateTo = useCallback((scene: SceneKey) => {
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
      },
    });
  }, []);

  return { containerRef, navigateTo };
}
