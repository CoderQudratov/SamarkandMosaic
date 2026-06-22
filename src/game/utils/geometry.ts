import { distance, clamp } from './math';

// Re-export the primitives so callers can pull all geometry from one module.
export { distance, clamp };

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface Bounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Center point of a rectangle. */
export function rectCenter(rect: Rect): Point {
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

/** True when two points are within `radius` px of each other. */
export function isWithinSnapRadius(a: Point, b: Point, radius: number): boolean {
  return distance(a.x, a.y, b.x, b.y) <= radius;
}

/** Clamp a point so it stays inside the given bounds. */
export function clampToBounds(p: Point, bounds: Bounds): Point {
  return {
    x: clamp(p.x, bounds.left, bounds.right),
    y: clamp(p.y, bounds.top, bounds.bottom),
  };
}
