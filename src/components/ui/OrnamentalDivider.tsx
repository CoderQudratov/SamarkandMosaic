import { COLORS } from '@/constants';

interface OrnamentalDividerProps {
  width?: string;
  opacity?: number;
}

export function OrnamentalDivider({ width = '200px', opacity = 0.6 }: OrnamentalDividerProps) {
  return (
    <div
      aria-hidden
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '10px',
        width,
        opacity,
      }}
    >
      {/* Left line */}
      <div
        style={{
          flex: 1,
          height: '1px',
          background: `linear-gradient(to right, transparent, ${COLORS.gold})`,
        }}
      />
      {/* Center star diamond */}
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path
          d="M7 0 L8.5 5.5 L14 7 L8.5 8.5 L7 14 L5.5 8.5 L0 7 L5.5 5.5 Z"
          fill={COLORS.gold}
        />
      </svg>
      {/* Right line */}
      <div
        style={{
          flex: 1,
          height: '1px',
          background: `linear-gradient(to left, transparent, ${COLORS.gold})`,
        }}
      />
    </div>
  );
}
