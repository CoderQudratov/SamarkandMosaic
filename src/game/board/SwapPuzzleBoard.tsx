import React, {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from 'react';
import { gsap } from '@/lib/gsap';
import { useSwapStore, isLockedSlot } from '@/store/swapStore';
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
  fetchSwapLevelData,
  isTutorialDone,
  findBestMove,
  SWAP_MAX_ATTEMPTS,
} from '@/game/systems/SwapSystem';
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
import { CornerFlourish } from '@/components/ui/CornerFlourish';
import { saveSystem } from '@/game/systems/SaveSystem';
import { syncManager } from '@/game/systems/SyncManager';
import { calcLevelReward, setLastWinPayload, getHintCost } from '@/game/systems/EconomySystem';
import { sync } from '@/services/sync.service';
import { registerBackButton, unregisterBackButton } from '@/integrations/telegram';
import { COLORS, TIMINGS, CONFIG } from '@/constants';
import type { SwapLevelData } from '@/game/systems/SwapSystem';

// ── Layout ────────────────────────────────────────────────────────────────────

interface BoardLayout {
  left: number;
  top: number;
  width: number;
  height: number;
  cellW: number;
  cellH: number;
}

function computeSwapLayout(
  container: DOMRect,
  imageW: number,
  imageH: number,
  cols: number,
  rows: number,
  margin: number,
): BoardLayout {
  const availW = Math.max(1, container.width - margin * 2);
  const availH = Math.max(1, container.height - margin * 2);
  const scale = Math.min(availW / imageW, availH / imageH);
  const width = imageW * scale;
  const height = imageH * scale;
  const left = container.left + (container.width - width) / 2;
  const top = container.top + (container.height - height) / 2;
  const cellW = (imageW / cols) * scale;
  const cellH = (imageH / rows) * scale;
  return { left, top, width, height, cellW, cellH };
}

// ── Tile component ────────────────────────────────────────────────────────────

// Visual scale constants — inner div only. Outer div stays at full cell size for GSAP.
const SCALE_NORMAL = 0.96;    // gap between tiles
const SCALE_CORRECT = 1.0;    // gap collapses when tile is in correct slot
const SCALE_SELECTED = 1.06;  // lift on selection

interface SwapTileProps {
  slotIndex: number;
  image: string;
  isLocked: boolean;
  isSelected: boolean;
  isCorrect: boolean;
  cellW: number;
  cellH: number;
  cols: number;
  divRef: (el: HTMLDivElement | null) => void;
  onTap: () => void;
}

