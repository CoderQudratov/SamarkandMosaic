import React, {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useCallback,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { gsap } from '@/lib/gsap';
import { useBoardStore, selectProgress } from '@/store/boardStore';
import { useGameStore } from '@/store/gameStore';
import { useUIStore } from '@/store/uiStore';
import { usePlayerStore } from '@/store/playerStore';
import { useLevelStore } from '@/store/levelStore';
import {
  loadLevel,
  levelBaseUrl,
  computeLayout,
  slotViewportRect,
  slotLocalRect,
} from '@/game/systems/BoardSystem';
import { usePuzzleDrag } from '@/game/systems/DragSystem';
import { PuzzlePiece } from '@/game/pieces/PuzzlePiece';
import { PieceTray } from '@/game/board/PieceTray';
import { GameHUD } from '@/game/ui/GameHUD';
import { WinParticles } from '@/game/effects/WinParticles';
import { CornerFlourish } from '@/components/ui/CornerFlourish';
import { Modal } from '@/components/modals/Modal';
import { ChestModal } from '@/components/modals/ChestModal';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { COLORS, TIMINGS, CONFIG } from '@/constants';
import { audioManager } from '@/game/audio/AudioManager';
import { hapticsManager } from '@/game/haptics/HapticsManager';
import { triggerSnapFX } from '@/game/effects/snapFX';
import { triggerWrongFX } from '@/game/effects/wrongFX';
import { spawnHintParticles } from '@/game/effects/hintFX';
import { spawnCoinReward } from '@/game/effects/coinFX';
import { saveSystem } from '@/game/systems/SaveSystem';
import { registerBackButton, unregisterBackButton } from '@/integrations/telegram';
import { sync } from '@/services/sync.service';
import { syncManager } from '@/game/systems/SyncManager';
import { calcLevelReward, setLastWinPayload, getHintCost, getHeartRefillCost } from '@/game/systems/EconomySystem';
import {
  spawnWinConfetti,
  spawnMosaicShards,
  spawnScreenEdgeFlash,
  spawnCoinSparkles,
} from '@/game/effects/winFX';
import { useAudioStore } from '@/store/audioStore';
import type { BoardLayout } from '@/game/types';
import type { Rect } from '@/game/utils/geometry';

// Image that silently disappears if the asset is missing (graceful fallback).
function FadingImage({
  src,
  style: extraStyle,
}: {
  src: string;
  style?: React.CSSProperties;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <img
      src={src}
      alt=""
      draggable={false}
      onError={() => setFailed(true)}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        objectFit: 'fill',
        pointerEvents: 'none',
        ...extraStyle,
      }}
    />
  );
}

