import { Application, type IApplicationOptions } from 'pixi.js';

let app: Application | null = null;

export function createPixiApp(options: Partial<IApplicationOptions>): Application {
  if (app) return app;
  app = new Application(options);
  return app;
}

export function getPixiApp(): Application {
  if (!app) throw new Error('PixiJS app not initialized. Call createPixiApp first.');
  return app;
}

export function destroyPixiApp(): void {
  app?.destroy(true, { children: true, texture: true, baseTexture: true });
  app = null;
}
