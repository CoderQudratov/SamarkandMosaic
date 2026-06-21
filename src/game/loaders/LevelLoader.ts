import { Assets } from 'pixi.js';
import type { LevelConfig } from '@/game/types';
import { useLevelStore } from '@/store/levelStore';
import { useUIStore } from '@/store/uiStore';

class LevelLoader {
  async load(levelId: number): Promise<LevelConfig> {
    useLevelStore.getState().setLoadingLevel(true);
    useUIStore.getState().setLoading(true);
    useUIStore.getState().setLoadingProgress(0);

    const configUrl = `/assets/levels/${levelId}/level.json`;
    const config: LevelConfig = await fetch(configUrl).then((r) => r.json());

    const texturePaths = [
      `/assets/levels/${levelId}/${config.boardImage}`,
      `/assets/levels/${levelId}/${config.guideImage}`,
      `/assets/levels/${levelId}/${config.outlineImage}`,
      ...config.pieces.map((p) => `/assets/levels/${levelId}/${p.image}`),
    ];

    let loaded = 0;
    for (const path of texturePaths) {
      await Assets.load(path);
      loaded++;
      useUIStore.getState().setLoadingProgress(
        Math.round((loaded / texturePaths.length) * 100),
      );
    }

    useLevelStore.getState().setCurrentLevel(config);
    useLevelStore.getState().setLoadingLevel(false);
    useUIStore.getState().setLoading(false);
    useUIStore.getState().setLoadingProgress(100);

    return config;
  }

  unload(levelId: number): void {
    const config = useLevelStore.getState().currentLevel;
    if (!config) return;
    Assets.unload(`/assets/levels/${levelId}/level.json`);
    useLevelStore.getState().clearCurrentLevel();
  }
}

export const levelLoader = new LevelLoader();
