import { Container } from 'pixi.js';
import { boardRenderer } from '@/game/board/BoardRenderer';
import { pieceManager } from '@/game/pieces/PieceManager';
import { effectManager } from '@/game/effects/EffectManager';
import { levelLoader } from '@/game/loaders/LevelLoader';
import { audioManager } from '@/game/audio/AudioManager';
import { useGameStore } from '@/store/gameStore';
import type { LevelConfig } from '@/game/types';

export class PuzzleScene {
  readonly container: Container = new Container();
  private level: LevelConfig | null = null;

  constructor() {
    this.container.addChild(boardRenderer.getContainer());
    this.container.addChild(pieceManager.getContainer());

    const effectsLayer = new Container();
    effectManager.init(effectsLayer);
    this.container.addChild(effectsLayer);
  }

  async load(levelId: number): Promise<void> {
    this.level = await levelLoader.load(levelId);
    const baseUrl = `/assets/levels/${levelId}`;

    await boardRenderer.render(this.level, baseUrl);
    await pieceManager.loadPieces(this.level, baseUrl);

    useGameStore.getState().setLevel(levelId, this.level.pieces.length);
    useGameStore.getState().setPieces(
      this.level.pieces.map((p) => ({ id: p.id, status: 'idle' })),
    );
  }

  onEnter(): void {
    useGameStore.getState().setStatus('playing');
    audioManager.play('ambient');
  }

  onExit(): void {
    audioManager.stopAmbient();
    boardRenderer.destroy();
    pieceManager.destroy();
    effectManager.destroy();
  }
}
