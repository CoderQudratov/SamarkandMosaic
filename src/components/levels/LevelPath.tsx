import { COLORS } from '@/constants';

interface LevelPathProps {
  /** Lit (bright gold) when the path leads to / from a completed level. */
  lit?: boolean;
}

// Ornamental golden connector drawn between two consecutive level cards.
// A vertical gradient line with a central diamond node — reads as a winding
// Samarkand path when stacked down the list.
export function LevelPath({ lit = false }: LevelPathProps) {
  const line = lit
    ? `linear-gradient(180deg, ${COLORS.gold}, ${COLORS.darkGold})`
    : 'linear-gradient(180deg, rgba(212,175,55,0.3), rgba(212,175,55,0.12))';
  const node = lit ? COLORS.gold : 'rgba(212,175,55,0.35)';

  return (
    <div
      aria-hidden
      style={{
        height: 40,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
      }}
    >
      {/* Upper line */}
      <div style={{ width: 2, flex: 1, background: line }} />
      {/* Diamond node */}
      <div
        style={{
          width: 9,
          height: 9,
          transform: 'rotate(45deg)',
          background: node,
          border: `1px solid ${lit ? COLORS.darkGold : 'rgba(212,175,55,0.2)'}`,
          boxShadow: lit ? `0 0 8px ${COLORS.gold}` : 'none',
          margin: '2px 0',
          flexShrink: 0,
        }}
      />
      {/* Lower line */}
      <div style={{ width: 2, flex: 1, background: line }} />
    </div>
  );
}
