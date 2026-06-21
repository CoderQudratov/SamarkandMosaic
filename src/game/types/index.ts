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

export type SoundKey =
  | 'pickup'
  | 'drag'
  | 'snap'
  | 'wrong'
  | 'complete'
  | 'ambient';

// ─── Scene ──────────────────────────────────────────────────────────────────

export type SceneKey =
  | 'splash'
  | 'welcome'
  | 'nameInput'
  | 'mainMenu'
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
}

// ─── Game Runtime ────────────────────────────────────────────────────────────

export type GameStatus = 'idle' | 'playing' | 'paused' | 'won' | 'gameover';
