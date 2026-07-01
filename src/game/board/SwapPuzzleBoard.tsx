import React, {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useCallback,
} from 'react';
import { gsap } from '@/lib/gsap';
import { useSwapStore } from '@/store/swapStore';
import { usePlayerStore } from '@/store/playerStore';
import { useLevelStore } from '@/store/levelStore';
import { useUIStore } from '@/store/uiStore';
import { useAudioStore } from '@/store/audioStore';
import {
  createShuffledGrid,
  isGoodSwap,
  isTileImproved,
  saveSwapState,
  loadSwapState,
  clearSwapState,
  isTutorialDone,
  findBestMove,
} from '@/game/systems/SwapSystem';
import { loadLevel, type LoadedLevel, type LevelManifest } from '@/game/loaders/SwapLevelLoader';
import { audioManager } from '@/game/audio/AudioManager';
import { hapticsManager } from '@/game/haptics/HapticsManager';
import { triggerSnapFX } from '@/game/effects/snapFX';
import { spawnCoinReward } from '@/game/effects/coinFX';
import {
  spawnWinConfetti,
  spawnMosaicShards,
  spawnScreenEdgeFlash,
  spawnCoinSparkles,
} from '@/game/effects/winFX';
import { WinParticles } from '@/game/effects/WinParticles';
import { TutorialHand } from '@/game/ui/TutorialHand';
import { ChestModal } from '@/components/modals/ChestModal';
import { Modal } from '@/components/modals/Modal';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { saveSystem } from '@/game/systems/SaveSystem';
import { syncManager } from '@/game/systems/SyncManager';
import { calcLevelReward, setLastWinPayload } from '@/game/systems/EconomySystem';
import { sync } from '@/services/sync.service';
import { registerBackButton, unregisterBackButton } from '@/integrations/telegram';
import { COLORS, TIMINGS, CONFIG } from '@/constants';
import {
  processTileTextures,
  buildQualityReport,
  downloadQualityReport,
  generateSharpnessDebug,
  type TextureSet,
} from '@/game/utils/renderQuality';

// ── Layout ────────────────────────────────────────────────────────────────────

interface BoardLayout {
  left: number;
  top: number;
  relLeft: number;
  relTop: number;
  width: number;
  height: number;
  cellW: number;  // nominal (average) cell width for backward-compat refs
  cellH: number;
  // Per-column and per-row sizes in display pixels:
  colEdges: number[];    // left offset of each column  [0, w0, w0+w1, ...]
  rowEdges: number[];    // top offset of each row      [0, h0, h0+h1, ...]
  colWidths: number[];   // pixel width of each column
  rowHeights: number[];  // pixel height of each row
}

function computeSwapLayout(
  container: DOMRect,
  imageW: number,
  imageH: number,
  cols: number,
  rows: number,
  margin: number,
  _tiling?: LevelManifest['tiling'],  // intentionally ignored — see note below
): BoardLayout {
  const availW = Math.max(1, container.width - margin * 2);
  const availH = Math.max(1, container.height - margin * 2);
  const scale = Math.min(availW / imageW, availH / imageH);

  // Exact (floating-point) cell dimensions — not yet snapped to pixels.
  const exactCellW = (imageW / cols) * scale;
  const exactCellH = (imageH / rows) * scale;

  // Compute integer edges by rounding the *cumulative* float position.
  // This distributes rounding error evenly across all columns/rows instead
  // of dumping it onto the last cell (which the old tiling-branch did with
  // colWidths[last] += drift). Adjacent-edge subtraction gives each cell its
  // final integer pixel width; widths stay within ±1px of each other.
  //
  // NOTE: non-uniform tiling.colWidths / tiling.rowHeights from the vision
  // pipeline are intentionally ignored here. The swap puzzle cannot support
  // per-column / per-row dimension variance: when a tile moves to a slot with
  // a different height, it stretches (up to 7px on L2-L3). Uniform edges
  // derived from the nominal cell size keep every slot identical.
  const colEdges: number[] = Array.from({ length: cols }, (_, i) =>
    Math.round(i * exactCellW),
  );
  const rowEdges: number[] = Array.from({ length: rows }, (_, i) =>
    Math.round(i * exactCellH),
  );
  const totalW = Math.round(cols * exactCellW);
  const totalH = Math.round(rows * exactCellH);

  const colWidths: number[] = colEdges.map((e, i) =>
    (i < cols - 1 ? colEdges[i + 1] : totalW) - e,
  );
  const rowHeights: number[] = rowEdges.map((e, i) =>
    (i < rows - 1 ? rowEdges[i + 1] : totalH) - e,
  );

  // Nominal cell size — used for backward-compat centring calculations.
  const cellW = colWidths[0];
  const cellH = rowHeights[0];
  const width = totalW;
  const height = totalH;

  const relLeft = Math.round((container.width - width) / 2);
  const relTop = Math.round((container.height - height) / 2);
  const left = Math.round(container.left) + relLeft;
  const top = Math.round(container.top) + relTop;

  return { left, top, relLeft, relTop, width, height, cellW, cellH, colEdges, rowEdges, colWidths, rowHeights };
}

// Pixel center of a slot in board-relative coords
function slotCenter(slotIndex: number, cols: number, lay: BoardLayout): { x: number; y: number } {
  const col = slotIndex % cols;
  const row = Math.floor(slotIndex / cols);
  return {
    x: lay.colEdges[col] + lay.colWidths[col] / 2,
    y: lay.rowEdges[row] + lay.rowHeights[row] / 2,
  };
}

// ── Piece components ──────────────────────────────────────────────────────────

const PIECE_GAP = 2;

function LockedPiece({
  left, top, width, height, image,
}: {
  left: number; top: number; width: number; height: number; image: string;
}) {
  return (
    <div
      style={{
        position: 'absolute',
        left, top, width, height,
        pointerEvents: 'none',
        userSelect: 'none',
        zIndex: 1,
      }}
    >
      <img
        src={image}
        alt=""
        draggable={false}
        style={{ width: '100%', height: '100%', display: 'block', imageRendering: 'crisp-edges', pointerEvents: 'none' }}
      />
    </div>
  );
}

interface MovablePieceProps {
  slotIndex: number;
  image: string;
  isSelected: boolean;
  isCorrect: boolean;
  left: number;
  top: number;
  width: number;
  height: number;
  divRef: (el: HTMLDivElement | null) => void;
  onTap: () => void;
}

const MovablePiece = React.memo(function MovablePiece({
  slotIndex, image, isSelected, isCorrect,
  left, top, width, height, divRef, onTap,
}: MovablePieceProps) {
  const gap = isCorrect || isSelected ? 0 : PIECE_GAP;
  return (
    <div
      ref={divRef}
      data-slot={slotIndex}
      onClick={onTap}
      style={{
        position: 'absolute',
        left, top, width, height,
        zIndex: isSelected ? 5 : isCorrect ? 2 : 3,
        touchAction: 'manipulation',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        cursor: 'pointer',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: gap,
          overflow: 'hidden',
          transition: 'inset 0.22s cubic-bezier(0.34,1.56,0.64,1)',
          boxShadow: isSelected
            ? '0 4px 22px rgba(0,0,0,0.7)'
            : isCorrect
            ? 'none'
            : '0 3px 10px rgba(0,0,0,0.55)',
        }}
      >
        <img
          src={image}
          alt=""
          draggable={false}
          style={{ width: '100%', height: '100%', display: 'block', pointerEvents: 'none', imageRendering: 'crisp-edges' }}
        />
        {isSelected && (
          <div
            aria-hidden
            style={{
              position: 'absolute', inset: 0,
              border: `2px solid ${COLORS.gold}`,
              boxShadow: `0 0 18px rgba(212,175,55,0.8), inset 0 0 8px rgba(212,175,55,0.15)`,
              pointerEvents: 'none',
            }}
          />
        )}
      </div>
    </div>
  );
});

