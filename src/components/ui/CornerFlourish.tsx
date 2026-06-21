// Ornamental corner decoration — 4 instances placed at each card corner.
// Design: two short gold lines meeting at 90°, with a small diamond at the joint.
import { COLORS } from '@/constants';

type Corner = 'tl' | 'tr' | 'bl' | 'br';

interface CornerFlourishProps {
  corner: Corner;
  size?: number;
  color?: string;
  inset?: number;
}

const ROTATIONS: Record<Corner, string> = {
  tl: 'rotate(0deg)',
  tr: 'rotate(90deg)',
  br: 'rotate(180deg)',
  bl: 'rotate(270deg)',
};

const POSITIONS: Record<Corner, React.CSSProperties> = {
  tl: { top: 0, left: 0 },
  tr: { top: 0, right: 0 },
  br: { bottom: 0, right: 0 },
  bl: { bottom: 0, left: 0 },
};

export function CornerFlourish({
  corner,
  size = 20,
  color = COLORS.gold,
  inset = 6,
}: CornerFlourishProps) {
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        ...POSITIONS[corner],
        margin: inset,
        width: size,
        height: size,
        transform: ROTATIONS[corner],
        transformOrigin: 'center center',
        pointerEvents: 'none',
      }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none">
        {/* Horizontal arm */}
        <line x1="6" y1="2" x2={size} y2="2" stroke={color} strokeWidth="1.2" opacity="0.7" />
        {/* Vertical arm */}
        <line x1="2" y1="6" x2="2" y2={size} stroke={color} strokeWidth="1.2" opacity="0.7" />
        {/* Corner diamond */}
        <rect
          x="0"
          y="0"
          width="4"
          height="4"
          fill={color}
          opacity="0.8"
          transform="rotate(45 2 2)"
        />
      </svg>
    </div>
  );
}
