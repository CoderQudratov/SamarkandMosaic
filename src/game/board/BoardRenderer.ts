import { Container, Sprite, Assets } from 'pixi.js';
import type { LevelConfig } from '@/game/types';

class BoardRenderer {
  private container: Container = new Container();

  getContainer(): Container {
    return this.container;
  }

  async render(level: LevelConfig, baseUrl: string): Promise<void> {
    this.container.removeChildren();

    const boardTexture = await Assets.load(`${baseUrl}/${level.boardImage}`);
    const board = new Sprite(boardTexture);
    board.name = 'board';

    const guideTexture = await Assets.load(`${baseUrl}/${level.guideImage}`);
    const guide = new Sprite(guideTexture);
    guide.alpha = 0.4;
    guide.name = 'guide';

    const outlineTexture = await Assets.load(`${baseUrl}/${level.outlineImage}`);
    const outline = new Sprite(outlineTexture);
    outline.name = 'outline';

    this.container.addChild(board, guide, outline);
  }

  destroy(): void {
    this.container.destroy({ children: true });
    this.container = new Container();
  }
}

export const boardRenderer = new BoardRenderer();