// ── HUD icons ─────────────────────────────────────────────────────────────────

function BurgerIcon() {
  return (
    <svg width="20" height="16" viewBox="0 0 20 16" fill="none">
      <rect x="0" y="0" width="20" height="2.5" rx="1.25" fill={COLORS.gold} />
      <rect x="2" y="6.75" width="16" height="2.5" rx="1.25" fill={COLORS.gold} />
      <rect x="4" y="13.5" width="12" height="2.5" rx="1.25" fill={COLORS.gold} />
    </svg>
  );
}

function CoinIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <circle cx="7.5" cy="7.5" r="6.5" fill={COLORS.gold} opacity="0.95" />
      <circle cx="7.5" cy="7.5" r="4.5" fill="none" stroke="rgba(26,15,0,0.4)" strokeWidth="0.8" />
      <text x="7.5" y="10.5" textAnchor="middle" fontFamily="serif" fontSize="7" fontWeight="bold" fill="#1a0f00" opacity="0.6">✦</text>
    </svg>
  );
}

function LampIcon({ dim }: { dim: boolean }) {
  const col = dim ? 'rgba(212,175,55,0.3)' : COLORS.gold;
  return (
    <svg width="20" height="22" viewBox="0 0 20 22" fill="none">
      <path
        d="M10 2C6.69 2 4 4.69 4 8c0 2.21 1.19 4.14 2.97 5.22V15h6.06v-1.78C14.81 12.14 16 10.21 16 8c0-3.31-2.69-6-6-6Z"
        fill={dim ? 'rgba(212,175,55,0.15)' : 'rgba(212,175,55,0.25)'}
        stroke={col}
        strokeWidth="1.4"
      />
      <rect x="7" y="15" width="6" height="1.5" rx="0.5" fill={col} />
      <rect x="7.5" y="17" width="5" height="1.5" rx="0.5" fill={col} />
      {!dim && <circle cx="7.5" cy="7" r="1.2" fill="rgba(255,255,200,0.6)" />}
    </svg>
  );
}

