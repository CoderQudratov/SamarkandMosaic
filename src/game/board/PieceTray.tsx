import { forwardRef, type PointerEvent as ReactPointerEvent } from 'react';
import { PuzzlePiece } from '@/game/pieces/PuzzlePiece';
import type { PuzzlePieceRuntime } from '@/game/types';
import { CONFIG, COLORS } from '@/constants';

interface PieceTrayProps {
  baseUrl: string;
  trayOrder: string[];
  piecesById: Record<string, PuzzlePieceRuntime>;
  draggingId: string | null;
  onPieceDown: (id: string, e: ReactPointerEvent) => void;
  locked?: boolean;
}

// Width of a tray piece, preserving its natural aspect ratio at tray height.
function trayPieceWidth(piece: PuzzlePieceRuntime): number {
  const h = CONFIG.puzzle.trayPieceHeight;
  const aspect = piece.def.width / piece.def.height;
  return h * aspect;
}

export const PieceTray = forwardRef<HTMLDivElement, PieceTrayProps>(
  function PieceTray({ baseUrl, trayOrder, piecesById, draggingId, onPieceDown, locked }, ref) {
    return (
      <div
        ref={ref}
        style={{
          position: 'relative',
          flexShrink: 0,
          background: `linear-gradient(180deg, ${COLORS.sandstone} 0%, #b8956a 60%, #9c7b50 100%)`,
          borderTop: `2px solid ${COLORS.gold}`,
          boxShadow:
            '0 -6px 24px rgba(0,0,0,0.5), 0 2px 0 rgba(255,255,255,0.15) inset',
          pointerEvents: locked ? 'none' : undefined,
        }}
      >
        {/* Gold inner trim line */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: 4,
            left: 8,
            right: 8,
            height: 1,
            background: 'rgba(212,175,55,0.5)',
          }}
        />

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            padding: '14px 16px',
            overflowX: 'auto',
            overflowY: 'hidden',
            scrollSnapType: 'x proximity',
            WebkitOverflowScrolling: 'touch',
            minHeight: CONFIG.puzzle.trayPieceHeight + 28,
          }}
        >
          {trayOrder.length === 0 && (
            <span
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '11px',
                letterSpacing: '2px',
                textTransform: 'uppercase',
                color: COLORS.brick,
                opacity: 0.7,
                margin: '0 auto',
              }}
            >
              All pieces placed
            </span>
          )}

          {trayOrder.map((id) => {
            const piece = piecesById[id];
            if (!piece) return null;
            return (
              <div key={id} style={{ scrollSnapAlign: 'center' }}>
                <PuzzlePiece
                  def={piece.def}
                  baseUrl={baseUrl}
                  width={trayPieceWidth(piece)}
                  height={CONFIG.puzzle.trayPieceHeight}
                  draggable
                  variant="tray"
                  hidden={draggingId === id}
                  onPointerDown={(e) => onPieceDown(id, e)}
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  },
);