const SwapTile = React.memo(function SwapTile({
  slotIndex, image, isLocked, isSelected, isCorrect, cellW, cellH, cols, divRef, onTap,
}: SwapTileProps) {
  const col = slotIndex % cols;
  const row = Math.floor(slotIndex / cols);
  const scale = isSelected ? SCALE_SELECTED : (isLocked || isCorrect) ? SCALE_CORRECT : SCALE_NORMAL;

  return (
    // Outer div: GSAP animates x/y here for swap flight. Position/size never changes.
    <div
      ref={divRef}
      data-slot={slotIndex}
      style={{
        position: 'absolute',
        left: col * cellW,
        top: row * cellH,
        width: cellW,
        height: cellH,
        zIndex: isSelected ? 3 : 1,
        touchAction: 'manipulation',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
      onClick={isLocked ? undefined : onTap}
    >
      {/* Inner div: CSS transition handles scale changes (gap/collapse/lift). */}
      <div
        style={{
          width: '100%',
          height: '100%',
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
          transition: 'transform 0.22s cubic-bezier(0.34,1.56,0.64,1)',
          position: 'relative',
          overflow: 'hidden',
          cursor: isLocked ? 'default' : 'pointer',
          borderRadius: 2,
          boxShadow: isSelected
            ? '0 6px 24px rgba(0,0,0,0.65), 0 0 0 2px rgba(212,175,55,0.9)'
            : '0 2px 8px rgba(0,0,0,0.45)',
          filter: isLocked ? 'drop-shadow(0 0 6px rgba(212,175,55,0.5))' : 'none',
        }}
      >
        <img
          src={image}
          alt=""
          draggable={false}
          style={{ width: '100%', height: '100%', display: 'block', pointerEvents: 'none' }}
        />

        {/* Locked: golden frame */}
        {isLocked && (
          <div aria-hidden style={{
            position: 'absolute', inset: 0,
            border: '2px solid rgba(212,175,55,0.6)',
            background: 'rgba(212,175,55,0.06)',
            boxShadow: 'inset 0 0 10px rgba(212,175,55,0.18)',
            pointerEvents: 'none', borderRadius: 2,
          }} />
        )}

        {/* Selected: gold glow border */}
        {isSelected && (
          <div aria-hidden style={{
            position: 'absolute', inset: 0,
            border: `2px solid ${COLORS.gold}`,
            boxShadow: `0 0 20px rgba(212,175,55,0.9), inset 0 0 10px rgba(212,175,55,0.2)`,
            pointerEvents: 'none', borderRadius: 2,
          }} />
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
  const musicMuted = useAudioStore((s) => s.musicMuted);
  const sfxMuted = useAudioStore((s) => s.sfxMuted);

  const grid = useSwapStore((s) => s.grid);
  const selectedSlot = useSwapStore((s) => s.selectedSlot);
  const attemptsLeft = useSwapStore((s) => s.attemptsLeft);
  const maxAttempts = useSwapStore((s) => s.maxAttempts);
  const isLoaded = useSwapStore((s) => s.isLoaded);
  const isAnimating = useSwapStore((s) => s.isAnimating);
  const hintUsed = useSwapStore((s) => s.hintUsed);

  const [levelData, setLevelData] = useState<SwapLevelData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [layout, setLayout] = useState<BoardLayout | null>(null);
  const [areaOrigin, setAreaOrigin] = useState({ left: 0, top: 0 });
  const [isPaused, setIsPaused] = useState(false);
  const [showGameOver, setShowGameOver] = useState(false);
  const [showParticles, setShowParticles] = useState(false);
  const [particleOrigin, setParticleOrigin] = useState({ x: 0, y: 0 });
  const [showChest, setShowChest] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialSlots, setTutorialSlots] = useState<{ aCx: number; aCy: number; bCx: number; bCy: number } | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [insufficientCoins, setInsufficientCoins] = useState<string | null>(null);

  // Idle hint state
  const [idleHintSlots, setIdleHintSlots] = useState<{ aCx: number; aCy: number; bCx: number; bCy: number } | null>(null);
  const [idleHintKey, setIdleHintKey] = useState(0);

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
  const levelDataRef = useRef<SwapLevelData | null>(null);
  const isCompleteRef = useRef(false);

  // Keep refs in sync for callbacks that need latest values without re-subscribing.
  layoutRef.current = layout;
  levelDataRef.current = levelData;
  isCompleteRef.current = isComplete;

  // ── Tile image map ──────────────────────────────────────────────────────────
  const tileImageMap = useMemo<Record<number, string>>(() => {
    if (!levelData) return {};
    const base = `/assets/levels/level-${selectedLevelId}`;
    const map: Record<number, string> = {};
    for (const t of levelData.tiles) {
      map[t.id] = `${base}/${t.image}`;
    }
    return map;
  }, [levelData, selectedLevelId]);

  // ── Back button ─────────────────────────────────────────────────────────────
  useEffect(() => {
    registerBackButton(() => { if (!isComplete) setIsPaused(true); });
    return () => unregisterBackButton();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isComplete]);

  // ── Load level ──────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    mistakesRef.current = 0;
    wasCompleteRef.current = false;
    revealedRef.current = false;
    useSwapStore.getState().reset();
    setLoadError(null);
    setLevelData(null);
    setLayout(null);

    async function load() {
      try {
        const data = await fetchSwapLevelData(selectedLevelId);
        if (cancelled) return;
        setLevelData(data);

        const total = data.rows * data.cols;
        const maxAtt = SWAP_MAX_ATTEMPTS[selectedLevelId] ?? 12;
        const saved = loadSwapState(selectedLevelId, total);
        const initGrid = saved ? saved.grid : createShuffledGrid(data.cols, total);
        const initAttempts = saved ? saved.attemptsLeft : maxAtt;

        useSwapStore.getState().initBoard(
          `level-${selectedLevelId}`, initGrid, initAttempts, maxAtt, data.cols, data.rows,
        );
        levelStartRef.current = Date.now();
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
    // Use imageWidth/imageHeight for board dimensions; fall back to tileSize-based estimate.
    const imageW = levelData.imageWidth ?? levelData.cols * (levelData.tileSize ?? 256);
    const imageH = levelData.imageHeight ?? levelData.rows * (levelData.tileSize ?? 146);
    const newLayout = computeSwapLayout(
      rect, imageW, imageH, levelData.cols, levelData.rows, CONFIG.puzzle.boardMargin,
    );
    setLayout(newLayout);
    setAreaOrigin({ left: rect.left, top: rect.top });
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

  // ── Board entrance animation ────────────────────────────────────────────────
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

  // ── Idle hint system ────────────────────────────────────────────────────────
  const showHintMove = useCallback(() => {
    const data = levelDataRef.current;
    const lay = layoutRef.current;
    if (isCompleteRef.current || !data || !lay) return;

    const { grid: currentGrid } = useSwapStore.getState();
    const cols = data.cols;
    const total = data.rows * data.cols;
    const move = findBestMove(currentGrid, cols, total);
    if (!move) return;

    const [slotA, slotB] = move;
    const colA = slotA % cols, rowA = Math.floor(slotA / cols);
    const colB = slotB % cols, rowB = Math.floor(slotB / cols);

    setIdleHintSlots({
      aCx: lay.left + (colA + 0.5) * lay.cellW,
      aCy: lay.top + (rowA + 0.5) * lay.cellH,
      bCx: lay.left + (colB + 0.5) * lay.cellW,
      bCy: lay.top + (rowB + 0.5) * lay.cellH,
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

  // Start idle timer once the board is ready.
  useEffect(() => {
    if (!isLoaded || isComplete) return;
    resetIdleTimer();
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (idleRepeatRef.current) clearInterval(idleRepeatRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded]);

  // Clear idle timer on win.
  useEffect(() => {
    if (!isComplete) return;
    setIdleHintSlots(null);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (idleRepeatRef.current) clearInterval(idleRepeatRef.current);
  }, [isComplete]);

  // ── Tutorial trigger (first play, level 1 only) ─────────────────────────────
  useEffect(() => {
    if (!isLoaded || !layout || selectedLevelId !== 1 || isTutorialDone() || grid.length === 0) return;

    const data = levelData;
    if (!data) return;
    const cols = data.cols;
    const total = data.rows * data.cols;
    const move = findBestMove(grid, cols, total);
    if (!move) return;

    const [slotA, slotB] = move;
    const colA = slotA % cols, rowA = Math.floor(slotA / cols);
    const colB = slotB % cols, rowB = Math.floor(slotB / cols);

    const t = setTimeout(() => {
      setTutorialSlots({
        aCx: layout.left + (colA + 0.5) * layout.cellW,
        aCy: layout.top + (rowA + 0.5) * layout.cellH,
        bCx: layout.left + (colB + 0.5) * layout.cellW,
        bCy: layout.top + (rowB + 0.5) * layout.cellH,
      });
      setShowTutorial(true);
    }, 600);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, layout !== null, selectedLevelId]);

  // ── Swap animation + logic ──────────────────────────────────────────────────
  const performSwap = useCallback((slotA: number, slotB: number) => {
    const data = levelDataRef.current;
    const lay = layoutRef.current;
    const cols = data?.cols ?? 4;

    const currentGrid = useSwapStore.getState().grid;
    const good = isGoodSwap(currentGrid, slotA, slotB, cols);

    useSwapStore.getState().setAnimating(true);

    const elA = tileRefs.current.get(slotA) ?? null;
    const elB = tileRefs.current.get(slotB) ?? null;

    const colA = slotA % cols, rowA = Math.floor(slotA / cols);
    const colB = slotB % cols, rowB = Math.floor(slotB / cols);
    const cellW = lay?.cellW ?? 0;
    const cellH = lay?.cellH ?? 0;
    const dx = (colB - colA) * cellW;
    const dy = (rowB - rowA) * cellH;

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
          if (isTileImproved(currentGrid[slotB], slotA, cols)) {
            const rect = { left: lay.left + colA * cellW, top: lay.top + rowA * cellH, width: cellW, height: cellH };
            triggerSnapFX(rect);
            usePlayerStore.getState().addCoins(CONFIG.coins.perSnap);
            spawnCoinReward(CONFIG.coins.perSnap, rect.left + cellW / 2, rect.top + cellH / 2);
          }
          if (isTileImproved(currentGrid[slotA], slotB, cols)) {
            const rect = { left: lay.left + colB * cellW, top: lay.top + rowB * cellH, width: cellW, height: cellH };
            triggerSnapFX(rect);
            usePlayerStore.getState().addCoins(CONFIG.coins.perSnap);
            spawnCoinReward(CONFIG.coins.perSnap, rect.left + cellW / 2, rect.top + cellH / 2);
          }
        }
        audioManager.play('snap');
        hapticsManager.trigger('success');
      }

      syncManager.bumpVersion();
      saveSwapState(selectedLevelId);

      const state = useSwapStore.getState();
      if (state.isSolved && !wasCompleteRef.current) {
        wasCompleteRef.current = true;
        triggerWin();
      } else if (state.attemptsLeft === 0 && !wasCompleteRef.current) {
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

  // ── Tile tap ────────────────────────────────────────────────────────────────
  const handleTileTap = useCallback((slotIndex: number) => {
    const data = levelDataRef.current;
    const cols = data?.cols ?? 4;
    const total = data ? data.rows * data.cols : grid.length;

    // Any interaction resets the idle hint timer and dismisses active hints.
    resetIdleTimer();
    setShowTutorial(false);
    setIdleHintSlots(null);

    if (isComplete || isAnimating || isLockedSlot(slotIndex, cols, total) || showGameOver || isPaused) return;

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
  }, [isComplete, isAnimating, showGameOver, isPaused, performSwap, resetIdleTimer, grid.length]);

  // ── Win sequence ────────────────────────────────────────────────────────────
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

  // ── Hint ────────────────────────────────────────────────────────────────────
  const handleHint = useCallback(() => {
    if (hintUsed || isComplete) return;
    const ok = usePlayerStore.getState().spendHint(getHintCost());
    if (!ok) {
      setInsufficientCoins(`Need ${getHintCost()} coins for a hint`);
      setTimeout(() => setInsufficientCoins(null), 2500);
      return;
    }
    useSwapStore.getState().setHintUsed(true);
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
  }, [hintUsed, isComplete]);

  // ── Replay ──────────────────────────────────────────────────────────────────
  const handleReplay = useCallback(() => {
    const data = levelDataRef.current;
    if (winTimerRef.current) { clearTimeout(winTimerRef.current); winTimerRef.current = null; }
    setIsPaused(false);
    setShowGameOver(false);
    setIsComplete(false);
    setShowParticles(false);
    setShowChest(false);
    setInsufficientCoins(null);
    setIdleHintSlots(null);
    wasCompleteRef.current = false;
    mistakesRef.current = 0;
    revealedRef.current = false;
    clearSwapState(selectedLevelId);
    useSwapStore.getState().reset();

    const cols = data?.cols ?? 4;
    const rows = data?.rows ?? 7;
    const total = cols * rows;
    const maxAtt = SWAP_MAX_ATTEMPTS[selectedLevelId] ?? 12;
    const freshGrid = createShuffledGrid(cols, total);
    useSwapStore.getState().initBoard(`level-${selectedLevelId}`, freshGrid, maxAtt, maxAtt, cols, rows);
    saveSwapState(selectedLevelId);
    levelStartRef.current = Date.now();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLevelId]);

  const handleExit = useCallback(() => {
    useUIStore.getState().setScene('mainMenu');
  }, []);

  // ── Render guards ────────────────────────────────────────────────────────────
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

  const correctCount = grid.filter((t, i) => t === i + 1).length;
  const progressPct = grid.length ? Math.round((correctCount / grid.length) * 100) : 0;
  const cols = levelData?.cols ?? 4;
  const total = grid.length;

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* ── HUD ────────────────────────────────────────────────────────────── */}
      <div style={{
        flexShrink: 0, display: 'flex', flexDirection: 'column',
        background: 'linear-gradient(180deg, rgba(26,15,0,0.99) 0%, rgba(18,10,0,0.97) 100%)',
        borderBottom: '1px solid rgba(212,175,55,0.18)',
        boxShadow: '0 2px 12px rgba(0,0,0,0.5)', position: 'relative', zIndex: 10,
      }}>
        <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          {/* Left */}
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

          {/* Center */}
          <div style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '13px', letterSpacing: '3px', textTransform: 'uppercase', color: COLORS.gold, textShadow: '0 0 14px rgba(212,175,55,0.4)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Level {selectedLevelId}
            </div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: '9px', letterSpacing: '2px', color: COLORS.sandstone, opacity: 0.55, marginTop: '1px' }}>
              SWAP PUZZLE
            </div>
          </div>

          {/* Right */}
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
              onClick={!isComplete && !hintUsed ? handleHint : undefined}
              style={{ ...iconBtn, opacity: hintUsed ? 0.3 : 0.9, cursor: hintUsed || isComplete ? 'default' : 'pointer', transition: 'opacity 0.3s ease', transformOrigin: 'center center' }}
              aria-label={hintUsed ? 'Hint used' : 'Use hint'}
              disabled={hintUsed || isComplete}
            >
              <LampIcon dim={hintUsed} />
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, height: '2px', width: `${progressPct}%`, background: `linear-gradient(90deg, ${COLORS.darkGold}, ${COLORS.gold})`, transition: 'width 0.35s ease', boxShadow: '0 0 6px rgba(212,175,55,0.6)' }} />
      </div>

      {/* ── Board area ─────────────────────────────────────────────────────── */}
      <div ref={areaRef} style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' }}>
        {layout && levelData && (
          <div
            ref={boardContainerRef}
            style={{
              position: 'absolute',
              left: layout.left - areaOrigin.left,
              top: layout.top - areaOrigin.top,
              width: layout.width,
              height: layout.height,
              transformOrigin: 'center center',
            }}
          >
            {/* Decorative golden frame outside the board */}
            <div aria-hidden style={{ position: 'absolute', inset: -4, border: `2px solid ${COLORS.gold}`, borderRadius: '8px', boxShadow: '0 0 30px rgba(212,175,55,0.2), 0 0 0 1px rgba(0,0,0,0.4) inset', pointerEvents: 'none', zIndex: 0 }} />
            <CornerFlourish corner="tl" size={22} inset={-2} />
            <CornerFlourish corner="tr" size={22} inset={-2} />
            <CornerFlourish corner="bl" size={22} inset={-2} />
            <CornerFlourish corner="br" size={22} inset={-2} />

            {/* Win glow */}
            <div
              ref={boardGlowRef}
              aria-hidden
              style={{ position: 'absolute', inset: -20, borderRadius: '14px', pointerEvents: 'none', opacity: 0, boxShadow: '0 0 60px rgba(212,175,55,0.9), 0 0 100px rgba(212,175,55,0.5), 0 0 140px rgba(212,175,55,0.25)', zIndex: 0 }}
            />

            {/* Layer 1: board.png seamless base */}
            <img
              src={`/assets/levels/level-${selectedLevelId}/${levelData.board}`}
              alt=""
              draggable={false}
              style={{
                position: 'absolute', inset: 0, width: '100%', height: '100%',
                display: 'block', pointerEvents: 'none', zIndex: 0,
              }}
            />

            {/* Layer 2: guide.png ghosted helper */}
            {levelData.guide && (
              <img
                src={`/assets/levels/level-${selectedLevelId}/${levelData.guide}`}
                alt=""
                draggable={false}
                style={{
                  position: 'absolute', inset: 0, width: '100%', height: '100%',
                  display: 'block', opacity: 0.30, pointerEvents: 'none', zIndex: 1,
                  mixBlendMode: 'luminosity',
                }}
              />
            )}

            {/* Layer 3: tiles */}
            {grid.map((tileId, slotIndex) => (
              <SwapTile
                key={slotIndex}
                slotIndex={slotIndex}
                image={tileImageMap[tileId] ?? ''}
                isLocked={isLockedSlot(slotIndex, cols, total)}
                isSelected={selectedSlot === slotIndex}
                isCorrect={tileId === slotIndex + 1}
                cellW={layout.cellW}
                cellH={layout.cellH}
                cols={cols}
                divRef={(el) => {
                  if (el) tileRefs.current.set(slotIndex, el);
                  else tileRefs.current.delete(slotIndex);
                }}
                onTap={() => handleTileTap(slotIndex)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── First-play tutorial hand ──────────────────────────────────────── */}
      {showTutorial && tutorialSlots && (
        <TutorialHand
          slotACx={tutorialSlots.aCx}
          slotACy={tutorialSlots.aCy}
          slotBCx={tutorialSlots.bCx}
          slotBCy={tutorialSlots.bCy}
          markTutorial
          sizeScale={1.0}
          onComplete={() => {
            setShowTutorial(false);
            resetIdleTimer();
          }}
        />
      )}

      {/* ── Idle hint hand (1.8× larger, no tutorial mark) ───────────────── */}
      {idleHintSlots && (
        <TutorialHand
          key={idleHintKey}
          slotACx={idleHintSlots.aCx}
          slotACy={idleHintSlots.aCy}
          slotBCx={idleHintSlots.bCx}
          slotBCy={idleHintSlots.bCy}
          sizeScale={1.8}
          onComplete={() => setIdleHintSlots(null)}
        />
      )}

      {/* ── Win particles ─────────────────────────────────────────────────── */}
      <WinParticles active={showParticles} originX={particleOrigin.x} originY={particleOrigin.y} />

      {/* ── Chest modal ───────────────────────────────────────────────────── */}
      <ChestModal isOpen={showChest} onClose={() => { setShowChest(false); useUIStore.getState().setScene('win'); }} />

      {/* ── Game over ─────────────────────────────────────────────────────── */}
      <Modal isOpen={showGameOver} onClose={() => {}} title="No Attempts Left" locked>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', lineHeight: 1.7, color: COLORS.sandstone, textAlign: 'center' }}>
            The mosaic was not restored in time.
          </p>
          <PrimaryButton size="md" fullWidth onClick={handleReplay}>↺ &nbsp; Retry</PrimaryButton>
          <SecondaryButton size="md" fullWidth onClick={handleExit}>✕ &nbsp; Back to Menu</SecondaryButton>
        </div>
      </Modal>

      {/* ── Pause modal ───────────────────────────────────────────────────── */}
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

      {/* ── Insufficient coins toast ──────────────────────────────────────── */}
      {insufficientCoins && (
        <div style={{ position: 'fixed', bottom: 'calc(80px + var(--safe-area-bottom, 0px))', left: '50%', transform: 'translateX(-50%)', padding: '10px 20px', borderRadius: '6px', background: 'rgba(26,15,0,0.92)', border: '1px solid rgba(204,34,0,0.5)', color: COLORS.sandstone, fontFamily: 'var(--font-heading)', fontSize: '11px', letterSpacing: '1px', whiteSpace: 'nowrap', zIndex: 300, pointerEvents: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
          {insufficientCoins}
        </div>
      )}
    </div>
  );
}
