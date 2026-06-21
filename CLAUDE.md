# Samarkand Mosaic — Claude Code Project Guide

## Project Identity

Premium ASMR puzzle game for Telegram Mini Apps.
Theme: Timurid / Samarkand Registan luxury aesthetic.
Main rule: **Every interaction must feel expensive.**

## Stack

| Layer | Tool |
|---|---|
| UI | React 18 + TypeScript |
| Renderer | PixiJS 7 |
| State | Zustand |
| Animation | GSAP 3 |
| Audio | Howler.js |
| Backend | Supabase |
| Platform | Telegram WebApp SDK |
| Build | Vite + Vercel |

## Architecture Rules (NON-NEGOTIABLE)

1. **React never touches Pixi objects.** UI reads from Zustand stores only.
2. **Pixi systems never import React.** All Pixi code lives in `src/game/`.
3. **All state is Zustand.** No local component state for game logic.
4. **AudioManager is the only caller of Howler.** Nothing else plays sounds directly.
5. **EffectManager is the only caller of Pixi effects.** Components never trigger effects.
6. **LevelLoader is the only asset loader.** No `Assets.load()` calls outside `src/game/loaders/`.
7. **No hardcoded colors.** All colors come from `src/constants/colors.ts`.
8. **No hardcoded timings.** All durations come from `src/constants/timings.ts`.
9. **No business logic inside React components.** Components only read stores and call manager methods.

## Folder Contract

```
src/
├── app/           → bootstrapping only
├── components/    → React UI (reads stores, calls managers)
├── game/
│   ├── board/     → BoardRenderer (Pixi only)
│   ├── pieces/    → PieceManager (Pixi only)
│   ├── systems/   → DragSystem, SnapSystem, CollisionSystem, HeartSystem, ProgressSystem
│   ├── scenes/    → SceneManager, PuzzleScene
│   ├── effects/   → EffectManager + sub-effects
│   ├── audio/     → AudioManager (Howler wrapper)
│   ├── ui/        → In-game overlay stubs (Pixi-aware, not React)
│   ├── hooks/     → Custom React hooks that bridge stores → components
│   ├── loaders/   → LevelLoader only
│   ├── types/     → All TypeScript types
│   └── utils/     → Pure math helpers
├── store/         → 5 Zustand stores
├── services/      → Telegram, Supabase, Storage
├── constants/     → colors, timings, config
└── lib/           → Third-party singletons (pixi, gsap, supabase, telegram)
```

## Stores

| Store | Owns |
|---|---|
| `playerStore` | Profile, progress, completed levels |
| `gameStore` | Status, hearts, pieces[], snappedCount |
| `audioStore` | Muted, sfxVolume, ambientVolume |
| `uiStore` | Scene, loading state, pause menu |
| `levelStore` | Current level config, available levels |

## Design System

- **Gold:** `#D4AF37` / `0xd4af37`
- **Dark Gold:** `#B8860B`
- **Timurid Blue:** `#1F5FA8`
- **Sandstone:** `#D2B48C`
- **Brick:** `#7B3F00`
- **Ivory:** `#F8F1E5`
- **Background:** `#1a0f00`

No flat UI. No neon. No generic buttons. Only Timurid luxury.

## Gameplay Constants

- Snap radius: **80px**
- Starting hearts: **3**
- Levels: L1=4p, L2=6p, L3=8p, L4=10p, L5=12p

## Animation Timings

- Pickup effect: `0.12s`
- Snap effect: `0.18s`
- Piece return: `0.25s`
- Complete effect: `0.5s`
- All easing: **soft** (back.out, power2.out) — never linear, never harsh

## Audio

Sounds are ASMR. Snap sound is the most important — must feel addictive.
Files: `pickup.wav`, `drag.wav`, `snap.wav`, `wrong.wav`, `complete.wav`, `ambient.wav`

## Asset Contract (per level)

Every level folder (`/public/assets/levels/{id}/`) must contain:
- `board.png` — main board
- `guide.png` — helper layer (alpha 0.4)
- `outline.png` — cut-lines only
- `pieces/*.png` — pixel-perfect, no overlap, no gaps
- `level.json` — piece definitions with `id, image, target, pivot, size`

## Data Flow

```
bootstrap.ts
  → telegramService.init()
  → supabaseService.loadPlayerProgress()
  → playerStore seeded

gameManager.startLevel(id)
  → levelLoader.load(id)       ← only asset loader
  → boardRenderer.render()
  → pieceManager.loadPieces()
  → sceneManager.goto('game')
  → audioManager.play('ambient')

DragSystem → SnapSystem → gameStore.snapPiece()
  → if won → audioManager + effectManager → uiStore.setScene('win')
```

## Build Order (follow exactly, do not skip)

1. UI shell (done via architecture)
2. Board rendering
3. Piece drag
4. Snap system
5. Audio system
6. Effects system
7. Win / Game Over system
8. Polish

## Skills Installed

| Plugin | Purpose |
|---|---|
| `typescript-lsp` | Type checking, go-to-definition across PixiJS + Zustand types |
| `frontend-design` | Premium Timurid luxury UI aesthetics |
| `feature-dev` | Structured 7-phase workflow for each game system |
| `security-guidance` | Supabase auth, Telegram user data, XSS in canvas |
| `commit-commands` | Clean git workflow during incremental builds |
| `hookify` | Enforce architecture rules (no Pixi in React, etc.) |
| `pr-review-toolkit` | Pre-deploy review for each gameplay phase |
| `claude-md-management` | Keep this file accurate as the project evolves |
| `claude-code-setup` | Recommend MCP servers / automations as stack grows |

## What NOT to Do

- Do NOT install Phaser, Unity, or other game engines
- Do NOT call `Assets.load()` outside `LevelLoader`
- Do NOT call `Howler` outside `AudioManager`
- Do NOT call `gsap` from React components
- Do NOT store game state in React `useState`
- Do NOT hardcode any hex color or animation duration
- Do NOT skip the build order above
