export function distance(
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  return Math.sqrt((bx - ax) ** 2 + (by - ay) ** 2);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
