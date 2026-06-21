import { COLORS } from '@/constants';

interface TimuridStarProps {
  size?: number;
  color?: string;
  glowing?: boolean;
}

// 8-pointed star inspired by Timurid / Islamic geometric art
export function TimuridStar({ size = 80, color = COLORS.gold, glowing = false }: TimuridStarProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={
        glowing
          ? { filter: `drop-shadow(0 0 12px ${color})` }
          : undefined
      }
    >
      {/* Outer decorative ring */}
      <circle cx="40" cy="40" r="38" stroke={color} strokeWidth="0.8" opacity="0.4" />

      {/* 8-pointed star — two overlapping squares rotated 45° */}
      <path
        d="M40 6 L46 22 L62 16 L56 32 L74 38 L58 44 L64 62 L48 56 L42 74 L36 58 L20 64 L24 48 L6 42 L22 36 L16 18 L32 24 Z"
        fill={color}
        opacity="0.9"
      />

      {/* Inner octagon ring */}
      <circle cx="40" cy="40" r="14" fill="none" stroke={color} strokeWidth="1" opacity="0.6" />

      {/* Center jewel */}
      <circle cx="40" cy="40" r="5" fill={color} />

      {/* 4 corner small dots */}
      {[
        [40, 16],
        [64, 40],
        [40, 64],
        [16, 40],
      ].map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="2" fill={color} opacity="0.5" />
      ))}
    </svg>
  );
}
