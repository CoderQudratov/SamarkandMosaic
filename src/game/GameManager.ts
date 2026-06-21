import { getPixiApp, createPixiApp } from '@/lib/pixi';
import { sceneManager } from '@/game/scenes/SceneManager';
import { PuzzleScene } from '@/game/scenes/PuzzleScene';
import { audioManager } from '@/game/audio/AudioManager';
import { useGameStore } from '@/store/gameStore';
import { useUIStore } from '@/store/uiStore';
import { CONFIG } from '@/constants';

class GameManager {
  private puzzleScene: PuzzleScene | null = null;
  private initialized = false;

  async init(canvas: HTMLCanvasElement): Promise<void> {
    if (this.initialized) return;

    const app = createPixiApp({ ...CONFIG.pixi, view: canvas });
    sceneManager.init(app);

    this.puzzleScene = new PuzzleScene();
    sceneManager.register('game', {
      container: this.puzzleScene.container,
      onEnter: () => this.puzzleScene!.onEnter(),
      onExit: () => this.puzzleScene!.onExit(),
    });

    audioManager.preload();
    this.initialized = true;
  }

  async startLevel(levelId: number): Promise<void> {
    useUIStore.getState().setScene('game');
    useGameStore.getState().reset();

    await this.puzzleScene?.load(levelId);
    await sceneManager.goto('game');
  }

  pause(): void {
    getPixiApp().ticker.stop();
    useGameStore.getState().setStatus('paused');
    useUIStore.getState().setPauseMenu(true);
  }

  resume(): void {
    getPixiApp().ticker.start();
    useGameStore.getState().setStatus('playing');
    useUIStore.getState().setPauseMenu(false);
  }

  destroy(): void {
    sceneManager.destroy();
    audioManager.destroy();
    this.puzzleScene = null;
    this.initialized = false;
  }
}

export const gameManager = new GameManager();
