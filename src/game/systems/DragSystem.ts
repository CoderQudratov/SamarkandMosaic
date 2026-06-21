import type { Sprite, FederatedPointerEvent } from 'pixi.js';
import { useGameStore } from '@/store/gameStore';
import { audioManager } from '@/game/audio/AudioManager';
import { effectManager } from '@/game/effects/EffectManager';
import type { DragPayload } from '@/game/types';

class DragSystem {
  private active: DragPayload | null = null;
  private activeSprite: Sprite | null = null;

  attachToPiece(sprite: Sprite, pieceId: string): void {
    sprite.eventMode = 'static';
    sprite.cursor = 'grab';

    sprite.on('pointerdown', (e: FederatedPointerEvent) => {
      this.onPickup(sprite, pieceId, e);
    });
  }

  private onPickup(sprite: Sprite, pieceId: string, e: FederatedPointerEvent): void {
    this.active = {
      pieceId,
      startX: sprite.x,
      startY: sprite.y,
      currentX: e.globalX,
      currentY: e.globalY,
    };
    this.activeSprite = sprite;

    sprite.zIndex = 999;
    sprite.cursor = 'grabbing';

    useGameStore.getState().updatePieceStatus(pieceId, 'dragging');
    audioManager.play('pickup');
    effectManager.trigger({ type: 'pickup', x: e.globalX, y: e.globalY });

    sprite.parent.on('pointermove', this.onMove, this);
    sprite.parent.on('pointerup', this.onRelease, this);
    sprite.parent.on('pointerupoutside', this.onRelease, this);
  }

  private onMove(e: FederatedPointerEvent): void {
    if (!this.active || !this.activeSprite) return;
    this.activeSprite.x += e.movementX;
    this.activeSprite.y += e.movementY;
    this.active.currentX = e.globalX;
    this.active.currentY = e.globalY;

    effectManager.trigger({ type: 'trail', x: e.globalX, y: e.globalY });
    audioManager.play('drag');
  }

  private onRelease(_e: FederatedPointerEvent): void {
    if (!this.active || !this.activeSprite) return;

    this.activeSprite.parent.off('pointermove', this.onMove, this);
    this.activeSprite.parent.off('pointerup', this.onRelease, this);
    this.activeSprite.parent.off('pointerupoutside', this.onRelease, this);

    // SnapSystem takes over from here — see SnapSystem.ts
    this.active = null;
    this.activeSprite = null;
  }

  getActive(): DragPayload | null {
    return this.active;
  }
}

export const dragSystem = new DragSystem();
