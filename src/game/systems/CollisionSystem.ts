import type { Sprite } from 'pixi.js';

class CollisionSystem {
  overlaps(a: Sprite, b: Sprite): boolean {
    const ab = a.getBounds();
    const bb = b.getBounds();
    return (
      ab.x < bb.x + bb.width &&
      ab.x + ab.width > bb.x &&
      ab.y < bb.y + bb.height &&
      ab.y + ab.height > bb.y
    );
  }
}

export const collisionSystem = new CollisionSystem();
