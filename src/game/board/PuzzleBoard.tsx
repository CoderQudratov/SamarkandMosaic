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
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { COLORS, TIMINGS } from '@/constants';
import { audioManager } from '@/game/audio/AudioManager';
import { useAudioStore } from '@/store/audioStore';
import type { BoardLayout } from '@/game/types';
import type { Rect } from '@/game/utils/geometry';

const LEVEL_ID = 'level-1';

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
  const wasComplete = useRef(false);

  const areaRef = useRef<HTMLDivElement>(null);
  const trayRef = useRef<HTMLDivElement>(null);
  const hintOverlayRef = useRef<HTMLDivElement>(null);
  const hintActiveRef = useRef(false);

  const [layout, setLayout] = useState<BoardLayout | null>(null);
  const [areaOrigin, setAreaOrigin] = useState({ left: 0, top: 0 });

  // ── Load level on mount — also reset hearts ───────────────────────────────
  useEffect(() => {
    useGameStore.getState().resetHearts();
    useGameStore.getState().setStatus('playing');
    loadLevel(LEVEL_ID);
    return () => {
      useBoardStore.getState().reset();
    };
  }, []);

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
      if (!layout) return;
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
  const onWrongDrop = useCallback(() => {
    if (isComplete) return;
    audioManager.play('wrong');
    audioManager.play('loseHeart');
    useGameStore.getState().loseHeart();
    const remaining = useGameStore.getState().hearts;
    if (remaining === 0) {
      // Delay scene change so the shake animation is fully visible
      setTimeout(() => useUIStore.getState().setScene('gameover'), 700);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isComplete]);

  // ── Hint system ───────────────────────────────────────────────────────────
  const handleHint = useCallback(() => {
    if (hintUsed || hintActiveRef.current || isComplete) return;
    const el = hintOverlayRef.current;
    if (!el) return;
    hintActiveRef.current = true;
    audioManager.play('hint');

    try {
      gsap
        .timeline({
          onComplete: () => {
            setHintUsed(true);
            hintActiveRef.current = false;
          },
        })
        .set(el, { display: 'block', opacity: 0 })
        .to(el, { opacity: 0.82, duration: 0.3, ease: 'power2.out' })
        .to(el, { opacity: 0.82, duration: 2.5 })
        .to(el, { opacity: 0, duration: 0.35, ease: 'power2.in' })
        .set(el, { display: 'none' });
    } catch {
      setHintUsed(true);
      hintActiveRef.current = false;
    }
  }, [hintUsed, isComplete]);

  // ── Pause menu handlers ───────────────────────────────────────────────────
  const handleResume = useCallback(() => setIsPaused(false), []);

  const handleReplay = useCallback(() => {
    setIsPaused(false);
    setHintUsed(false);
    setShowParticles(false);
    wasComplete.current = false;
    setIsComplete(false);

    // Reset tray opacity in case win sequence faded it
    if (trayRef.current) gsap.set(trayRef.current, { opacity: 1 });

    useGameStore.getState().resetHearts();
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

    // Stop bg music and play win fanfare
    audioManager.stopBg(400);
    audioManager.play('win');

    // Particles burst from board center
    const boardCx = layout ? layout.left + layout.width / 2 : window.innerWidth / 2;
    const boardCy = layout ? layout.top + layout.height / 2 : window.innerHeight * 0.4;
    setParticleOrigin({ x: boardCx, y: boardCy });
    setShowParticles(true);

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
      setTimeout(() => useUIStore.getState().setScene('win'), 1200);
    };

    try {
      if (shineEl) gsap.set(shineEl, { scale: 0.6, opacity: 0 });

      const tl = gsap.timeline({
        onComplete: () =>
          setTimeout(() => useUIStore.getState().setScene('win'), 1200),
      });

      // t=0 — fade out guide, gold wash, tray
      if (guideEl) tl.to(guideEl, { opacity: 0, duration: 0.4, ease: 'power2.out' }, 0);
      if (washEl)  tl.to(washEl,  { opacity: 0, duration: 0.4, ease: 'power2.out' }, 0);
      if (trayEl)  tl.to(trayEl,  { opacity: 0, duration: 0.4, ease: 'power2.out' }, 0);

      // t=0 — board scale pulse (1 → 1.03 → 1, 0.6s) + glow burst
      if (boardEl) {
        tl.to(boardEl, { scale: 1.03, duration: 0.3, ease: 'power2.out' }, 0)
          .to(boardEl, { scale: 1, duration: 0.3, ease: 'back.out(2)' }, 0.3);
      }
      if (glowEl) {
        tl.to(glowEl, { opacity: 1, duration: 0.3, ease: 'power2.out' }, 0)
          .to(glowEl, { opacity: 0, duration: 0.3, ease: 'power2.in' }, 0.3);
      }

      // t=0.15 — center shine: scale 0.6→1.4 + opacity 0→0.7→0 over 0.5s
      if (shineEl) {
        tl.to(shineEl, { scale: 1.4, duration: 0.5, ease: 'power1.in' }, 0.15);
        tl.to(shineEl, { opacity: 0.7, duration: 0.25, ease: 'power2.out' }, 0.15);
        tl.to(shineEl, { opacity: 0, duration: 0.25, ease: 'power2.in' }, 0.40);
      }

      // t=0.3 — board.png fades in (timeline ends ~t=0.8)
      if (revealEl) {
        tl.to(revealEl, {
          opacity: 1,
          duration: TIMINGS.completeEffect,
          ease: 'power2.inOut',
        }, 0.3);
      }
    } catch {
      fallback();
    }
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
        hintUsed={hintUsed}
        onBurger={() => setIsPaused(true)}
        onHint={handleHint}
        disabled={isComplete}
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

            {/* Hint overlay — board.png at 80% opacity, shown for 2.5s when hint used */}
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
              {/* Soft vignette so it reads as a hint, not a full reveal */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background:
                    'radial-gradient(circle at 50% 50%, transparent 30%, rgba(26,15,0,0.45) 85%)',
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