export function PuzzleBoard() {
  const loadState = useBoardStore((s) => s.loadState);
  const error = useBoardStore((s) => s.error);
  const level = useBoardStore((s) => s.level);
  const naturalWidth = useBoardStore((s) => s.naturalWidth);
  const naturalHeight = useBoardStore((s) => s.naturalHeight);
  const pieces = useBoardStore((s) => s.pieces);
  const trayOrder = useBoardStore((s) => s.trayOrder);
  const progress = useBoardStore(selectProgress);
  const coins = usePlayerStore((s) => s.coins); // live HUD balance

  // Which level to load — chosen on the level-select screen (defaults to 1).
  const selectedLevelId = useLevelStore((s) => s.selectedLevelId);
  const LEVEL_ID = `level-${selectedLevelId}`;

  // Audio state for pause modal toggles
  const musicMuted = useAudioStore((s) => s.musicMuted);
  const sfxMuted   = useAudioStore((s) => s.sfxMuted);

  // HUD + completion state (must be declared before any callbacks that reference them)
  const hearts = useGameStore((s) => s.hearts);
  const [hintUsed, setHintUsed] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showParticles, setShowParticles] = useState(false);
  const [particleOrigin, setParticleOrigin] = useState({ x: 0, y: 0 });
  const [isComplete, setIsComplete] = useState(false);
  const [showChest, setShowChest] = useState(false);
  const [showHeartRefill, setShowHeartRefill] = useState(false);
  const [insufficientCoins, setInsufficientCoins] = useState<string | null>(null);
  const wasComplete = useRef(false);
  const boardRevealedRef = useRef(false); // fires the reveal animation only once per load
  // Tracks wrong drops in the current run — used to compute the star score.
  // Reset at level load and replay so replays start with a clean slate.
  const mistakesRef = useRef(0);
  // Timestamp (ms) when the level became playable — used for the speed bonus.
  const levelStartRef = useRef(0);

  const areaRef = useRef<HTMLDivElement>(null);
  const trayRef = useRef<HTMLDivElement>(null);
  const winTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hintOverlayRef = useRef<HTMLDivElement>(null);
  const hintShimmerRef = useRef<HTMLDivElement>(null);
  const hintBoardGlowRef = useRef<HTMLDivElement>(null);
  const hintBtnRef = useRef<HTMLButtonElement>(null);
  const hintActiveRef = useRef(false);

  const [layout, setLayout] = useState<BoardLayout | null>(null);
  const [areaOrigin, setAreaOrigin] = useState({ left: 0, top: 0 });

  // ── Telegram BackButton ──────────────────────────────────────────────────────
  // In Telegram, the native back chevron acts as "Pause / exit puzzle" — it opens
  // the pause menu so the player can intentionally leave without losing progress.
  useEffect(() => {
    registerBackButton(() => {
      if (!isComplete) setIsPaused(true);
    });
    return () => unregisterBackButton();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isComplete]);

  // ── Load level on mount ────────────────────────────────────────────────────
  // Hearts are a persistent, regenerating resource — they are NOT reset per level.
  useEffect(() => {
    mistakesRef.current = 0; // fresh run
    boardRevealedRef.current = false; // allow reveal animation for this load
    useGameStore.getState().applyRefill(); // grant any hearts earned while away
    useGameStore.getState().setStatus('playing');
    loadLevel(LEVEL_ID);
    return () => {
      useBoardStore.getState().reset();
    };
  }, [LEVEL_ID]);

  // ── Responsive board measurement ──────────────────────────────────────────
  const measure = useCallback(() => {
    const area = areaRef.current;
    if (!area) return;
    const nW = useBoardStore.getState().naturalWidth;
    const nH = useBoardStore.getState().naturalHeight;
    if (!nW || !nH) return;
    const rect = area.getBoundingClientRect();
    setLayout(computeLayout(rect, nW, nH));
    setAreaOrigin({ left: rect.left, top: rect.top });
  }, []);

  useEffect(() => {
    if (loadState !== 'ready') return;
    levelStartRef.current = Date.now(); // start speed-bonus timer when board is playable
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
  }, [loadState, naturalWidth, naturalHeight, measure]);

  // ── Drag system ───────────────────────────────────────────────────────────
  const getSlotRect = useCallback(
    (id: string): Rect | null => {
      if (!layout) return null;
      const piece = useBoardStore.getState().pieces[id];
      if (!piece) return null;
      return slotViewportRect(piece.def, layout);
    },
    [layout],
  );

  const getTrayRect = useCallback(
    () => trayRef.current?.getBoundingClientRect() ?? null,
    [],
  );

  // ── Slot pulse (fires from onSnapFeedback callback) ───────────────────────
  const [snapFlashSlot, setSnapFlashSlot] = useState<Rect | null>(null);
  const snapFlashRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!snapFlashSlot || !snapFlashRef.current) return;
    const el = snapFlashRef.current;
    try {
      gsap.killTweensOf(el);
      gsap.set(el, { opacity: 1 });
      gsap.to(el, {
        opacity: 0,
        duration: TIMINGS.snapSlotPulse,
        ease: 'power2.out',
        onComplete: () => setSnapFlashSlot(null),
      });
    } catch {
      setSnapFlashSlot(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapFlashSlot]);

  const onSnapFeedback = useCallback(
    (slotViewport: Rect) => {
      audioManager.play('snap');
      hapticsManager.trigger('success');
      // Fire DOM snap FX (golden flash, glow pulse, ceramic dust) at viewport coords
      triggerSnapFX(slotViewport);

      // Coin reward: +5 per correct snap (fires once per placement). The snap
      // sound is the audio cue here — no extra click to avoid layering.
      usePlayerStore.getState().addCoins(CONFIG.coins.perSnap);
      spawnCoinReward(
        CONFIG.coins.perSnap,
        slotViewport.left + slotViewport.width / 2,
        slotViewport.top + slotViewport.height / 2,
      );

      if (!layout) return;
      // Slot highlight: brief gold border inside the board container
      setSnapFlashSlot({
        left: slotViewport.left - layout.left,
        top: slotViewport.top - layout.top,
        width: slotViewport.width,
        height: slotViewport.height,
      });
    },
    [layout],
  );

  // ── Lives system ─────────────────────────────────────────────────────────
  const onWrongDrop = useCallback((dropRect: Rect) => {
    if (isComplete) return;
    mistakesRef.current += 1; // count this mistake for the star score
    saveSystem.trackMistake();
    syncManager.bumpVersion(); // heart loss
    triggerWrongFX(dropRect);
    audioManager.play('wrong');
    audioManager.play('loseHeart');
    hapticsManager.trigger('warning');                           // wrong placement
    setTimeout(() => hapticsManager.trigger('error'), 60);      // life lost (staggered)
    useGameStore.getState().loseHeart();
    const remaining = useGameStore.getState().hearts;
    if (remaining === 0) {
      // Offer a paid refill before going to gameover.
      setTimeout(() => setShowHeartRefill(true), 700);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isComplete]);

  // ── Hint system ───────────────────────────────────────────────────────────
  const handleHint = useCallback(() => {
    if (hintUsed || hintActiveRef.current || isComplete) return;

    // Consume a free hint from inventory first; if none left, buy with coins.
    const hintOk = usePlayerStore.getState().spendHint(getHintCost());
    if (!hintOk) {
      setInsufficientCoins(`Need ${getHintCost()} coins for a hint`);
      setTimeout(() => setInsufficientCoins(null), 2500);
      return;
    }

    const overlayEl  = hintOverlayRef.current;
    const shimmerEl  = hintShimmerRef.current;
    const glowEl     = hintBoardGlowRef.current;
    const btnEl      = hintBtnRef.current;
    if (!overlayEl) return;
    hintActiveRef.current = true;

    // 7 & 8 — Sound + haptic on press
    audioManager.play('hint');
    hapticsManager.trigger('medium');
    saveSystem.trackHintUsed();
    syncManager.bumpVersion(); // hint used

    // 5 — Lamp button scale pulse (fires immediately on press)
    if (btnEl) {
      try {
        gsap.killTweensOf(btnEl);
        gsap
          .timeline()
          .to(btnEl, { scale: 1.15, duration: TIMINGS.hintBtnPulse * 0.5, ease: 'power2.out' })
          .to(btnEl, { scale: 1, duration: TIMINGS.hintBtnPulse * 0.5, ease: 'back.out(2)' });
      } catch { /* noop */ }
    }

    // 4 — Magical particles across board footprint
    if (layout) {
      spawnHintParticles({
        left: layout.left,
        top: layout.top,
        width: layout.width,
        height: layout.height,
      });
    }

    try {
      const tl = gsap.timeline({
        onComplete: () => {
          setHintUsed(true);
          hintActiveRef.current = false;
        },
      });

      // 1 — Ornament reveal
      tl.set(overlayEl, { display: 'block', opacity: 0 });
      tl.to(overlayEl, { opacity: 0.85, duration: TIMINGS.hintReveal, ease: 'power2.out' });

      // 6 — Hold then fade out
      tl.to(overlayEl, { opacity: 0.85, duration: TIMINGS.hintHold });
      tl.to(overlayEl, { opacity: 0, duration: TIMINGS.hintFadeOut, ease: 'power2.in' });
      tl.set(overlayEl, { display: 'none' });

      // 2 — Golden shimmer sweep (runs concurrently with reveal)
      if (shimmerEl) {
        tl.set(shimmerEl, { xPercent: -100 }, 0.05);
        tl.to(shimmerEl, {
          xPercent: 100,
          duration: TIMINGS.hintShimmer,
          ease: 'power1.inOut',
        }, 0.05);
      }

      // 3 — Board glow pulse: 0 → 1 → 0 over hintBoardGlow seconds (runs at t=0)
      if (glowEl) {
        const half = TIMINGS.hintBoardGlow * 0.5;
        tl.to(glowEl, { opacity: 1, duration: half, ease: 'power2.out' }, 0);
        tl.to(glowEl, { opacity: 0, duration: half, ease: 'power2.in' }, half);
      }
    } catch {
      setHintUsed(true);
      hintActiveRef.current = false;
    }
  }, [hintUsed, isComplete, layout]);

  // ── Pause menu handlers ───────────────────────────────────────────────────
  const handleResume = useCallback(() => {
    hapticsManager.trigger('light');
    setIsPaused(false);
  }, []);

  const handleReplay = useCallback(() => {
    setIsPaused(false);
    setHintUsed(false);
    setShowParticles(false);
    setShowChest(false);
    useUIStore.getState().setShopOpen(false);
    setShowHeartRefill(false);
    setInsufficientCoins(null);
    wasComplete.current = false;
    setIsComplete(false);
    hintActiveRef.current = false;

    // Cancel pending win scene transition (replay within 2.2s window)
    if (winTimerRef.current) {
      clearTimeout(winTimerRef.current);
      winTimerRef.current = null;
    }

    // Reset tray opacity in case win sequence faded it
    if (trayRef.current) gsap.set(trayRef.current, { opacity: 1 });

    // Kill hint animations in case replay fires mid-hint
    if (hintOverlayRef.current) {
      gsap.killTweensOf(hintOverlayRef.current);
      gsap.set(hintOverlayRef.current, { display: 'none', opacity: 0 });
    }
    if (hintBoardGlowRef.current) {
      gsap.killTweensOf(hintBoardGlowRef.current);
      gsap.set(hintBoardGlowRef.current, { opacity: 0 });
    }
    if (completionTextRef.current) {
      gsap.killTweensOf(completionTextRef.current);
      gsap.set(completionTextRef.current, { opacity: 0 });
    }

    mistakesRef.current = 0; // fresh attempt
    levelStartRef.current = 0; // reset; will be set again when loadState → ready
    boardRevealedRef.current = false; // allow reveal animation for next load
    // Hearts persist across replays — only refresh from the regen clock.
    useGameStore.getState().applyRefill();
    useGameStore.getState().setStatus('playing');
    useBoardStore.getState().reset();
    loadLevel(LEVEL_ID);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleExit = useCallback(() => {
    useUIStore.getState().setScene('mainMenu');
  }, []);

  const onPlace = useCallback((id: string) => {
    useBoardStore.getState().placePiece(id);
  }, []);

  const onReturn = useCallback(() => {
    // Piece reappears in tray automatically once draggingId clears.
  }, []);

  const { draggingId, initRect, floatingRef, glowRef, startDrag } = usePuzzleDrag({
    getSlotRect,
    getTrayRect,
    onPlace,
    onReturn,
    onSnapFeedback,
    onWrongDrop,
  });

  // ── Win reveal ────────────────────────────────────────────────────────────
  const boardContainerRef = useRef<HTMLDivElement>(null);
  const completionTextRef = useRef<HTMLDivElement>(null);

  // ── Board entrance reveal (fires once per level load) ─────────────────────
  useLayoutEffect(() => {
    if (!layout || !boardContainerRef.current || boardRevealedRef.current) return;
    boardRevealedRef.current = true;
    try {
      gsap.fromTo(
        boardContainerRef.current,
        { opacity: 0, scale: 0.96 },
        { opacity: 1, scale: 1, duration: TIMINGS.boardReveal, ease: 'power2.out', clearProps: 'scale' },
      );
    } catch { /* noop */ }
  }, [layout]);
  const boardRevealRef = useRef<HTMLDivElement>(null);
  const guideWrapRef = useRef<HTMLDivElement>(null);
  const goldWashRef = useRef<HTMLDivElement>(null);
  const shineRef = useRef<HTMLDivElement>(null);
  const boardGlowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const allPlaced = progress.total > 0 && progress.placed === progress.total;
    if (!allPlaced || wasComplete.current) return;
    wasComplete.current = true;

    setIsComplete(true); // freeze input immediately

    // 7 — Sound + haptics
    audioManager.stopBg(400);
    audioManager.play('win');
    hapticsManager.trigger('win');

    // Board center coordinates for all origin-based FX
    const boardCx = layout ? layout.left + layout.width / 2 : window.innerWidth / 2;
    const boardCy = layout ? layout.top + layout.height / 2 : window.innerHeight * 0.4;

    // 1 — Center burst (WinParticles component)
    setParticleOrigin({ x: boardCx, y: boardCy });
    setShowParticles(true);

    // 2, 4, 5, 6 — DOM FX (fire immediately, self-cleaning)
    spawnScreenEdgeFlash();
    spawnMosaicShards(boardCx, boardCy);
    spawnWinConfetti();
    spawnCoinSparkles();

    // ── Star score ─────────────────────────────────────────────────────────────
    // 3 stars: no mistakes AND no hint used
    // 2 stars: made at least one mistake (but no hint used)
    // 1 star:  hint used (overrides mistake count)
    const earnedStars = hintUsed ? 1 : mistakesRef.current > 0 ? 2 : 3;
    const player = usePlayerStore.getState();

    // Progression: mark this level complete + record best stars (unlocks next).
    player.completeLevel(selectedLevelId, earnedStars);
    saveSystem.trackWin();
    syncManager.bumpVersion(); // level complete
    // Fire-and-forget remote sync (progress + economy).
    sync.levelComplete(selectedLevelId, earnedStars);

    // ── Economy reward breakdown (guarded by wasComplete — fires once) ────────
    const elapsedMs = levelStartRef.current > 0 ? Date.now() - levelStartRef.current : Infinity;
    const breakdown = calcLevelReward(earnedStars, elapsedMs, selectedLevelId);

    // Store the breakdown so WinScene can display it.
    setLastWinPayload({ breakdown, earnedStars });

    player.addCoins(breakdown.total);
    audioManager.play('click');
    spawnCoinReward(breakdown.base, boardCx, boardCy);
    if (breakdown.perfectBonus > 0) {
      setTimeout(() => spawnCoinReward(breakdown.perfectBonus, boardCx, boardCy - 44), 240);
    }
    if (breakdown.speedBonus > 0) {
      setTimeout(() => spawnCoinReward(breakdown.speedBonus, boardCx, boardCy - 86), 480);
    }

    // 4 — "Puzzle Restored" text fades in at 700ms, then the scene transitions.
    const completionTimer = setTimeout(() => {
      const textEl = completionTextRef.current;
      if (textEl) {
        try {
          gsap.fromTo(textEl, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' });
        } catch { /* noop */ }
      }
    }, 700);

    // 8 — After the win FX, either show a reward chest (30%) or go to the win
    // scene. The chest appears BEFORE the win screen; claim/skip then advances.
    const spawnChest = Math.random() < CONFIG.chest.spawnChance;
    if (winTimerRef.current) clearTimeout(winTimerRef.current);
    winTimerRef.current = setTimeout(() => {
      clearTimeout(completionTimer);
      if (spawnChest) setShowChest(true);
      else useUIStore.getState().setScene('win');
    }, TIMINGS.winSceneDelay * 1000);

    const boardEl  = boardContainerRef.current;
    const revealEl = boardRevealRef.current;
    const guideEl  = guideWrapRef.current;
    const washEl   = goldWashRef.current;
    const trayEl   = trayRef.current;
    const shineEl  = shineRef.current;
    const glowEl   = boardGlowRef.current;

    const fallback = () => {
      if (revealEl) revealEl.style.opacity = '1';
      if (guideEl)  guideEl.style.opacity  = '0';
      if (washEl)   washEl.style.opacity   = '0';
      if (trayEl)   trayEl.style.opacity   = '0';
    };

    try {
      if (shineEl) gsap.set(shineEl, { scale: 0.6, opacity: 0 });

      const tl = gsap.timeline();
      const halfGlow = TIMINGS.winGlowWave * 0.5;

      // t=0 — fade out guide, gold wash, tray
      if (guideEl) tl.to(guideEl, { opacity: 0, duration: 0.4, ease: 'power2.out' }, 0);
      if (washEl)  tl.to(washEl,  { opacity: 0, duration: 0.4, ease: 'power2.out' }, 0);
      if (trayEl)  tl.to(trayEl,  { opacity: 0, duration: 0.4, ease: 'power2.out' }, 0);

      // 3 — Board scale 1 → 1.08 → 1 and glow 0 → 0.8 → 0 over winGlowWave (0.8s)
      if (boardEl) {
        tl.to(boardEl, { scale: 1.08, duration: halfGlow, ease: 'power2.out' }, 0);
        tl.to(boardEl, { scale: 1, duration: halfGlow, ease: 'back.out(2)' }, halfGlow);
      }
      if (glowEl) {
        tl.to(glowEl, { opacity: 0.8, duration: halfGlow, ease: 'power2.out' }, 0);
        tl.to(glowEl, { opacity: 0, duration: halfGlow, ease: 'power2.in' }, halfGlow);
      }

      // t=0.15 — center shine burst
      if (shineEl) {
        tl.to(shineEl, { scale: 1.4, duration: 0.5, ease: 'power1.in' }, 0.15);
        tl.to(shineEl, { opacity: 0.7, duration: 0.25, ease: 'power2.out' }, 0.15);
        tl.to(shineEl, { opacity: 0, duration: 0.25, ease: 'power2.in' }, 0.40);
      }

      // t=0.3 — board.png fades in
      if (revealEl) {
        tl.to(revealEl, { opacity: 1, duration: TIMINGS.completeEffect, ease: 'power2.inOut' }, 0.3);
      }
    } catch {
      fallback();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress.placed, progress.total]);

  const handlePieceDown = useCallback(
    (id: string, e: ReactPointerEvent) => {
      if (isComplete) return;
      startDrag(id, e);
    },
    [startDrag, isComplete],
  );

  const baseUrl = level ? levelBaseUrl(level.id) : '';

  // ── Loading / error states ────────────────────────────────────────────────
  if (loadState === 'loading' || loadState === 'idle') {
    return <CenterMessage text="Restoring mosaic…" />;
  }
  if (loadState === 'error') {
    return (
      <CenterMessage
        text="This mosaic could not be loaded."
        detail={error ?? undefined}
        action
      />
    );
  }

  const scale = layout?.scale ?? 0;
  const boardLocalLeft = layout ? layout.left - areaOrigin.left : 0;
  const boardLocalTop = layout ? layout.top - areaOrigin.top : 0;

  const draggingDef = draggingId ? pieces[draggingId]?.def : null;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* ── HUD ──────────────────────────────────────────────────────────── */}
      <GameHUD
        levelTitle={level?.id.replace('-', ' ') ?? 'Level 1'}
        placed={progress.placed}
        total={progress.total}
        percent={progress.percent}
        hearts={hearts}
        coins={coins}
        hintUsed={hintUsed}
        onBurger={() => { hapticsManager.trigger('light'); setIsPaused(true); }}
        onHint={handleHint}
        onShop={() => {
          if (!isComplete && !draggingId) useUIStore.getState().setShopOpen(true);
        }}
        disabled={isComplete}
        hintBtnRef={hintBtnRef}
      />

      {/* ── Board area ────────────────────────────────────────────────────── */}
      <div
        ref={areaRef}
        style={{
          flex: 1,
          minHeight: 0,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {layout && level && (
          <div
            ref={boardContainerRef}
            style={{
              position: 'absolute',
              left: boardLocalLeft,
              top: boardLocalTop,
              width: layout.width,
              height: layout.height,
              transformOrigin: 'center center',
            }}
          >
            {/* Layer 1: dark background gradient */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background:
                  'radial-gradient(circle at 50% 40%, rgba(210,180,140,0.12), rgba(26,15,0,0.75))',
                borderRadius: '4px',
              }}
            />

            {/* Layer 2: guide.png — ghosted, fades out on completion */}
            <div
              ref={guideWrapRef}
              style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
            >
              <FadingImage
                src={`${baseUrl}/${level.guide}`}
                style={{
                  filter: 'grayscale(60%) blur(2px) brightness(0.85) contrast(0.9)',
                  opacity: 0.18,
                }}
              />
            </div>

            {/* Layer 3: golden screen wash — fades out on completion */}
            <div
              ref={goldWashRef}
              aria-hidden
              style={{
                position: 'absolute',
                inset: 0,
                background: COLORS.gold,
                mixBlendMode: 'screen',
                opacity: 0.08,
                pointerEvents: 'none',
              }}
            />

            {/* Layer 4: snap slot dashes (only for unplaced pieces) */}
            {Object.values(pieces)
              .filter((p) => !p.placed)
              .map((p) => {
                const r = slotLocalRect(p.def, scale);
                return (
                  <div
                    key={`slot-${p.id}`}
                    style={{
                      position: 'absolute',
                      left: r.left,
                      top: r.top,
                      width: r.width,
                      height: r.height,
                      border: '1.5px dashed rgba(212,175,55,0.45)',
                      borderRadius: '3px',
                      background: 'rgba(212,175,55,0.04)',
                      pointerEvents: 'none',
                    }}
                  />
                );
              })}

            {/* Layer 4.5: snap slot pulse (brief gold border flash on correct snap) */}
            {snapFlashSlot && (
              <div
                ref={snapFlashRef}
                style={{
                  position: 'absolute',
                  left: snapFlashSlot.left,
                  top: snapFlashSlot.top,
                  width: snapFlashSlot.width,
                  height: snapFlashSlot.height,
                  border: `2px solid ${COLORS.gold}`,
                  boxShadow: `0 0 18px rgba(212,175,55,0.85), inset 0 0 12px rgba(212,175,55,0.35)`,
                  borderRadius: '3px',
                  pointerEvents: 'none',
                  opacity: 1,
                }}
              />
            )}

            {/* Layer 5: placed pieces — locked, no pointer events */}
            {Object.values(pieces)
              .filter((p) => p.placed)
              .map((p) => {
                const r = slotLocalRect(p.def, scale);
                return (
                  <div
                    key={`placed-${p.id}`}
                    style={{
                      position: 'absolute',
                      left: r.left,
                      top: r.top,
                      width: r.width,
                      height: r.height,
                      pointerEvents: 'none',
                      zIndex: 2,
                    }}
                  >
                    <PuzzlePiece
                      def={p.def}
                      baseUrl={baseUrl}
                      width={r.width}
                      height={r.height}
                      variant="board"
                    />
                  </div>
                );
              })}

            {/* Layer 6: center shine burst — GSAP animates on completion */}
            <div
              ref={shineRef}
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none',
                opacity: 0,
                transformOrigin: 'center center',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  width: '85%',
                  height: '85%',
                  borderRadius: '50%',
                  background:
                    'radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(212,175,55,0.85) 25%, rgba(212,175,55,0.35) 55%, transparent 75%)',
                }}
              />
            </div>

            {/* Layer 7: board.png — hidden during play, fades in on completion */}
            <div
              ref={boardRevealRef}
              style={{
                position: 'absolute',
                inset: 0,
                opacity: 0,
                pointerEvents: 'none',
              }}
            >
              <FadingImage src={`${baseUrl}/${level.board}`} />
            </div>

            {/* Hint overlay — board.png at 85% opacity, shown for 2.5s when hint used */}
            <div
              ref={hintOverlayRef}
              style={{
                position: 'absolute',
                inset: 0,
                display: 'none',
                pointerEvents: 'none',
                zIndex: 10,
                borderRadius: '4px',
                overflow: 'hidden',
              }}
            >
              <FadingImage src={`${baseUrl}/${level.board}`} />
              {/* Golden shimmer sweep — GSAP moves it left → right */}
              <div
                ref={hintShimmerRef}
                style={{
                  position: 'absolute',
                  inset: 0,
                  background:
                    'linear-gradient(90deg, transparent 0%, rgba(212,175,55,0.18) 35%, rgba(255,255,255,0.38) 46%, rgba(31,95,168,0.12) 54%, rgba(212,175,55,0.18) 65%, transparent 100%)',
                  pointerEvents: 'none',
                }}
              />
              {/* Soft vignette so it reads as a hint, not a full reveal */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background:
                    'radial-gradient(circle at 50% 50%, transparent 30%, rgba(26,15,0,0.4) 85%)',
                  pointerEvents: 'none',
                }}
              />
            </div>

            {/* Board glow burst — pulses on completion, bleeds outside the container */}
            <div
              ref={boardGlowRef}
              aria-hidden
              style={{
                position: 'absolute',
                inset: -20,
                borderRadius: '14px',
                pointerEvents: 'none',
                opacity: 0,
                boxShadow:
                  '0 0 60px rgba(212,175,55,0.9), 0 0 100px rgba(212,175,55,0.5), 0 0 140px rgba(212,175,55,0.25)',
              }}
            />

            {/* Hint glow — gold + turquoise pulse when hint fires */}
            <div
              ref={hintBoardGlowRef}
              aria-hidden
              style={{
                position: 'absolute',
                inset: -20,
                borderRadius: '14px',
                pointerEvents: 'none',
                opacity: 0,
                boxShadow:
                  '0 0 40px rgba(212,175,55,0.65), 0 0 70px rgba(31,95,168,0.4), 0 0 100px rgba(212,175,55,0.22)',
              }}
            />

            {/* Decorative gold frame */}
            <div
              aria-hidden
              style={{
                position: 'absolute',
                inset: -4,
                border: `2px solid ${COLORS.gold}`,
                borderRadius: '8px',
                boxShadow:
                  '0 0 30px rgba(212,175,55,0.2), 0 0 0 1px rgba(0,0,0,0.4) inset',
                pointerEvents: 'none',
              }}
            />
            <CornerFlourish corner="tl" size={22} inset={-2} />
            <CornerFlourish corner="tr" size={22} inset={-2} />
            <CornerFlourish corner="bl" size={22} inset={-2} />
            <CornerFlourish corner="br" size={22} inset={-2} />
          </div>
        )}

        {/* "Puzzle Restored" — fades in 700ms after final piece, sits above board */}
        <div
          ref={completionTextRef}
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            zIndex: 20,
            opacity: 0,
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(18px, 5vw, 26px)',
              fontWeight: 700,
              letterSpacing: '5px',
              textTransform: 'uppercase',
              color: COLORS.gold,
              textShadow: '0 0 30px rgba(212,175,55,0.8), 0 2px 12px rgba(0,0,0,0.6)',
              textAlign: 'center',
              padding: '12px 24px',
              background: 'rgba(26,15,0,0.55)',
              borderRadius: '6px',
              border: '1px solid rgba(212,175,55,0.3)',
            }}
          >
            Puzzle Restored
          </div>
        </div>
      </div>

      {/* ── Tray ──────────────────────────────────────────────────────────── */}
      <PieceTray
        ref={trayRef}
        baseUrl={baseUrl}
        trayOrder={trayOrder}
        piecesById={pieces}
        draggingId={draggingId}
        onPieceDown={handlePieceDown}
        locked={isComplete}
      />

      {/* ── Drag layer (glow + floating piece) ───────────────────────────── */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 50,
        }}
      >
        {/* Radial glow flash — always mounted, GSAP positions + fades it */}
        <div
          ref={glowRef}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: 280,
            height: 280,
            borderRadius: '50%',
            background:
              'radial-gradient(circle, rgba(212,175,55,0.9) 0%, rgba(212,175,55,0.5) 30%, rgba(212,175,55,0.12) 65%, transparent 80%)',
            pointerEvents: 'none',
            opacity: 0,
          }}
        />

        {draggingId && initRect && draggingDef && (
          <div
            ref={floatingRef}
            style={{
              position: 'fixed',
              left: 0,
              top: 0,
              width: initRect.width,
              height: initRect.height,
              transform: `translate(${initRect.left}px, ${initRect.top}px)`,
              transformOrigin: '0 0',
              willChange: 'transform',
              pointerEvents: 'none',
            }}
          >
            <PuzzlePiece
              def={draggingDef}
              baseUrl={baseUrl}
              width={initRect.width}
              height={initRect.height}
              variant="floating"
            />
          </div>
        )}
      </div>

      {/* ── Win particles ─────────────────────────────────────────────────── */}
      <WinParticles
        active={showParticles}
        originX={particleOrigin.x}
        originY={particleOrigin.y}
      />

      {/* ── Reward chest (shown before the win scene, 30% chance) ──────────── */}
      <ChestModal
        isOpen={showChest}
        onClose={() => {
          setShowChest(false);
          useUIStore.getState().setScene('win');
        }}
      />

      {/* ── Heart refill modal (shown when hearts reach 0) ─────────────────── */}
      <Modal isOpen={showHeartRefill} onClose={() => {}} title="Out of Hearts" locked>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', lineHeight: 1.7, color: COLORS.sandstone, textAlign: 'center' }}>
            Refill all hearts for <strong style={{ color: COLORS.gold }}>{getHeartRefillCost()} coins</strong>?
          </p>
          <PrimaryButton
            size="md"
            fullWidth
            onClick={() => {
              const ok = usePlayerStore.getState().spendCoins(getHeartRefillCost());
              if (ok) {
                useGameStore.getState().resetHearts();
                setShowHeartRefill(false);
              } else {
                setInsufficientCoins(`Need ${getHeartRefillCost()} coins`);
                setTimeout(() => setInsufficientCoins(null), 2200);
              }
            }}
          >
            ♥ &nbsp; Refill Hearts ({getHeartRefillCost()})
          </PrimaryButton>
          <SecondaryButton size="md" fullWidth onClick={() => { setShowHeartRefill(false); useUIStore.getState().setScene('gameover'); }}>
            Give Up
          </SecondaryButton>
        </div>
      </Modal>

      {/* ── Insufficient coins toast ────────────────────────────────────────── */}
      {insufficientCoins && (
        <div
          style={{
            position: 'fixed',
            bottom: 'calc(140px + var(--safe-area-bottom, 0px))',
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '10px 20px',
            borderRadius: '6px',
            background: 'rgba(26,15,0,0.92)',
            border: '1px solid rgba(204,34,0,0.5)',
            color: COLORS.sandstone,
            fontFamily: 'var(--font-heading)',
            fontSize: '11px',
            letterSpacing: '1px',
            whiteSpace: 'nowrap',
            zIndex: 300,
            pointerEvents: 'none',
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          }}
        >
          {insufficientCoins}
        </div>
      )}

      {/* ── Pause modal ───────────────────────────────────────────────────── */}
      <Modal isOpen={isPaused} onClose={handleResume} title="Paused" locked={false}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <PrimaryButton size="md" fullWidth onClick={handleResume}>
            ▶ &nbsp; Resume
          </PrimaryButton>
          <SecondaryButton size="md" fullWidth onClick={handleReplay}>
            ↺ &nbsp; Replay Level
          </SecondaryButton>
          <SecondaryButton size="md" fullWidth onClick={handleExit}>
            ✕ &nbsp; Exit to Menu
          </SecondaryButton>

          {/* Audio toggles */}
          <div style={{ borderTop: '1px solid rgba(212,175,55,0.12)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <AudioToggleRow
              label="Music"
              on={!musicMuted}
              onToggle={() => useAudioStore.getState().toggleMusic()}
            />
            <AudioToggleRow
              label="Sound FX"
              on={!sfxMuted}
              onToggle={() => useAudioStore.getState().toggleSfx()}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ── Audio toggle row (used in pause modal) ───────────────────────────────────
function AudioToggleRow({ label, on, onToggle }: { label: string; on: boolean; onToggle: () => void }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 2px',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-heading)',
          fontSize: '11px',
          letterSpacing: '2px',
          textTransform: 'uppercase',
          color: COLORS.sandstone,
          opacity: 0.8,
        }}
      >
        {label}
      </span>
      <button
        onClick={onToggle}
        style={{
          background: on ? `rgba(212,175,55,0.15)` : 'rgba(255,255,255,0.05)',
          border: `1px solid ${on ? COLORS.gold : 'rgba(212,175,55,0.25)'}`,
          borderRadius: '20px',
          padding: '3px 12px',
          fontFamily: 'var(--font-heading)',
          fontSize: '10px',
          letterSpacing: '1.5px',
          textTransform: 'uppercase',
          color: on ? COLORS.gold : 'rgba(212,175,55,0.35)',
          cursor: 'pointer',
          transition: 'all 0.18s ease',
        }}
      >
        {on ? 'ON' : 'OFF'}
      </button>
    </div>
  );
}

// ── Centered status message (loading / error) ────────────────────────────────
function CenterMessage({
  text,
  detail,
  action = false,
}: {
  text: string;
  detail?: string;
  action?: boolean;
}) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '14px',
        padding: '32px',
        textAlign: 'center',
      }}
    >
      <p
        style={{
          fontFamily: 'var(--font-heading)',
          fontSize: '14px',
          letterSpacing: '2px',
          color: COLORS.gold,
        }}
      >
        {text}
      </p>
      {detail && (
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '11px',
            color: COLORS.sandstone,
            opacity: 0.7,
          }}
        >
          {detail}
        </p>
      )}
      {action && (
        <button
          onClick={() => useUIStore.getState().setScene('mainMenu')}
          style={{
            marginTop: 8,
            padding: '10px 28px',
            background: 'transparent',
            border: `1px solid ${COLORS.gold}`,
            borderRadius: 2,
            color: COLORS.gold,
            fontFamily: 'var(--font-heading)',
            fontSize: '11px',
            letterSpacing: '2px',
            textTransform: 'uppercase',
            cursor: 'pointer',
          }}
        >
          Back to Menu
        </button>
      )}
    </div>
  );
}
