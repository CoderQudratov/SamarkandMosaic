import { Container, Sprite, Assets } from 'pixi.js';
import type { LevelConfig, PieceConfig } from '@/game/types';
import { dragSystem } from '@/game/systems/DragSystem';
import { snapSystem } from '@/game/systems/SnapSystem';

class PieceManager {
  private container: Container = new Container();
  private pieces: Map<string, Sprite> = new Map();
  private configs: Map<string, PieceConfig> = new Map();

  getContainer(): Container {
    return this.container;
  }

  async loadPieces(level: LevelConfig, baseUrl: string): Promise<void> {
    this.container.removeChildren();
    this.pieces.clear();
    this.configs.clear();

    for (const config of level.pieces) {
      const texture = await Assets.load(`${baseUrl}/${config.image}`);
      const sprite = new Sprite(texture);

      sprite.width = config.size.w;
      sprite.height = config.size.h;
      sprite.pivot.set(config.pivot.x, config.pivot.y);
      sprite.name = config.id;

      // Pieces start at a scattered spawn position — set during game init
      sprite.sortableChildren = false;

      dragSystem.attachToPiece(sprite, config.id);
      sprite.on('pointerup', () => snapSystem.attempt(sprite, config));

      this.pieces.set(config.id, sprite);
      this.configs.set(config.id, config);
      this.container.addChild(sprite);
    }

    this.container.sortableChildren = true;
  }

  getSprite(id: string): Sprite | undefined {
    return this.pieces.get(id);
  }

  destroy(): void {
    this.container.destroy({ children: true });
    this.pieces.clear();
    this.configs.clear();
    this.container = new Container();
  }
}

export const pieceManager = new PieceManager();
