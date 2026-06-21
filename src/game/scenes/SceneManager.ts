import type { Application, Container } from 'pixi.js';
import type { SceneKey } from '@/game/types';

interface Scene {
  container: Container;
  onEnter?: () => void | Promise<void>;
  onExit?: () => void;
}

class SceneManager {
  private app: Application | null = null;
  private scenes: Map<SceneKey, Scene> = new Map();
  private current: SceneKey | null = null;

  init(app: Application): void {
    this.app = app;
  }

  register(key: SceneKey, scene: Scene): void {
    scene.container.visible = false;
    this.app?.stage.addChild(scene.container);
    this.scenes.set(key, scene);
  }

  async goto(key: SceneKey): Promise<void> {
    if (this.current) {
      const prev = this.scenes.get(this.current);
      prev?.onExit?.();
      if (prev) prev.container.visible = false;
    }

    const next = this.scenes.get(key);
    if (!next) return;

    next.container.visible = true;
    this.current = key;
    await next.onEnter?.();
  }

  getCurrent(): SceneKey | null {
    return this.current;
  }

  destroy(): void {
    this.scenes.clear();
    this.current = null;
    this.app = null;
  }
}

export const sceneManager = new SceneManager();
