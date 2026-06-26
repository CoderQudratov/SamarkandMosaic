import {
  useRef,
  useState,
  useCallback,
  useEffect,
  useLayoutEffect,
} from 'react';
import { gsap } from '@/lib/gsap';
import { CONFIG, TIMINGS } from '@/constants';
import { isCorrectDrop } from './SnapSystem';
import type { Rect } from '@/game/utils/geometry';

interface UsePuzzleDragArgs {
  getSlotRect: (id: string) => Rect | null;
  getTrayRect: () => DOMRect | null;
  onPlace: (id: string) => void;
  onReturn: (id: string) => void;
  onSnapFeedback?: (slotRect: Rect) => void;
  // Fired only for intentional wrong drops (not blur/cancel). Used for heart loss.
  onWrongDrop?: (dropRect: Rect) => void;
}

interface ActiveDrag {
  id: string;
  pointerId: number; // the specific pointer finger that started the drag
  grabX: number;     // pointer offset from piece top-left
  grabY: number;
  w: number;
  h: number;
  x: number;         // current top-left (viewport)
  y: number;
}

export interface UsePuzzleDragResult {
  draggingId: string | null;
  initRect: Rect | null;
  floatingRef: React.RefObject<HTMLDivElement>;
  // Radial glow element — always mounted in the drag layer, GSAP controls it.
  glowRef: React.RefObject<HTMLDivElement>;
  startDrag: (id: string, e: React.PointerEvent) => void;
}

