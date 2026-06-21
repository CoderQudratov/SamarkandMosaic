import type { Container, Sprite } from 'pixi.js';
import type { EffectPayload } from '@/game/types';

class EffectManager {
  protected _container: Container | null = null;

  init(container: Container): void {
    this._container = container;
  }

  trigger(payload: EffectPayload): void {
    switch (payload.type) {
      case 'pickup':
        this.playPickup(payload.x ?? 0, payload.y ?? 0);
        break;
      case 'snap':
        this.playSnap(payload.x ?? 0, payload.y ?? 0);
        break;
      case 'wrong':
        this.playWrong(payload.target);
        break;
      case 'trail':
        this.playTrail(payload.x ?? 0, payload.y ?? 0);
        break;
      case 'complete':
        this.playComplete();
        break;
      case 'glow':
        this.playGlow(payload.target);
        break;
      case 'shake':
        this.playShake(payload.container ?? payload.target);
        break;
    }
  }

  private playPickup(_x: number, _y: number): void {
    // dust burst — implemented in effects phase
  }

  private playSnap(_x: number, _y: number): void {
    // gold flash + dust burst + glow — implemented in effects phase
  }

  private playWrong(_target: Sprite | undefined): void {
    // red crack pulse + shake — implemented in effects phase
  }

  private playTrail(_x: number, _y: number): void {
    // trail sparkles — implemented in effects phase
  }

  private playComplete(): void {
    // confetti + gold dust + glow ring — implemented in effects phase
  }

  private playGlow(_target: Sprite | Container | undefined): void {
    // glow filter — implemented in effects phase
  }

  private playShake(_target: Sprite | Container | undefined): void {
    // GSAP shake — implemented in effects phase
  }

  destroy(): void {
    this._container = null;
  }
}

export const effectManager = new EffectManager();
