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
  // Viewport rect of a piece's OWN target slot (depends on current board layout).
  getSlotRect: (id: string) => Rect | null;
  // Viewport rect of the tray container (used to animate invalid drops home).
  getTrayRect: () => DOMRect | null;
  // Called when a drop is valid — caller commits the piece as placed.
  onPlace: (id: string) => void;
  // Called when a drop is invalid — piece returns to the tray.
  onReturn: (id: string) => void;
}

interface ActiveDrag {
  id: string;
  grabX: number; // pointer offset from piece top-left
  grabY: number;
  w: number;
  h: number;
  x: number; // current top-left (viewport)
  y: number;
}

export interface UsePuzzleDragResult {
  draggingId: string | null;
  initRect: Rect | null; // initial position for the floating element's first paint
  floatingRef: React.RefObject<HTMLDivElement>;
  startDrag: (id: string, e: React.PointerEvent) => void;
}

export function usePuzzleDrag(args: UsePuzzleDragArgs): UsePuzzleDragResult {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [initRect, setInitRect] = useState<Rect | null>(null);
  const floatingRef = useRef<HTMLDivElement>(null);
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

      const slot = argsRef.current.getSlotRect(d.id);
      const draggedRect: Rect = { left: d.x, top: d.y, width: d.w, height: d.h };
      const correct = !cancelled && !!slot && isCorrectDrop(draggedRect, slot);

      // No element to animate (or GSAP unavailable) → resolve immediately.
      if (!el) {
        finish(correct ? 'place' : 'return', d.id);
        return;
      }

      try {
        if (correct && slot) {
          gsap.to(el, {
            x: slot.left,
            y: slot.top,
            scale: 1,
            duration: TIMINGS.snapPlace,
            ease: 'power2.out',
            onComplete: () => finish('place', d.id),
          });
        } else {
          // Animate back toward the tray, then return.
          const tray = argsRef.current.getTrayRect();
          const tx = tray ? tray.left + tray.width / 2 - d.w / 2 : d.x;
          const ty = tray ? tray.top + 8 : d.y;
          gsap.to(el, {
            x: tx,
            y: ty,
            scale: 1,
            duration: TIMINGS.pieceReturn,
            ease: 'power2.out',
            onComplete: () => finish('return', d.id),
          });
        }
      } catch {
        // GSAP failure must never strand the drag state.
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
      if (!d) return;
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

    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('blur', onCancel);
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

    active.current = { id, grabX, grabY, w, h, x, y };
    setInitRect({ left: x, top: y, width: w, height: h });
    setDraggingId(id);
  }, []);

  return { draggingId, initRect, floatingRef, startDrag };
}
