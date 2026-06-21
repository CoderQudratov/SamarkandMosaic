---
name: no-assets-load-outside-loader
enabled: true
event: file
pattern: Assets\.load\(
action: warn
conditions:
  - field: file_path
    operator: regex_match
    pattern: src/(?!game/loaders/).*\.(ts|tsx)$
---

🚫 **Architecture Violation: Assets.load() outside LevelLoader**

`Assets.load()` was called outside `src/game/loaders/`.

**Rule:** All Pixi asset loading must go through `LevelLoader`.

**Fix:**
```ts
// ❌ Wrong — anywhere except loaders/
const tex = await Assets.load('/assets/foo.png');

// ✅ Correct
import { levelLoader } from '@/game/loaders/LevelLoader';
const level = await levelLoader.load(levelId);
// textures are already in Assets cache at this point
```
