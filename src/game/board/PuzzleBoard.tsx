import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { gsap } from '@/lib/gsap';
import { useBoardStore, selectProgress } from '@/store/boardStore';
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
import { CornerFlourish } from '@/components/ui/CornerFlourish';
import { COLORS, TIMINGS } from '@/constants';
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

  const areaRef = useRef<HTMLDivElement>(null);
  const trayRef = useRef<HTMLDivElement>(null);

  const [layout, setLayout] = useState<BoardLayout | null>(null);
  const [areaOrigin, setAreaOrigin] = useState({ left: 0, top: 0 });

  // ── Load level on mount, reset on unmount ─────────────────────────────────
  useEffect(() => {
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

  const onPlace = useCallback((id: string) => {
    useBoardStore.getState().placePiece(id);
  }, []);

  const onReturn = useCallback(() => {
    // Piece automatically reappears in the tray once draggingId clears.
  }, []);

  const { draggingId, initRect, floatingRef, startDrag } = usePuzzleDrag({
    getSlotRect,
    getTrayRect,
    onPlace,
    onReturn,
  });

  const handlePieceDown = useCallback(
    (id: string, e: ReactPointerEvent) => startDrag(id, e),
    [startDrag],
  );

  // ── Completion reveal ─────────────────────────────────────────────────────
  const boardRevealRef = useRef<HTMLDivElement>(null);
  const wasComplete = useRef(false);

  useEffect(() => {
    const isComplete = progress.total > 0 && progress.placed === progress.total;
    if (isComplete && !wasComplete.current) {
      wasComplete.current = true;
      if (boardRevealRef.current) {
        try {
          gsap.to(boardRevealRef.current, {
            opacity: 1,
            duration: TIMINGS.completeEffect,
            ease: 'power2.inOut',
          });
        } catch {
          if (boardRevealRef.current) boardRevealRef.current.style.opacity = '1';
        }
      }
    }
  }, [progress.placed, progress.total]);

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
      {/* ── Top bar: progress ─────────────────────────────────────────────── */}
      <div
        style={{
          flexShrink: 0,
          padding: '12px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          borderBottom: '1px solid rgba(212,175,55,0.12)',
        }}
      >
        <button
          onClick={() => useUIStore.getState().setScene('mainMenu')}
          style={{
            background: 'none',
            border: 'none',
            color: COLORS.gold,
            fontSize: '18px',
            cursor: 'pointer',
            opacity: 0.8,
            flexShrink: 0,
          }}
          aria-label="Back to menu"
        >
          ‹
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              height: 8,
              borderRadius: 4,
              background: '#3a2a00',
              overflow: 'hidden',
              border: '1px solid rgba(212,175,55,0.25)',
            }}
          >
            <div
              style={{
                width: `${progress.percent}%`,
                height: '100%',
                background: `linear-gradient(90deg, ${COLORS.darkGold}, ${COLORS.gold})`,
                transition: 'width 0.3s ease',
              }}
            />
          </div>
        </div>

        <span
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '12px',
            letterSpacing: '1.5px',
            color: COLORS.gold,
            flexShrink: 0,
          }}
        >
          {progress.placed}/{progress.total}
        </span>
      </div>

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
            style={{
              position: 'absolute',
              left: boardLocalLeft,
              top: boardLocalTop,
              width: layout.width,
              height: layout.height,
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

            {/* Layer 2: guide.png — ghosted, helps place pieces without revealing art */}
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
              <FadingImage
                src={`${baseUrl}/${level.guide}`}
                style={{
                  filter: 'grayscale(60%) blur(2px) brightness(0.85) contrast(0.9)',
                  opacity: 0.18,
                }}
              />
            </div>

            {/* Layer 3: golden screen wash over the guide */}
            <div
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

            {/* Layer 5: placed pieces */}
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

            {/* Layer 6: effects layer (reserved) */}
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />

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
      />

      {/* ── Drag layer (floating piece) ───────────────────────────────────── */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 50,
        }}
      >
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
