import type { Sprite } from 'pixi.js';
import { gsap } from '@/lib/gsap';
import { CONFIG, TIMINGS } from '@/constants';
import { distance } from '@/game/utils/math';
import { useGameStore } from '@/store/gameStore';
import { audioManager } from '@/game/audio/AudioManager';
import { effectManager } from '@/game/effects/EffectManager';
import type { PieceConfig, SnapResult } from '@/game/types';

class SnapSystem {
  attempt(sprite: Sprite, piece: PieceConfig): SnapResult {
    const dist = distance(sprite.x, sprite.y, piece.target.x, piece.target.y);

    if (dist <= CONFIG.snapRadius) {
      this.snapSuccess(sprite, piece);
      return { snapped: true, pieceId: piece.id, targetX: piece.target.x, targetY: piece.target.y };
    }

    this.snapFail(sprite, piece);
    return { snapped: false, pieceId: piece.id, targetX: piece.target.x, targetY: piece.target.y };
  }

  private snapSuccess(sprite: Sprite, piece: PieceConfig): void {
    gsap.to(sprite, {
      x: piece.target.x,
      y: piece.target.y,
      duration: TIMINGS.snapEffect,
      ease: 'back.out(1.7)',
    });

    sprite.eventMode = 'none';
    sprite.cursor = 'default';
    sprite.zIndex = 1;

    useGameStore.getState().snapPiece(piece.id);
    audioManager.play('snap');
    effectManager.trigger({ type: 'snap', x: piece.target.x, y: piece.target.y });
    effectManager.trigger({ type: 'glow', target: sprite });
  }

  private snapFail(sprite: Sprite, piece: PieceConfig): void {
    const { startX, startY } = this.getOrigin(piece);

    gsap.to(sprite, {
      x: startX,
      y: startY,
      duration: TIMINGS.pieceReturn,
      ease: 'power2.out',
    });

    sprite.zIndex = 1;

    useGameStore.getState().updatePieceStatus(piece.id, 'idle');
    useGameStore.getState().loseHeart();
    audioManager.play('wrong');
    effectManager.trigger({ type: 'wrong', target: sprite });
    effectManager.trigger({ type: 'shake', target: sprite });
  }

  private getOrigin(piece: PieceConfig): { startX: number; startY: number } {
    // spawn positions are set by PieceManager at load time — placeholder
    return { startX: piece.pivot.x, startY: piece.pivot.y };
  }
}

export const snapSystem = new SnapSystem();
