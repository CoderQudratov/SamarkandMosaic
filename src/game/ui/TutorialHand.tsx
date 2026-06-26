import { useEffect, useRef } from 'react';
import { gsap } from '@/lib/gsap';
import { markTutorialDone } from '@/game/systems/SwapSystem';
import { COLORS } from '@/constants';

interface TutorialHandProps {
  slotACx: number;
  slotACy: number;
  slotBCx: number;
  slotBCy: number;
  onComplete?: () => void;
  // Multiplier applied to size. 1.0 = tutorial; 1.8 = idle hint.
  sizeScale?: number;
  // Set true only for the first-play tutorial — marks it as done in localStorage.
  markTutorial?: boolean;
}

export function TutorialHand({
  slotACx, slotACy, slotBCx, slotBCy,
  onComplete,
  sizeScale = 1.0,
  markTutorial = false,
}: TutorialHandProps) {
  const handRef = useRef<HTMLDivElement>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    const hand = handRef.current;
    if (!hand) return;

    const size = 38 * sizeScale;
    const ox = -(size / 2);
    const oy = -(size / 2);

    const tl = gsap.timeline({
      onComplete: () => {
        if (markTutorial) markTutorialDone();
        onCompleteRef.current?.();
      },
    });

    tl.set(hand, { x: slotACx + ox, y: slotACy + oy, opacity: 0, scale: 1.1 });
    tl.to(hand, { opacity: 0.88, scale: 1, duration: 0.3, ease: 'power2.out' });

    tl.to(hand, { scale: 0.82, duration: 0.1, ease: 'power2.in' });
    tl.to(hand, { scale: 1.08, duration: 0.12, ease: 'back.out(3)' });
    tl.to(hand, { scale: 1, duration: 0.1, ease: 'power2.out' });

    tl.to(hand, { x: slotBCx + ox, y: slotBCy + oy, duration: 0.55, ease: 'power2.inOut' }, '+=0.25');

    tl.to(hand, { scale: 0.82, duration: 0.1, ease: 'power2.in' });
    tl.to(hand, { scale: 1.08, duration: 0.12, ease: 'back.out(3)' });
    tl.to(hand, { scale: 1, duration: 0.1, ease: 'power2.out' });

    tl.to(hand, { opacity: 0, scale: 0.9, duration: 0.35, ease: 'power2.in' }, '+=0.6');

    return () => { tl.kill(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const size = 38 * sizeScale;
  const fontSize = 30 * sizeScale;

  return (
    <div
      ref={handRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: size,
        height: size,
        pointerEvents: 'none',
        zIndex: 210,
        opacity: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: `${fontSize}px`,
        filter: `drop-shadow(0 0 10px ${COLORS.gold}) drop-shadow(0 0 4px rgba(255,220,0,0.95))`,
        transformOrigin: 'center center',
      }}
    >
      👆
    </div>
  );
}
