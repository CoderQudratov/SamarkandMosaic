import { useBoardStore } from '@/store/boardStore';
import type {
  PuzzleLevel,
  PuzzlePieceDef,
  PuzzlePieceRuntime,
  BoardLayout,
} from '@/game/types';
import type { Rect } from '@/game/utils/geometry';
import { CONFIG } from '@/constants';

// ── Paths ─────────────────────────────────────────────────────────────────────

export function levelBaseUrl(levelId: string): string {
  return `/assets/levels/${levelId}`;
}

// ── Validation ─────────────────────────────────────────────────────────────────

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function validatePiece(p: unknown, i: number): PuzzlePieceDef {
  if (typeof p !== 'object' || p === null) {
    throw new Error(`piece[${i}] is not an object`);
  }
  const o = p as Record<string, unknown>;
  if (typeof o.id !== 'string' || !o.id) throw new Error(`piece[${i}].id missing`);
  if (typeof o.image !== 'string' || !o.image) throw new Error(`piece[${i}].image missing`);
  if (!isFiniteNumber(o.targetX)) throw new Error(`piece[${i}].targetX invalid`);
  if (!isFiniteNumber(o.targetY)) throw new Error(`piece[${i}].targetY invalid`);
  if (!isFiniteNumber(o.width) || o.width <= 0) throw new Error(`piece[${i}].width invalid`);
  if (!isFiniteNumber(o.height) || o.height <= 0) throw new Error(`piece[${i}].height invalid`);
  return {
    id: o.id,
    image: o.image,
    targetX: o.targetX,
    targetY: o.targetY,
    width: o.width,
    height: o.height,
  };
}

function validateLevel(data: unknown): PuzzleLevel {
  if (typeof data !== 'object' || data === null) throw new Error('level.json is not an object');
  const o = data as Record<string, unknown>;
  if (typeof o.id !== 'string' || !o.id) throw new Error('level.id missing');
  if (typeof o.board !== 'string') throw new Error('level.board missing');
  if (typeof o.guide !== 'string') throw new Error('level.guide missing');
  if (!Array.isArray(o.pieces) || o.pieces.length === 0) {
    throw new Error('level.pieces must be a non-empty array');
  }
  const pieces = o.pieces.map(validatePiece);

  // Guard against duplicate ids — they would collide in the runtime map.
  const ids = new Set<string>();
  for (const p of pieces) {
    if (ids.has(p.id)) throw new Error(`duplicate piece id "${p.id}"`);
    ids.add(p.id);
  }

  return { id: o.id, board: o.board, guide: o.guide, pieces };
}

// ── Image probing (for natural board size) ─────────────────────────────────────

function probeImageSize(
  url: string,
  timeoutMs = 4000,
): Promise<{ w: number; h: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    let settled = false;
    const done = (result: { w: number; h: number } | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    const timer = setTimeout(() => done(null), timeoutMs);
    img.onload = () => done({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => done(null);
    img.src = url;
  });
}

// Fallback natural size = bounding box of all slots (works with no board art).
function slotsBoundingBox(pieces: PuzzlePieceDef[]): { w: number; h: number } {
  let w = 0;
  let h = 0;
  for (const p of pieces) {
    w = Math.max(w, p.targetX + p.width);
    h = Math.max(h, p.targetY + p.height);
  }
  return { w, h };
}

// ── Tray order ─────────────────────────────────────────────────────────────────

function shuffle<T>(input: T[]): T[] {
  const arr = [...input];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ── Public: load a level ────────────────────────────────────────────────────────

export async function loadLevel(levelId: string): Promise<void> {
  const store = useBoardStore.getState();

  // Idempotent: don't kick off a second load for the same level mid-flight.
  if (store.loadState === 'loading' && store.levelId === levelId) return;
  if (store.loadState === 'ready' && store.levelId === levelId) return;

  useBoardStore.getState().beginLoad(levelId);

  try {
    const base = levelBaseUrl(levelId);

    const res = await fetch(`${base}/level.json`);
    if (!res.ok) {
      throw new Error(`level.json not found (HTTP ${res.status})`);
    }

    const raw = await res.json();
    const level = validateLevel(raw);

    // Establish the natural coordinate space. Prefer the board image's real
    // dimensions; fall back to the slots bounding box if art is missing.
    const probed = await probeImageSize(`${base}/${level.board}`);
    const natural =
      probed && probed.w > 0 && probed.h > 0 ? probed : slotsBoundingBox(level.pieces);

    if (natural.w <= 0 || natural.h <= 0) {
      throw new Error('could not determine board dimensions');
    }

    const pieces: Record<string, PuzzlePieceRuntime> = {};
    for (const def of level.pieces) {
      pieces[def.id] = { id: def.id, def, placed: false };
    }
    const trayOrder = shuffle(level.pieces.map((p) => p.id));

    useBoardStore
      .getState()
      .setLevelData(level, natural.w, natural.h, pieces, trayOrder);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'failed to load level';
    // eslint-disable-next-line no-console
    console.error('[BoardSystem] level load failed:', message, err);
    useBoardStore.getState().setError(message);
  }
}

// ── Layout math (pure) ──────────────────────────────────────────────────────────

// Fit-contain the natural board into a container rect (viewport coords).
export function computeLayout(
  containerRect: DOMRect,
  naturalWidth: number,
  naturalHeight: number,
): BoardLayout {
  const margin = CONFIG.puzzle.boardMargin * 2;
  const availW = Math.max(1, containerRect.width - margin);
  const availH = Math.max(1, containerRect.height - margin);

  const scale = Math.min(availW / naturalWidth, availH / naturalHeight);
  const width = naturalWidth * scale;
  const height = naturalHeight * scale;
  const left = containerRect.left + (containerRect.width - width) / 2;
  const top = containerRect.top + (containerRect.height - height) / 2;

  return { left, top, width, height, scale, naturalWidth, naturalHeight };
}

// Slot rect in viewport coords (used for drop hit-testing).
export function slotViewportRect(def: PuzzlePieceDef, layout: BoardLayout): Rect {
  return {
    left: layout.left + def.targetX * layout.scale,
    top: layout.top + def.targetY * layout.scale,
    width: def.width * layout.scale,
    height: def.height * layout.scale,
  };
}

// Slot rect relative to the board element's top-left (used for rendering).
export function slotLocalRect(def: PuzzlePieceDef, scale: number): Rect {
  return {
    left: def.targetX * scale,
    top: def.targetY * scale,
    width: def.width * scale,
    height: def.height * scale,
  };
}