function AudioToggleRow({ label, on, onToggle }: { label: string; on: boolean; onToggle: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 2px' }}>
      <span style={{ fontFamily: 'var(--font-heading)', fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: COLORS.sandstone, opacity: 0.8 }}>{label}</span>
      <button
        onClick={onToggle}
        style={{
          background: on ? 'rgba(212,175,55,0.15)' : 'rgba(255,255,255,0.05)',
          border: `1px solid ${on ? COLORS.gold : 'rgba(212,175,55,0.25)'}`,
          borderRadius: '20px', padding: '3px 12px',
          fontFamily: 'var(--font-heading)', fontSize: '10px', letterSpacing: '1.5px',
          textTransform: 'uppercase', color: on ? COLORS.gold : 'rgba(212,175,55,0.35)',
          cursor: 'pointer', transition: 'all 0.18s ease',
        }}
      >{on ? 'ON' : 'OFF'}</button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function SwapPuzzleBoard() {
  const selectedLevelId = useLevelStore((s) => s.selectedLevelId);
  const coins = usePlayerStore((s) => s.coins);
  const hints = usePlayerStore((s) => s.hints);
  const musicMuted = useAudioStore((s) => s.musicMuted);
  const sfxMuted = useAudioStore((s) => s.sfxMuted);

  const grid = useSwapStore((s) => s.grid);
  const selectedSlot = useSwapStore((s) => s.selectedSlot);
  const attemptsLeft = useSwapStore((s) => s.attemptsLeft);
  const maxAttempts = useSwapStore((s) => s.maxAttempts);
  const isLoaded = useSwapStore((s) => s.isLoaded);
  const isAnimating = useSwapStore((s) => s.isAnimating);

  const [levelData, setLevelData] = useState<LoadedLevel | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [layout, setLayout] = useState<BoardLayout | null>(null);
  const [texturesReady, setTexturesReady] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showGameOver, setShowGameOver] = useState(false);
  const [showParticles, setShowParticles] = useState(false);
  const [particleOrigin, setParticleOrigin] = useState({ x: 0, y: 0 });
  const [showChest, setShowChest] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialSlots, setTutorialSlots] = useState<{ aCx: number; aCy: number; bCx: number; bCy: number } | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [insufficientCoins, setInsufficientCoins] = useState<string | null>(null);

  type Phase = 'preview' | 'shuffling' | 'playing';
  const [phase, setPhase] = useState<Phase>('playing');
  const [countdown, setCountdown] = useState(3);

  const [idleHintSlots, setIdleHintSlots] = useState<{ aCx: number; aCy: number; bCx: number; bCy: number } | null>(null);
  const [idleHintKey, setIdleHintKey] = useState(0);
  const [hintDisplay, setHintDisplay] = useState<{ slotA: number; slotB: number } | null>(null);
  const [showHintPurchase, setShowHintPurchase] = useState(false);
  const [hintNoMove, setHintNoMove] = useState(false);
  const hintNoMoveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const areaRef = useRef<HTMLDivElement>(null);
  const boardContainerRef = useRef<HTMLDivElement>(null);
  const boardGlowRef = useRef<HTMLDivElement>(null);
  const tileRefs = useRef<Map<number, HTMLDivElement | null>>(new Map());
  const winTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleRepeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wasCompleteRef = useRef(false);
  const mistakesRef = useRef(0);
  const levelStartRef = useRef(0);
  const hintBtnRef = useRef<HTMLButtonElement>(null);
  const revealedRef = useRef(false);
  const layoutRef = useRef<BoardLayout | null>(null);
  const levelDataRef = useRef<LoadedLevel | null>(null);
  const isCompleteRef = useRef(false);
  const textureSetRef = useRef<TextureSet | null>(null);
  // Keyed on levelData.cacheBust so same-level asset replacement forces re-process.
  const texturesCacheBustRef = useRef<string | null>(null);
  const phaseRef = useRef<Phase>('playing');
  const shuffledGridRef = useRef<number[]>([]);
  const countdownRef = useRef<HTMLDivElement>(null);
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  layoutRef.current = layout;
  levelDataRef.current = levelData;
  isCompleteRef.current = isComplete;
  phaseRef.current = phase;

  // ── Back button ─────────────────────────────────────────────────────────────
  useEffect(() => {
    registerBackButton(() => { if (!isComplete) setIsPaused(true); });
    return () => unregisterBackButton();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isComplete]);

  // ── Load level ──────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    // Hard-reset ALL refs synchronously before the async load begins.
    // This prevents any stale blob URLs, DOM refs, or grid data from leaking
    // into the new level's render — even if selectedLevelId hasn't changed.
    textureSetRef.current?.revoke();
    textureSetRef.current = null;
    texturesCacheBustRef.current = null;
    tileRefs.current.clear();
    shuffledGridRef.current = [];
    revealedRef.current = false;
    mistakesRef.current = 0;
    wasCompleteRef.current = false;

    useSwapStore.getState().reset();
    setLoadError(null);
    setLevelData(null);
    setLayout(null);
    setTexturesReady(false);

    async function load() {
      try {
        const data = await loadLevel(String(selectedLevelId));
        if (cancelled) return;

        // loadLevel() has already decoded every tile/board/guide image, so the
        // board will paint atomically from cache (no progressive pop-in).
        console.log(`[TILES READY] level-${selectedLevelId}: ${data.tileImages.size} tiles decoded & cached`);

        if (import.meta.env.DEV) {
          console.log('[SwapBoard] ACTIVE LEVEL:', selectedLevelId);
          console.log('[SwapBoard] BOARD SRC:', data.boardSrc);
          console.log('[SwapBoard] GUIDE SRC:', data.guideSrc);
          console.log('[SwapBoard] TILE MAP:', data.tileImageMap);
        }

        setLevelData(data);

        const { rows, cols } = data.manifest;
        const total = rows * cols;
        const maxAtt = data.economy.maxAttempts;
        const saved = loadSwapState(selectedLevelId, total);

        if (saved) {
          shuffledGridRef.current = saved.grid;
          useSwapStore.getState().initBoard(
            `level-${selectedLevelId}`, saved.grid, saved.attemptsLeft, maxAtt,
            cols, rows, data.lockedSlots,
          );
          setPhase('playing');
          phaseRef.current = 'playing';
          levelStartRef.current = Date.now();
        } else {
          const shuffled = createShuffledGrid(data.lockedSlots, total);
          shuffledGridRef.current = shuffled;
          const solvedGrid = Array.from({ length: total }, (_: unknown, i: number) => i + 1);
          useSwapStore.getState().initBoard(
            `level-${selectedLevelId}`, solvedGrid, maxAtt, maxAtt,
            cols, rows, data.lockedSlots,
          );
          setPhase('preview');
          phaseRef.current = 'preview';
          setCountdown(3);
        }
        console.log(`[BOARD READY] level-${selectedLevelId}: rendering ${total} slots from preloaded cache`);
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Failed to load level');
      }
    }

    load();
    return () => {
      cancelled = true;
      useSwapStore.getState().reset();
    };
  }, [selectedLevelId]);

  // ── Layout measurement ──────────────────────────────────────────────────────
  const measure = useCallback(() => {
    const area = areaRef.current;
    if (!area || !levelData) return;
    const rect = area.getBoundingClientRect();
    const { imageWidth, imageHeight, cols, rows } = levelData.manifest;
    setLayout(computeSwapLayout(
      rect, imageWidth, imageHeight, cols, rows, 4,
      levelData.manifest.tiling,
    ));
  }, [levelData]);

  useEffect(() => {
    if (!isLoaded || !levelData) return;
    measure();
    const ro = new ResizeObserver(measure);
    if (areaRef.current) ro.observe(areaRef.current);
    window.addEventListener('resize', measure);
    window.addEventListener('orientationchange', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('orientationchange', measure);
    };
  }, [isLoaded, levelData, measure]);

  // ── Tile texture processing ──────────────────────────────────────────────────
  // Guard uses levelData.cacheBust (= Date.now() at load time) so that replacing
  // assets on disk and reloading the level always forces a full re-process,
  // even when selectedLevelId hasn't changed.
  useEffect(() => {
    if (!levelData || !layout) return;
    if (texturesCacheBustRef.current === levelData.cacheBust) return;

    texturesCacheBustRef.current = levelData.cacheBust;
    setTexturesReady(false);
    // Revoke any blobs that may have been created before this guard fires.
    const prev = textureSetRef.current;
    if (prev) { prev.revoke(); textureSetRef.current = null; }

    let cancelled = false;
    const dpr = window.devicePixelRatio || 1;

    // Build source tile URL map from loaded level
    const sourceTileUrls = new Map<number, string>(
      Object.entries(levelData.tileImageMap).map(([id, url]) => [Number(id), url]),
    );

    // Pass the maximum column/row dimension so the qualityInfo metadata uses
    // the largest cell as the nominal reference. Per-tile upscaling inside
    // processTileTextures derives each tile's target from its own naturalWidth/
    // naturalHeight — these args are only used for the report, not for scaling.
    const maxCellW = Math.max(...layout.colWidths);
    const maxCellH = Math.max(...layout.rowHeights);

    processTileTextures(
      sourceTileUrls,
      levelData.guideSrc,
      maxCellW,
      maxCellH,
      dpr,
    ).then((ts) => {
      if (cancelled) { ts.revoke(); return; }
      textureSetRef.current = ts;
      setTexturesReady(true);

      if (import.meta.env.DEV) {
        console.log('[SwapBoard] TEXTURE URLS (blob map):', ts.tileUrls);
        const lay = layoutRef.current;
        const data = levelDataRef.current;

        // ── [TILE AUDIT] forensic log ────────────────────────────────────
        // Prints source vs. render dimensions for every tile so non-uniform
        // row/column size corruption is immediately visible in DevTools.
        if (data && lay) {
          const { cols: auditCols, rows: auditRows } = data.manifest;
          for (const tile of data.tiles) {
            const renderW = lay.colWidths[tile.correctCol] ?? lay.cellW;
            const renderH = lay.rowHeights[tile.correctRow] ?? lay.cellH;
            const srcW    = tile.width  ?? '?';
            const srcH    = tile.height ?? '?';
            console.log(
              `[TILE AUDIT] tile_id=${tile.id} ` +
              `source=${srcW}×${srcH} ` +
              `render=${renderW}×${renderH} ` +
              `slot=${tile.correctRow},${tile.correctCol} ` +
              `(grid ${auditRows}r×${auditCols}c)`,
            );
          }
        }

        (window as unknown as Record<string, unknown>).__swapDebug = {
          downloadReport: () => {
            if (!data) return;
            const report = buildQualityReport(
              selectedLevelId,
              ts.qualityInfo,
              lay?.width ?? 0,
              lay?.height ?? 0,
              data.tiles.length,
            );
            console.info('[renderQuality] Report:', report);
            downloadQualityReport(report);
          },
          debugSharpness: async () => {
            if (!data || !lay) return;
            const firstTile = data.tiles[0];
            if (!firstTile) return;
            const originalSrc = data.tileImageMap[firstTile.id] ?? '';
            const processedSrc = ts.tileUrls.get(firstTile.id) ?? originalSrc;
            // Use the largest cell as the debug canvas reference size
            const dbgW = Math.max(...lay.colWidths);
            const dbgH = Math.max(...lay.rowHeights);
            await generateSharpnessDebug(originalSrc, processedSrc, dbgW, dbgH, dpr);
          },
        };
        console.info('[renderQuality] Debug API ready. Call window.__swapDebug.downloadReport() or .debugSharpness()');
      }
    }).catch((err) => {
      console.warn('[renderQuality] Tile texture processing failed, using originals:', err);
      if (!cancelled) setTexturesReady(true); // still allow play with originals
    });

    return () => { cancelled = true; };
  // levelData identity changes on every loadLevel() call; layout !== null is a
  // boolean dep so the effect re-runs when layout first becomes available.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levelData, layout !== null]);

  useEffect(() => {
    return () => {
      textureSetRef.current?.revoke();
      textureSetRef.current = null;
      texturesCacheBustRef.current = null;
      tileRefs.current.clear();
      if (import.meta.env.DEV) delete (window as unknown as Record<string, unknown>).__swapDebug;
    };
  }, [selectedLevelId]);

  // ── Forensic debug logs (DEV only) ──────────────────────────────────────────
  useEffect(() => {
    if (!import.meta.env.DEV || !texturesReady || grid.length === 0) return;
    console.log('[SwapBoard] GRID:', grid);
    console.log('[SwapBoard] TEXTURE URLS:', textureSetRef.current?.tileUrls);
  }, [texturesReady, grid]);

  // ── Preview countdown ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isLoaded || !layout || phase !== 'preview' || !texturesReady) return;
    setCountdown(3);
    const t1 = setTimeout(() => setCountdown(2), 1000);
    const t2 = setTimeout(() => setCountdown(1), 2000);
    const t3 = setTimeout(() => {
      setPhase('shuffling');
      phaseRef.current = 'shuffling';
    }, 3000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, layout !== null, phase, texturesReady]);

  useEffect(() => {
    if (phase !== 'preview' || !countdownRef.current) return;
    const el = countdownRef.current;
    const tl = gsap.timeline();
    tl.fromTo(el, { opacity: 0, scale: 1.55, y: -6 }, { opacity: 1, scale: 1, y: 0, duration: 0.38, ease: 'back.out(2.5)' });
    tl.to(el, { opacity: 0, scale: 0.7, y: 8, duration: 0.24, ease: 'power2.in' }, '+=0.55');
    return () => { tl.kill(); };
  }, [countdown, phase]);

  // ── Shuffle animation ────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'shuffling') return;
    const layout = layoutRef.current;
    const levelData = levelDataRef.current;
    if (!layout || !levelData) return;

    const shuffled = shuffledGridRef.current;
    const { cols, rows } = levelData.manifest;
    const total = rows * cols;
    const lockedSlots = levelData.lockedSlots;

    const movingTiles: Array<{ el: HTMLDivElement; dx: number; dy: number }> = [];

    for (let tileId = 1; tileId <= total; tileId++) {
      const solvedSlot = tileId - 1;
      if (lockedSlots.has(solvedSlot)) continue;
      const shuffledSlot = shuffled.indexOf(tileId);
      if (shuffledSlot === solvedSlot) continue;
      const el = tileRefs.current.get(solvedSlot);
      if (!el) continue;
      const solvedCol = solvedSlot % cols;
      const shuffledCol = shuffledSlot % cols;
      const dx = layout.colEdges[shuffledCol] - layout.colEdges[solvedCol];
      const dy = layout.rowEdges[Math.floor(shuffledSlot / cols)] - layout.rowEdges[Math.floor(solvedSlot / cols)];
      movingTiles.push({ el, dx, dy });
    }

    // The shuffle animation is PURELY decorative. The board's correct visual
    // state is "every tile flat at its grid slot, zero transform" — and that
    // MUST hold whether the animation finishes, gets interrupted by a layout/
    // viewport change, has a killed tween, or is frozen by a throttled rAF
    // ticker (backgrounded tab). `finish()` is therefore idempotent and always
    // clears every tile's transform; it is reached three independent ways:
    // the timeline's onComplete, a wall-clock safety timeout, and effect cleanup.
    let finished = false;
    const tweens: gsap.core.Tween[] = [];
    let safety: ReturnType<typeof setTimeout> | undefined;

    function finish() {
      if (finished) return;
      finished = true;
      if (safety) clearTimeout(safety);
      tweens.forEach((t) => t.kill());
      // clearProps fully removes the inline transform (not just set it to identity),
      // so no tile can be left displaced — eliminates the black-hole gaps.
      tileRefs.current.forEach((el) => { if (el) gsap.set(el, { clearProps: 'transform' }); });

      const d = levelDataRef.current!;
      const { cols: c, rows: r } = d.manifest;
      const t = c * r;
      const maxAtt = d.economy.maxAttempts;

      const nullSlots = shuffled.map((v, i) => (v == null || typeof v !== 'number' || v < 1 || v > t) ? i : -1).filter(i => i >= 0);
      if (nullSlots.length > 0) {
        throw new Error(`[BOARD AUDIT] INVALID BOARD: NULL SLOT DETECTED at [${nullSlots.join(', ')}]`);
      }

      useSwapStore.getState().initBoard(
        `level-${selectedLevelId}`, shuffled, maxAtt, maxAtt, c, r, d.lockedSlots,
      );
      setPhase('playing');
      phaseRef.current = 'playing';
      levelStartRef.current = Date.now();
    }

    if (movingTiles.length === 0) { finish(); return; }

    movingTiles.forEach(({ el, dx, dy }) => {
      tweens.push(gsap.to(el, { x: dx, y: dy, duration: 0.88, ease: 'power3.inOut' }));
      tweens.push(gsap.to(el, { scale: 1.08, duration: 0.42, ease: 'power2.out', yoyo: true, repeat: 1 }));
    });
    // Single completion signal off the longest (position) tween.
    tweens[0].eventCallback('onComplete', finish);
    // Wall-clock fallback: fires even if the rAF ticker is paused/throttled so the
    // animation never reaches onComplete. Generous margin over the 0.88s tween.
    safety = setTimeout(finish, 1500);

    // If the effect tears down mid-shuffle (unmount, level change), snap tiles
    // flat rather than leaving them frozen at in-flight positions.
    return () => {
      if (safety) clearTimeout(safety);
      tweens.forEach((t) => t.kill());
      if (!finished) {
        tileRefs.current.forEach((el) => { if (el) gsap.set(el, { clearProps: 'transform' }); });
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, selectedLevelId]);

  // ── Board entrance animation ─────────────────────────────────────────────────
  useLayoutEffect(() => {
    if (!layout || !boardContainerRef.current || revealedRef.current) return;
    revealedRef.current = true;
    try {
      gsap.fromTo(
        boardContainerRef.current,
        { opacity: 0, scale: 0.96 },
        { opacity: 1, scale: 1, duration: TIMINGS.boardReveal, ease: 'power2.out', clearProps: 'scale' },
      );
    } catch { /* noop */ }
  }, [layout]);

  // ── Idle hint system ─────────────────────────────────────────────────────────
  const showHintMove = useCallback(() => {
    const data = levelDataRef.current;
    const lay = layoutRef.current;
    if (isCompleteRef.current || !data || !lay) return;

    const { cols, rows } = data.manifest;
    const total = rows * cols;
    const { grid: currentGrid } = useSwapStore.getState();
    const move = findBestMove(currentGrid, cols, total, data.lockedSlots);
    if (!move) return;

    const [slotA, slotB] = move;
    const cA = slotCenter(slotA, cols, lay);
    const cB = slotCenter(slotB, cols, lay);

    setIdleHintSlots({
      aCx: lay.left + cA.x,
      aCy: lay.top + cA.y,
      bCx: lay.left + cB.x,
      bCy: lay.top + cB.y,
    });
    setIdleHintKey(k => k + 1);
  }, []);

  const resetIdleTimer = useCallback(() => {
    setIdleHintSlots(null);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (idleRepeatRef.current) clearInterval(idleRepeatRef.current);
    if (isCompleteRef.current) return;
    idleTimerRef.current = setTimeout(() => {
      showHintMove();
      idleRepeatRef.current = setInterval(showHintMove, 4000);
    }, 10_000);
  }, [showHintMove]);

  useEffect(() => {
    if (!isLoaded || isComplete || phase !== 'playing') return;
    resetIdleTimer();
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (idleRepeatRef.current) clearInterval(idleRepeatRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, phase]);

  useEffect(() => {
    if (!isComplete) return;
    setIdleHintSlots(null);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (idleRepeatRef.current) clearInterval(idleRepeatRef.current);
  }, [isComplete]);

  // ── Tutorial trigger ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isLoaded || !layout || selectedLevelId !== 1 || isTutorialDone() || grid.length === 0) return;
    if (phase !== 'playing') return;

    const data = levelData;
    if (!data) return;
    const { cols, rows } = data.manifest;
    const total = rows * cols;
    const move = findBestMove(grid, cols, total, data.lockedSlots);
    if (!move) return;

    const [slotA, slotB] = move;
    const cA = slotCenter(slotA, cols, layout);
    const cB = slotCenter(slotB, cols, layout);

    const t = setTimeout(() => {
      setTutorialSlots({
        aCx: layout.left + cA.x,
        aCy: layout.top + cA.y,
        bCx: layout.left + cB.x,
        bCy: layout.top + cB.y,
      });
      setShowTutorial(true);
    }, 600);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, layout !== null, selectedLevelId, phase]);

  // ── Smart hint tile pulse ────────────────────────────────────────────────────
  useEffect(() => {
    if (!hintDisplay) return;
    const elA = tileRefs.current.get(hintDisplay.slotA);
    const elB = tileRefs.current.get(hintDisplay.slotB);
    [elA, elB].forEach((el) => {
      if (!el) return;
      gsap.to(el, { scale: 1.07, duration: 0.32, ease: 'power2.inOut', yoyo: true, repeat: -1 });
    });
    return () => {
      [elA, elB].forEach((el) => {
        if (el) { gsap.killTweensOf(el); gsap.set(el, { scale: 1 }); }
      });
    };
  }, [hintDisplay]);

  // ── Swap animation + logic ───────────────────────────────────────────────────
  const performSwap = useCallback((slotA: number, slotB: number) => {
    const data = levelDataRef.current;
    const lay = layoutRef.current;
    const cols = data?.manifest.cols ?? 4;

    const currentGrid = useSwapStore.getState().grid;
    const good = isGoodSwap(currentGrid, slotA, slotB, cols);

    useSwapStore.getState().setAnimating(true);

    const elA = tileRefs.current.get(slotA) ?? null;
    const elB = tileRefs.current.get(slotB) ?? null;

    const colA = slotA % cols, rowA = Math.floor(slotA / cols);
    const colB = slotB % cols, rowB = Math.floor(slotB / cols);

    const dx = lay ? lay.colEdges[colB] - lay.colEdges[colA] : 0;
    const dy = lay ? lay.rowEdges[rowB] - lay.rowEdges[rowA] : 0;

    const onAnimDone = () => {
      if (elA) gsap.set(elA, { x: 0, y: 0, zIndex: 1 });
      if (elB) gsap.set(elB, { x: 0, y: 0, zIndex: 1 });

      useSwapStore.getState().doSwap(slotA, slotB, good);

      if (!good) {
        mistakesRef.current += 1;
        saveSystem.trackMistake();
        hapticsManager.trigger('warning');
      } else {
        if (lay) {
          const cellW = lay.colWidths[colA] ?? lay.cellW;
          const cellH = lay.rowHeights[rowA] ?? lay.cellH;
          if (isTileImproved(currentGrid[slotB], slotA, cols)) {
            const rect = { left: lay.left + lay.colEdges[colA], top: lay.top + lay.rowEdges[rowA], width: cellW, height: cellH };
            triggerSnapFX(rect);
            usePlayerStore.getState().addCoins(CONFIG.coins.perSnap);
            spawnCoinReward(CONFIG.coins.perSnap, rect.left + cellW / 2, rect.top + cellH / 2);
          }
          const cellWB = lay.colWidths[colB] ?? lay.cellW;
          const cellHB = lay.rowHeights[rowB] ?? lay.cellH;
          if (isTileImproved(currentGrid[slotA], slotB, cols)) {
            const rect = { left: lay.left + lay.colEdges[colB], top: lay.top + lay.rowEdges[rowB], width: cellWB, height: cellHB };
            triggerSnapFX(rect);
            usePlayerStore.getState().addCoins(CONFIG.coins.perSnap);
            spawnCoinReward(CONFIG.coins.perSnap, rect.left + cellWB / 2, rect.top + cellHB / 2);
          }
        }
        audioManager.play('snap');
        hapticsManager.trigger('success');
      }

      syncManager.bumpVersion();
      saveSwapState(selectedLevelId);

      const state = useSwapStore.getState();
      if (state.isSolved && !wasCompleteRef.current && phaseRef.current === 'playing') {
        wasCompleteRef.current = true;
        triggerWin();
      } else if (state.attemptsLeft === 0 && !wasCompleteRef.current && phaseRef.current === 'playing') {
        wasCompleteRef.current = true;
        setTimeout(() => setShowGameOver(true), 600);
      }
    };

    if (elA && elB && lay) {
      gsap.set(elA, { zIndex: 5 });
      gsap.set(elB, { zIndex: 4 });
      gsap.to(elA, { x: dx, y: dy, duration: 0.22, ease: 'power2.out' });
      gsap.to(elB, { x: -dx, y: -dy, duration: 0.22, ease: 'power2.out', onComplete: onAnimDone });
    } else {
      onAnimDone();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLevelId]);

  // ── Tile tap ─────────────────────────────────────────────────────────────────
  const handleTileTap = useCallback((slotIndex: number) => {
    if (phaseRef.current !== 'playing') return;

    const data = levelDataRef.current;
    const lockedSlots = data?.lockedSlots ?? new Set<number>();

    resetIdleTimer();
    setShowTutorial(false);
    setIdleHintSlots(null);

    if (hintDisplay) {
      setHintDisplay(null);
      if (hintTimerRef.current) { clearTimeout(hintTimerRef.current); hintTimerRef.current = null; }
    }

    if (isComplete || isAnimating || lockedSlots.has(slotIndex) || showGameOver || isPaused) return;

    const { selectedSlot: cur } = useSwapStore.getState();

    if (cur === null) {
      useSwapStore.getState().selectSlot(slotIndex);
      audioManager.play('click');
      hapticsManager.trigger('light');
    } else if (cur === slotIndex) {
      useSwapStore.getState().deselectSlot();
      hapticsManager.trigger('light');
    } else {
      performSwap(cur, slotIndex);
    }
  }, [isComplete, isAnimating, showGameOver, isPaused, performSwap, resetIdleTimer, hintDisplay]);

  // ── Win sequence ─────────────────────────────────────────────────────────────
  const triggerWin = useCallback(() => {
    setIsComplete(true);
    clearSwapState(selectedLevelId);

    audioManager.stopBg(400);
    audioManager.play('win');
    hapticsManager.trigger('win');

    const lay = layoutRef.current;
    const boardCx = lay ? lay.left + lay.width / 2 : window.innerWidth / 2;
    const boardCy = lay ? lay.top + lay.height / 2 : window.innerHeight * 0.4;

    setParticleOrigin({ x: boardCx, y: boardCy });
    setShowParticles(true);
    spawnScreenEdgeFlash();
    spawnMosaicShards(boardCx, boardCy);
    spawnWinConfetti();
    spawnCoinSparkles();

    const currentHintUsed = useSwapStore.getState().hintUsed;
    const earnedStars = currentHintUsed ? 1 : mistakesRef.current === 0 ? 3 : 2;
    const player = usePlayerStore.getState();
    player.completeLevel(selectedLevelId, earnedStars);
    saveSystem.trackWin();
    syncManager.bumpVersion();
    sync.levelComplete(selectedLevelId, earnedStars);

    const elapsedMs = levelStartRef.current > 0 ? Date.now() - levelStartRef.current : Infinity;
    const breakdown = calcLevelReward(earnedStars, elapsedMs, selectedLevelId);
    setLastWinPayload({ breakdown, earnedStars });

    player.addCoins(breakdown.total);
    spawnCoinReward(breakdown.base, boardCx, boardCy);
    if (breakdown.perfectBonus > 0)
      setTimeout(() => spawnCoinReward(breakdown.perfectBonus, boardCx, boardCy - 44), 240);
    if (breakdown.speedBonus > 0)
      setTimeout(() => spawnCoinReward(breakdown.speedBonus, boardCx, boardCy - 86), 480);

    const glowEl = boardGlowRef.current;
    if (glowEl) {
      try {
        const half = TIMINGS.winGlowWave * 0.5;
        gsap.to(glowEl, { opacity: 0.8, duration: half, ease: 'power2.out' });
        setTimeout(() => gsap.to(glowEl, { opacity: 0, duration: half, ease: 'power2.in' }), half * 1000);
      } catch { /* noop */ }
    }

    const spawnChest = Math.random() < CONFIG.chest.spawnChance;
    if (winTimerRef.current) clearTimeout(winTimerRef.current);
    winTimerRef.current = setTimeout(() => {
      if (spawnChest) setShowChest(true);
      else useUIStore.getState().setScene('win');
    }, TIMINGS.winSceneDelay * 1000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLevelId]);

  // ── Hint economy ─────────────────────────────────────────────────────────────
  const handleBuyHints = useCallback((pack: { count: number; cost: number }) => {
    const ok = usePlayerStore.getState().spendCoins(pack.cost);
    if (!ok) {
      setInsufficientCoins(`Need ${pack.cost} coins`);
      setTimeout(() => setInsufficientCoins(null), 2500);
      return;
    }
    usePlayerStore.getState().addHints(pack.count);
    setShowHintPurchase(false);
    if (hintBtnRef.current) {
      try {
        gsap.timeline()
          .to(hintBtnRef.current, { scale: 1.25, duration: 0.18, ease: 'back.out(3)' })
          .to(hintBtnRef.current, { scale: 1, duration: 0.18, ease: 'power2.out' });
      } catch { /* noop */ }
    }
    hapticsManager.trigger('success');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showNoMoveNotice = useCallback(() => {
    if (hintNoMoveTimerRef.current) clearTimeout(hintNoMoveTimerRef.current);
    setHintNoMove(true);
    hintNoMoveTimerRef.current = setTimeout(() => {
      setHintNoMove(false);
      hintNoMoveTimerRef.current = null;
    }, 2000);
  }, []);

  const handleHint = useCallback(() => {
    if (isComplete || phaseRef.current !== 'playing') return;

    const currentHints = usePlayerStore.getState().hints;
    if (currentHints === 0) { setShowHintPurchase(true); return; }

    const data = levelDataRef.current;
    const lay = layoutRef.current;
    if (!data || !lay) return;

    const { cols, rows } = data.manifest;
    const total = rows * cols;
    const currentGrid = useSwapStore.getState().grid;
    const currentSelected = useSwapStore.getState().selectedSlot;

    let slotA: number, slotB: number;
    if (currentSelected !== null) {
      const tileId = currentGrid[currentSelected];
      const correctSlot = tileId - 1;
      if (correctSlot === currentSelected) {
        const move = findBestMove(currentGrid, cols, total, data.lockedSlots);
        if (!move) { showNoMoveNotice(); return; }
        [slotA, slotB] = move;
      } else {
        slotA = currentSelected;
        slotB = correctSlot;
      }
    } else {
      const move = findBestMove(currentGrid, cols, total, data.lockedSlots);
      if (!move) { showNoMoveNotice(); return; }
      [slotA, slotB] = move;
    }

    usePlayerStore.getState().useHint();
    useSwapStore.getState().setHintUsed(true);

    if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
    setHintDisplay({ slotA, slotB });
    hintTimerRef.current = setTimeout(() => {
      setHintDisplay(null);
      hintTimerRef.current = null;
    }, 2500);

    audioManager.play('hint');
    hapticsManager.trigger('medium');
    saveSystem.trackHintUsed();

    if (hintBtnRef.current) {
      try {
        gsap.timeline()
          .to(hintBtnRef.current, { scale: 1.15, duration: 0.13, ease: 'power2.out' })
          .to(hintBtnRef.current, { scale: 1, duration: 0.13, ease: 'back.out(2)' });
      } catch { /* noop */ }
    }
  }, [isComplete]);

  // ── Replay ───────────────────────────────────────────────────────────────────
  const handleReplay = useCallback(() => {
    const data = levelDataRef.current;
    if (winTimerRef.current) { clearTimeout(winTimerRef.current); winTimerRef.current = null; }
    if (hintTimerRef.current) { clearTimeout(hintTimerRef.current); hintTimerRef.current = null; }
    setIsPaused(false);
    setShowGameOver(false);
    setIsComplete(false);
    setShowParticles(false);
    setShowChest(false);
    setInsufficientCoins(null);
    setHintNoMove(false);
    if (hintNoMoveTimerRef.current) { clearTimeout(hintNoMoveTimerRef.current); hintNoMoveTimerRef.current = null; }
    setIdleHintSlots(null);
    setHintDisplay(null);
    setShowHintPurchase(false);
    wasCompleteRef.current = false;
    mistakesRef.current = 0;
    revealedRef.current = false;
    clearSwapState(selectedLevelId);
    useSwapStore.getState().reset();

    const cols = data?.manifest.cols ?? 4;
    const rows = data?.manifest.rows ?? 4;
    const total = cols * rows;
    const maxAtt = data?.economy.maxAttempts ?? 30;
    const lockedSlots = data?.lockedSlots ?? new Set<number>();

    const freshShuffle = createShuffledGrid(lockedSlots, total);
    shuffledGridRef.current = freshShuffle;
    const solvedGrid = Array.from({ length: total }, (_: unknown, i: number) => i + 1);
    useSwapStore.getState().initBoard(`level-${selectedLevelId}`, solvedGrid, maxAtt, maxAtt, cols, rows, lockedSlots);
    // Reset cache key so replay re-processes textures if layout changes.
    texturesCacheBustRef.current = null;
    setCountdown(3);
    setPhase('preview');
    phaseRef.current = 'preview';
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLevelId]);

  const handleExit = useCallback(() => {
    useUIStore.getState().setScene('mainMenu');
  }, []);

  // ── Render guards ─────────────────────────────────────────────────────────────
  if (loadError) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, padding: 32 }}>
        <p style={{ fontFamily: 'var(--font-heading)', fontSize: '14px', color: COLORS.gold, letterSpacing: '2px' }}>Could not load level</p>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: COLORS.sandstone, opacity: 0.7 }}>{loadError}</p>
        <button onClick={handleExit} style={{ marginTop: 8, padding: '10px 28px', background: 'transparent', border: `1px solid ${COLORS.gold}`, borderRadius: 2, color: COLORS.gold, fontFamily: 'var(--font-heading)', fontSize: '11px', letterSpacing: '2px', cursor: 'pointer' }}>Back to Menu</button>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ fontFamily: 'var(--font-heading)', fontSize: '14px', color: COLORS.gold, letterSpacing: '2px' }}>Restoring mosaic…</p>
      </div>
    );
  }

  const iconBtn: React.CSSProperties = {
    background: 'none', border: 'none', cursor: 'pointer', padding: '6px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: '4px', flexShrink: 0,
  };

  const cols = levelData?.manifest.cols ?? 4;
  const lockedSlots = levelData?.lockedSlots ?? new Set<number>();
  const correctCount = grid.filter((t, i) => t === i + 1).length;
  const progressPct = phase === 'playing' && grid.length
    ? Math.round((correctCount / grid.length) * 100)
    : 0;

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* ── HUD ───────────────────────────────────────────────────────────── */}
      <div style={{
        flexShrink: 0, display: 'flex', flexDirection: 'column',
        background: 'linear-gradient(180deg, rgba(26,15,0,0.99) 0%, rgba(18,10,0,0.97) 100%)',
        borderBottom: '1px solid rgba(212,175,55,0.18)',
        boxShadow: '0 2px 12px rgba(0,0,0,0.5)', position: 'relative', zIndex: 10,
      }}>
        <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <button
              onClick={isComplete ? undefined : () => { hapticsManager.trigger('light'); setIsPaused(true); }}
              style={iconBtn}
              aria-label="Pause menu"
            >
              <BurgerIcon />
            </button>
            <button
              onClick={() => { if (!isComplete) useUIStore.getState().setShopOpen(true); }}
              style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '20px', background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.25)', cursor: 'pointer', fontFamily: 'var(--font-heading)', fontSize: '12px', fontWeight: 600, letterSpacing: '0.5px', color: COLORS.gold }}
              aria-label="Open shop"
            >
              <CoinIcon />
              <span style={{ minWidth: '12px', textAlign: 'center' }}>{coins}</span>
            </button>
          </div>

          <div style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '13px', letterSpacing: '3px', textTransform: 'uppercase', color: COLORS.gold, textShadow: '0 0 14px rgba(212,175,55,0.4)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Level {selectedLevelId}
            </div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: '9px', letterSpacing: '2px', color: COLORS.sandstone, opacity: 0.55, marginTop: '1px' }}>
              SWAP PUZZLE
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '13px', lineHeight: 1 }}>❤</span>
                <span style={{ fontFamily: 'var(--font-heading)', fontSize: '12px', fontWeight: 700, letterSpacing: '1px', color: attemptsLeft <= 3 ? '#CC2200' : COLORS.gold }}>
                  {attemptsLeft}/{maxAttempts}
                </span>
              </div>
              <span style={{ fontFamily: 'var(--font-heading)', fontSize: '8px', letterSpacing: '1px', color: COLORS.sandstone, opacity: 0.55, textTransform: 'uppercase' }}>
                attempts
              </span>
            </div>

            <div style={{ width: 1, height: 18, background: 'rgba(212,175,55,0.2)', flexShrink: 0 }} />

            <button
              ref={hintBtnRef}
              onClick={!isComplete ? handleHint : undefined}
              style={{
                ...iconBtn,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px',
                opacity: isComplete ? 0.4 : 1,
                cursor: isComplete ? 'default' : 'pointer',
                transition: 'opacity 0.3s ease',
                transformOrigin: 'center center',
              }}
              aria-label={hints === 0 ? 'Buy hints' : `Use hint (${hints} left)`}
              disabled={isComplete}
            >
              <LampIcon dim={hints === 0} />
              <span style={{ fontFamily: 'var(--font-heading)', fontSize: '9px', letterSpacing: '0.5px', lineHeight: 1, color: hints === 0 ? 'rgba(212,175,55,0.35)' : COLORS.gold, fontWeight: 700, minWidth: '12px', textAlign: 'center' }}>
                {hints}
              </span>
            </button>
          </div>
        </div>

        <div style={{ position: 'absolute', bottom: 0, left: 0, height: '2px', width: `${progressPct}%`, background: `linear-gradient(90deg, ${COLORS.darkGold}, ${COLORS.gold})`, transition: 'width 0.35s ease', boxShadow: '0 0 6px rgba(212,175,55,0.6)' }} />
      </div>

      {/* ── Board area ────────────────────────────────────────────────────── */}
      <div ref={areaRef} style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' }}>
        {layout && levelData && (
          <div
            ref={boardContainerRef}
            style={{
              position: 'absolute',
              left: layout.relLeft,
              top: layout.relTop,
              width: layout.width,
              height: layout.height,
              transformOrigin: 'center center',
            }}
          >
            {/* ── Smart hint overlay ──────────────────────────────────────── */}
            {hintDisplay && (() => {
              const hA = hintDisplay.slotA, hB = hintDisplay.slotB;
              const hColA = hA % cols, hRowA = Math.floor(hA / cols);
              const hColB = hB % cols, hRowB = Math.floor(hB / cols);
              const cxA = layout.colEdges[hColA] + layout.colWidths[hColA] / 2;
              const cyA = layout.rowEdges[hRowA] + layout.rowHeights[hRowA] / 2;
              const cxB = layout.colEdges[hColB] + layout.colWidths[hColB] / 2;
              const cyB = layout.rowEdges[hRowB] + layout.rowHeights[hRowB] / 2;
              return (
                <>
                  {[
                    { slot: hA, col: hColA, row: hRowA, isSource: true },
                    { slot: hB, col: hColB, row: hRowB, isSource: false },
                  ].map(({ slot, col, row, isSource }) => (
                    <div
                      key={slot}
                      style={{
                        position: 'absolute',
                        left: layout.colEdges[col],
                        top: layout.rowEdges[row],
                        width: layout.colWidths[col],
                        height: layout.rowHeights[row],
                        border: `2.5px solid ${isSource ? '#FFA040' : COLORS.gold}`,
                        boxShadow: `0 0 18px ${isSource ? 'rgba(255,160,64,0.75)' : 'rgba(212,175,55,0.75)'}, inset 0 0 10px ${isSource ? 'rgba(255,160,64,0.15)' : 'rgba(212,175,55,0.12)'}`,
                        pointerEvents: 'none',
                        zIndex: 15,
                      }}
                    />
                  ))}
                  <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 14, overflow: 'visible' }}>
                    <defs>
                      <marker id="hint-arrow" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                        <polygon points="0 0, 8 3, 0 6" fill={COLORS.gold} fillOpacity="0.75" />
                      </marker>
                    </defs>
                    <line x1={cxA} y1={cyA} x2={cxB} y2={cyB}
                      stroke={COLORS.gold} strokeOpacity="0.65" strokeWidth="2"
                      strokeDasharray="7 4" markerEnd="url(#hint-arrow)"
                    />
                  </svg>
                </>
              );
            })()}

            {/* ── EffectsLayer: win glow ──────────────────────────────────── */}
            <div
              ref={boardGlowRef}
              aria-hidden
              style={{ position: 'absolute', inset: -20, borderRadius: '14px', pointerEvents: 'none', opacity: 0, boxShadow: '0 0 60px rgba(212,175,55,0.9), 0 0 100px rgba(212,175,55,0.5), 0 0 140px rgba(212,175,55,0.25)', zIndex: 0 }}
            />

            {/* ── Guide ghost: faint target watermark ────────────────────── */}
            {phase === 'playing' && levelData.guideSrc && (
              <img
                src={texturesReady && textureSetRef.current?.guideUrl
                  ? textureSetRef.current.guideUrl
                  : levelData.guideSrc}
                alt=""
                draggable={false}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block', opacity: 0.08, pointerEvents: 'none', zIndex: 1, imageRendering: 'crisp-edges' }}
              />
            )}

            {/* ── LockedPiecesLayer ───────────────────────────────────────── */}
            {grid.map((tileId, slotIndex) => {
              if (!lockedSlots.has(slotIndex)) return null;
              const col = slotIndex % cols;
              const row = Math.floor(slotIndex / cols);
              const img = texturesReady && textureSetRef.current?.tileUrls.has(tileId)
                ? textureSetRef.current.tileUrls.get(tileId)!
                : (levelData.tileImageMap[tileId] ?? '');
              return (
                <LockedPiece
                  key={slotIndex}
                  left={layout.colEdges[col]}
                  top={layout.rowEdges[row]}
                  width={layout.colWidths[col]}
                  height={layout.rowHeights[row]}
                  image={img}
                />
              );
            })}

            {/* ── MovablePiecesLayer ──────────────────────────────────────── */}
            {grid.map((tileId, slotIndex) => {
              if (lockedSlots.has(slotIndex)) return null;
              const col = slotIndex % cols;
              const row = Math.floor(slotIndex / cols);
              const img = texturesReady && textureSetRef.current?.tileUrls.has(tileId)
                ? textureSetRef.current.tileUrls.get(tileId)!
                : (levelData.tileImageMap[tileId] ?? '');
              return (
                <MovablePiece
                  key={slotIndex}
                  slotIndex={slotIndex}
                  image={img}
                  isSelected={selectedSlot === slotIndex}
                  isCorrect={tileId === slotIndex + 1}
                  left={layout.colEdges[col]}
                  top={layout.rowEdges[row]}
                  width={layout.colWidths[col]}
                  height={layout.rowHeights[row]}
                  divRef={(el: HTMLDivElement | null) => {
                    if (el) tileRefs.current.set(slotIndex, el);
                    else tileRefs.current.delete(slotIndex);
                  }}
                  onTap={() => handleTileTap(slotIndex)}
                />
              );
            })}
          </div>
        )}

        {/* ── Preview overlay ───────────────────────────────────────────── */}
        {phase === 'preview' && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', zIndex: 20 }}>
            {!texturesReady ? (
              <p style={{ fontFamily: 'var(--font-heading)', fontSize: '11px', letterSpacing: '3px', textTransform: 'uppercase', color: COLORS.sandstone, opacity: 0.5 }}>
                Preparing ornament…
              </p>
            ) : (
              <>
                <div
                  key={countdown}
                  ref={countdownRef}
                  style={{ fontFamily: 'var(--font-display)', fontSize: '88px', color: COLORS.gold, textShadow: '0 0 40px rgba(212,175,55,0.95), 0 0 80px rgba(212,175,55,0.45)', lineHeight: 1, opacity: 0, willChange: 'transform, opacity' }}
                >
                  {countdown}
                </div>
                <div style={{ marginTop: 14, fontFamily: 'var(--font-heading)', fontSize: '10px', letterSpacing: '3px', textTransform: 'uppercase', color: COLORS.sandstone, opacity: 0.55 }}>
                  Memorize the ornament
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Tutorial hand ─────────────────────────────────────────────────── */}
      {showTutorial && tutorialSlots && (
        <TutorialHand
          slotACx={tutorialSlots.aCx} slotACy={tutorialSlots.aCy}
          slotBCx={tutorialSlots.bCx} slotBCy={tutorialSlots.bCy}
          markTutorial sizeScale={1.0}
          onComplete={() => { setShowTutorial(false); resetIdleTimer(); }}
        />
      )}

      {/* ── Idle hint hand ────────────────────────────────────────────────── */}
      {idleHintSlots && (
        <TutorialHand
          key={idleHintKey}
          slotACx={idleHintSlots.aCx} slotACy={idleHintSlots.aCy}
          slotBCx={idleHintSlots.bCx} slotBCy={idleHintSlots.bCy}
          sizeScale={1.8}
          onComplete={() => setIdleHintSlots(null)}
        />
      )}

      <WinParticles active={showParticles} originX={particleOrigin.x} originY={particleOrigin.y} />
      <ChestModal isOpen={showChest} onClose={() => { setShowChest(false); useUIStore.getState().setScene('win'); }} />

      <Modal isOpen={showGameOver} onClose={() => {}} title="No Attempts Left" locked>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', lineHeight: 1.7, color: COLORS.sandstone, textAlign: 'center' }}>
            The mosaic was not restored in time.
          </p>
          <PrimaryButton size="md" fullWidth onClick={handleReplay}>↺ &nbsp; Retry</PrimaryButton>
          <SecondaryButton size="md" fullWidth onClick={handleExit}>✕ &nbsp; Back to Menu</SecondaryButton>
        </div>
      </Modal>

      <Modal isOpen={isPaused} onClose={() => setIsPaused(false)} title="Paused" locked={false}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <PrimaryButton size="md" fullWidth onClick={() => { hapticsManager.trigger('light'); setIsPaused(false); }}>▶ &nbsp; Resume</PrimaryButton>
          <SecondaryButton size="md" fullWidth onClick={handleReplay}>↺ &nbsp; Replay Level</SecondaryButton>
          <SecondaryButton size="md" fullWidth onClick={handleExit}>✕ &nbsp; Exit to Menu</SecondaryButton>
          <div style={{ borderTop: '1px solid rgba(212,175,55,0.12)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <AudioToggleRow label="Music" on={!musicMuted} onToggle={() => useAudioStore.getState().toggleMusic()} />
            <AudioToggleRow label="Sound FX" on={!sfxMuted} onToggle={() => useAudioStore.getState().toggleSfx()} />
          </div>
        </div>
      </Modal>

      {insufficientCoins && (
        <div style={{ position: 'fixed', bottom: 'calc(80px + var(--safe-area-bottom, 0px))', left: '50%', transform: 'translateX(-50%)', padding: '10px 20px', borderRadius: '6px', background: 'rgba(26,15,0,0.92)', border: '1px solid rgba(204,34,0,0.5)', color: COLORS.sandstone, fontFamily: 'var(--font-heading)', fontSize: '11px', letterSpacing: '1px', whiteSpace: 'nowrap', zIndex: 300, pointerEvents: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
          {insufficientCoins}
        </div>
      )}

      {hintNoMove && (
        <div style={{ position: 'fixed', bottom: 'calc(80px + var(--safe-area-bottom, 0px))', left: '50%', transform: 'translateX(-50%)', padding: '10px 20px', borderRadius: '6px', background: 'rgba(26,15,0,0.92)', border: '1px solid rgba(212,175,55,0.45)', color: COLORS.sandstone, fontFamily: 'var(--font-heading)', fontSize: '11px', letterSpacing: '1px', whiteSpace: 'nowrap', zIndex: 300, pointerEvents: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
          NO OPTIMAL MOVE AVAILABLE
        </div>
      )}

      {showHintPurchase && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'flex-end' }}
          onClick={() => setShowHintPurchase(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: '100%', background: 'linear-gradient(180deg, #1e1100 0%, #0d0700 100%)', border: '1px solid rgba(212,175,55,0.22)', borderBottom: 'none', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: `20px 20px calc(20px + var(--safe-area-bottom, 0px))`, boxShadow: '0 -8px 40px rgba(0,0,0,0.6)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 4 }}>
              <LampIcon dim={false} />
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '13px', letterSpacing: '3px', textTransform: 'uppercase', color: COLORS.gold }}>Get Hints</span>
            </div>
            <p style={{ fontFamily: 'var(--font-heading)', fontSize: '10px', letterSpacing: '1.5px', color: COLORS.sandstone, opacity: 0.6, textAlign: 'center', marginBottom: 20 }}>
              YOU HAVE {coins} COINS
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {([
                { count: 1, cost: 75 },
                { count: 5, cost: 300 },
                { count: 15, cost: 800 },
                { count: 40, cost: 1800 },
              ] as const).map((pack) => {
                const canAfford = coins >= pack.cost;
                return (
                  <button
                    key={pack.count}
                    onClick={() => handleBuyHints(pack)}
                    disabled={!canAfford}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: canAfford ? 'rgba(212,175,55,0.08)' : 'rgba(255,255,255,0.02)', border: `1px solid ${canAfford ? 'rgba(212,175,55,0.3)' : 'rgba(212,175,55,0.1)'}`, borderRadius: 8, cursor: canAfford ? 'pointer' : 'default', opacity: canAfford ? 1 : 0.45 }}
                  >
                    <span style={{ fontFamily: 'var(--font-heading)', fontSize: '13px', letterSpacing: '1px', color: COLORS.gold }}>
                      {pack.count} Hint{pack.count > 1 ? 's' : ''}
                    </span>
                    <span style={{ fontFamily: 'var(--font-heading)', fontSize: '12px', letterSpacing: '0.5px', color: COLORS.sandstone, display: 'flex', alignItems: 'center', gap: 5 }}>
                      <CoinIcon />{pack.cost}
                    </span>
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setShowHintPurchase(false)}
              style={{ display: 'block', width: '100%', marginTop: 16, padding: '10px', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-heading)', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', color: COLORS.sandstone, opacity: 0.5 }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
