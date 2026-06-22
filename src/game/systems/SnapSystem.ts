import { CONFIG } from '@/constants';
import { isWithinSnapRadius, rectCenter, type Rect } from '@/game/utils/geometry';

// A piece may only snap into ITS OWN slot, and only when the dragged piece's
// center lands within `tolerance` px of the slot center.
export function isCorrectDrop(
  draggedRect: Rect,
  ownSlotRect: Rect,
  tolerance: number = CONFIG.puzzle.snapTolerance,
): boolean {
  return isWithinSnapRadius(
    rectCenter(draggedRect),
    rectCenter(ownSlotRect),
    tolerance,
  );
}
