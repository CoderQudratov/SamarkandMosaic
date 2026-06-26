import { memo, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { PuzzlePieceDef } from '@/game/types';
import { COLORS } from '@/constants';

interface PuzzlePieceProps {
  def: PuzzlePieceDef;
  baseUrl: string;
  width: number;
  height: number;
  /** Enables drag affordances (cursor, touch-action, hover lift). */
  draggable?: boolean;
  onPointerDown?: (e: ReactPointerEvent) => void;
  /** Rendering context — affects shadow / lift styling. */
  variant?: 'tray' | 'board' | 'floating';
  hidden?: boolean;
}

// Extract a human label from an id like "piece-3" → "3".
function pieceLabel(id: string): string {
  const m = id.match(/(\d+)\s*$/);
  return m ? m[1] : id;
}

// Memoized: re-renders only when def.id, size, or variant changes.
// This prevents every placed piece from repainting on unrelated store updates.
export const PuzzlePiece = memo(function PuzzlePiece({
  def,
  baseUrl,
  width,
  height,
  draggable = false,
  onPointerDown,
  variant = 'tray',
  hidden = false,
}: PuzzlePieceProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const src = `${baseUrl}/${def.image}`;

  const shadow =
    variant === 'floating'
      ? '0 18px 40px rgba(0,0,0,0.55), 0 0 0 1px rgba(212,175,55,0.5)'
      : variant === 'board'
        ? '0 4px 14px rgba(0,0,0,0.35), 0 0 0 1px rgba(212,175,55,0.25)'
        : '0 6px 18px rgba(0,0,0,0.4), 0 1px 0 rgba(255,255,255,0.12) inset';

  return (
    <div
      onPointerDown={onPointerDown}
      data-piece-id={def.id}
      className={draggable ? 'puzzle-piece-draggable' : undefined}
      style={{
        width,
        height,
        position: 'relative',
        boxShadow: shadow,
        cursor: draggable ? 'grab' : 'default',
        touchAction: draggable ? 'none' : 'auto',
        opacity: hidden ? 0 : 1,
        userSelect: 'none',
        WebkitUserSelect: 'none',
        flex: '0 0 auto',
      }}
    >
      {!imgFailed && (
        <img
          src={src}
          alt={def.id}
          draggable={false}
          onError={() => setImgFailed(true)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            display: 'block',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Ceramic placeholder (shown only when the image fails to load) */}
      {imgFailed && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: `2px solid ${COLORS.gold}`,
            borderRadius: '6px',
            background: `linear-gradient(150deg, ${COLORS.sandstone} 0%, ${COLORS.brick} 100%)`,
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: `${Math.max(14, Math.min(width, height) * 0.32)}px`,
              fontWeight: 700,
              color: COLORS.ivory,
              textShadow: '0 1px 4px rgba(0,0,0,0.6)',
            }}
          >
            {pieceLabel(def.id)}
          </span>
        </div>
      )}
    </div>
  );
});
