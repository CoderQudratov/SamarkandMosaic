import type { Sprite, Container } from 'pixi.js';

// ─── Level / Asset Types ────────────────────────────────────────────────────

export interface PieceConfig {
  id: string;
  image: string;
  target: { x: number; y: number };
  pivot: { x: number; y: number };
  size: { w: number; h: number };
}

export interface LevelConfig {
  id: number;
  boardImage: string;
  guideImage: string;
  outlineImage: string;
  pieces: PieceConfig[];
}

// ─── Piece Runtime State ────────────────────────────────────────────────────

export type PieceStatus = 'idle' | 'dragging' | 'snapped' | 'returning';

export interface PieceState {
  id: string;
  config: PieceConfig;
  status: PieceStatus;
  sprite: Sprite | null;
}

// ─── Drag ───────────────────────────────────────────────────────────────────

export interface DragPayload {
  pieceId: string;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

// ─── Snap ───────────────────────────────────────────────────────────────────

export interface SnapResult {
  snapped: boolean;
  pieceId: string;
  targetX: number;
  targetY: number;
}

// ─── Effects ────────────────────────────────────────────────────────────────

export type EffectType =
  | 'pickup'
  | 'snap'
  | 'wrong'
  | 'trail'
  | 'complete'
  | 'glow'
  | 'shake';

export interface EffectPayload {
  type: EffectType;
  x?: number;
  y?: number;
  container?: Container;
  target?: Sprite;
}

// ─── Audio ──────────────────────────────────────────────────────────────────

export type MusicKey = 'bg';

export type SfxKey =
  | 'snap'
  | 'wrong'
  | 'win'
  | 'click'
  | 'hint'
  | 'loseHeart';

export type SoundKey = MusicKey | SfxKey;

// ─── Scene ──────────────────────────────────────────────────────────────────

export type SceneKey =
  | 'splash'
  | 'welcome'
  | 'nameInput'
  | 'mainMenu'
  | 'levelSelect'
  | 'game'
  | 'win'
  | 'gameover';

// ─── Player ─────────────────────────────────────────────────────────────────

export interface PlayerProfile {
  telegramId: number;
  username: string;
  firstName: string;
  lastName: string;
  displayName: string;
  language: string;
  photoUrl: string | null;
  isPremium: boolean;
}

export interface PlayerProgress {
  completedLevels: number[];
  highestLevel: number;
  totalSnaps: number;
  /** Best stars earned per level id (1–3). */
  stars: Record<number, number>;
}

// ─── Game Runtime ────────────────────────────────────────────────────────────

export type GameStatus = 'idle' | 'playing' | 'paused' | 'won' | 'gameover';

// ─── Puzzle (React-DOM board system) ─────────────────────────────────────────
// Level JSON authored in natural board-image pixel space. The board is scaled
// responsively to fit the screen; piece slots scale with it.

export interface PuzzlePieceDef {
  id: string;
  image: string;   // path relative to the level directory, e.g. "pieces/piece-1.png"
  targetX: number; // slot top-left X in natural board space
  targetY: number; // slot top-left Y in natural board space
  width: number;   // slot/piece width in natural board space
  height: number;  // slot/piece height in natural board space
}

export interface PuzzleLevel {
  id: string;            // e.g. "level-1"
  board: string;         // board image filename
  guide: string;         // guide image filename
  pieces: PuzzlePieceDef[];
}

export type PuzzleLoadState = 'idle' | 'loading' | 'ready' | 'error';

export interface PuzzlePieceRuntime {
  id: string;
  def: PuzzlePieceDef;
  placed: boolean;
}

// Board's on-screen placement (viewport CSS px) plus natural→screen scale.
export interface BoardLayout {
  left: number;
  top: number;
  width: number;
  height: number;
  scale: number;
  naturalWidth: number;
  naturalHeight: number;
}