export function usePuzzleDrag(args: UsePuzzleDragArgs): UsePuzzleDragResult {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [initRect, setInitRect] = useState<Rect | null>(null);
  const floatingRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const active = useRef<ActiveDrag | null>(null);

  // Keep latest callbacks/getters without re-binding window listeners.
  const argsRef = useRef(args);
  argsRef.current = args;

  // Resolve a drag exactly once, clearing all state. Safe to call from any path.
  const finish = useCallback((kind: 'place' | 'return', id: string) => {
    active.current = null;
    setDraggingId(null);
    setInitRect(null);
    if (kind === 'place') argsRef.current.onPlace(id);
    else argsRef.current.onReturn(id);
  }, []);

  const endDrag = useCallback(
    (cancelled: boolean) => {
      const d = active.current;
      if (!d) return;
      const el = floatingRef.current;
      const glow = glowRef.current;

      const slot = argsRef.current.getSlotRect(d.id);
      const draggedRect: Rect = { left: d.x, top: d.y, width: d.w, height: d.h };
      const correct = !cancelled && !!slot && isCorrectDrop(draggedRect, slot);

      if (!el) {
        finish(correct ? 'place' : 'return', d.id);
        return;
      }

      try {
        if (correct && slot) {
          // ── Correct snap ───────────────────────────────────────────────────
          gsap.to(el, {
            x: slot.left,
            y: slot.top,
            scale: 1,
            duration: TIMINGS.snapPlace,
            ease: 'power2.out',
            onComplete: () => {
              // Piece settle: 1 → 1.04 → 1, soft ease
              gsap
                .timeline({ onComplete: () => finish('place', d.id) })
                .to(el, {
                  scale: 1.06,
                  duration: TIMINGS.snapBounce * 0.5,
                  ease: 'power2.out',
                })
                .to(el, {
                  scale: 1,
                  duration: TIMINGS.snapBounce * 0.5,
                  ease: 'back.out(2)',
                });

              // Radial glow flash — centered on the snap slot
              if (glow) {
                gsap.set(glow, {
                  opacity: 0.6,
                  x: slot.left + slot.width / 2,
                  y: slot.top + slot.height / 2,
                  xPercent: -50,
                  yPercent: -50,
                });
                gsap.to(glow, {
                  opacity: 0,
                  duration: TIMINGS.snapGlow,
                  ease: 'power2.out',
                });
              }

              // Slot border pulse (handled by PuzzleBoard via callback)
              argsRef.current.onSnapFeedback?.(slot);
            },
          });
        } else {
          // ── Wrong drop: FX → shake → return to tray ───────────────────────
          if (!cancelled) {
            const dropRect: Rect = { left: d.x, top: d.y, width: d.w, height: d.h };
            argsRef.current.onWrongDrop?.(dropRect);
          }
          const cx = d.x;
          // Shake: left → right → left → center, 8px, 0.22s
          gsap
            .timeline({
              onComplete: () => {
                const tray = argsRef.current.getTrayRect();
                const tx = tray ? tray.left + tray.width / 2 - d.w / 2 : d.x;
                const ty = tray ? tray.top + 8 : d.y;
                // Return with brief settle: arrives at 1.03 then settles to 1
                gsap.to(el, {
                  x: tx,
                  y: ty,
                  scale: 1.03,
                  duration: TIMINGS.pieceReturn * 0.75,
                  ease: 'power2.out',
                  onComplete: () =>
                    gsap.to(el, {
                      scale: 1,
                      duration: TIMINGS.pieceReturn * 0.25,
                      ease: 'power2.out',
                      onComplete: () => finish('return', d.id),
                    }),
                });
              },
            })
            .to(el, { x: cx - 8, duration: 0.04, ease: 'power2.out' })
            .to(el, { x: cx + 8, duration: 0.08, ease: 'power2.inOut' })
            .to(el, { x: cx - 4, duration: 0.06, ease: 'power2.inOut' })
            .to(el, { x: cx, duration: 0.04, ease: 'power2.out' });
        }
      } catch {
        finish(correct ? 'place' : 'return', d.id);
      }
    },
    [finish],
  );

  // Window-level listeners while a drag is active (touch + mouse unified).
  useEffect(() => {
    if (!draggingId) return;

    const onMove = (e: PointerEvent) => {
      const d = active.current;
      if (!d || e.pointerId !== d.pointerId) return; // ignore secondary fingers
      d.x = e.clientX - d.grabX;
      d.y = e.clientY - d.grabY;
      const el = floatingRef.current;
      if (el) gsap.set(el, { x: d.x, y: d.y });
    };
    const onUp = () => endDrag(false);
    const onCancel = () => endDrag(true);

    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    window.addEventListener('blur', onCancel);
    // touchcancel fires on iOS when a system gesture (Control Centre, notification)
    // interrupts the touch. Without this the piece gets stuck mid-drag.
    window.addEventListener('touchcancel', onCancel, { passive: true });

    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('blur', onCancel);
      window.removeEventListener('touchcancel', onCancel);
    };
  }, [draggingId, endDrag]);

  // Position the floating element + play the grab "lift" once it mounts.
  useLayoutEffect(() => {
    if (!draggingId) return;
    const d = active.current;
    const el = floatingRef.current;
    if (!d || !el) return;
    try {
      gsap.set(el, { x: d.x, y: d.y, scale: 1, transformOrigin: '0 0' });
      gsap.to(el, {
        scale: CONFIG.puzzle.grabScale,
        duration: TIMINGS.dragGrab,
        ease: 'power2.out',
      });
    } catch {
      // Animation optional — element is already visible at the correct spot.
    }
  }, [draggingId]);

  const startDrag = useCallback((id: string, e: React.PointerEvent) => {
    // Ignore secondary buttons / already-dragging.
    if (active.current) return;
    const slot = argsRef.current.getSlotRect(id);
    if (!slot) return; // board not laid out yet

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const relX = rect.width ? (e.clientX - rect.left) / rect.width : 0.5;
    const relY = rect.height ? (e.clientY - rect.top) / rect.height : 0.5;

    // Floating piece renders at board (slot) size so it previews the fit.
    const w = slot.width;
    const h = slot.height;
    const grabX = relX * w;
    const grabY = relY * h;
    const x = e.clientX - grabX;
    const y = e.clientY - grabY;

    active.current = { id, pointerId: e.pointerId, grabX, grabY, w, h, x, y };
    setInitRect({ left: x, top: y, width: w, height: h });
    setDraggingId(id);
  }, []);

  return { draggingId, initRect, floatingRef, glowRef, startDrag };
}
