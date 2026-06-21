import type { ReactNode, CSSProperties } from 'react';
import { useButtonAnimation } from '@/hooks/useButtonAnimation';
import { COLORS } from '@/constants';

interface PrimaryButtonProps {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  fullWidth?: boolean;
  size?: 'sm' | 'md' | 'lg';
  style?: CSSProperties;
}

const SIZE_MAP = {
  sm: { padding: '10px 28px', fontSize: '11px', letterSpacing: '3px' },
  md: { padding: '14px 40px', fontSize: '13px', letterSpacing: '3.5px' },
  lg: { padding: '18px 56px', fontSize: '15px', letterSpacing: '4px' },
} as const;

export function PrimaryButton({
  children,
  onClick,
  disabled = false,
  fullWidth = false,
  size = 'md',
  style,
}: PrimaryButtonProps) {
  const { ref, handlers } = useButtonAnimation(disabled);
  const sz = SIZE_MAP[size];

  return (
    <button
      ref={ref}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      {...handlers}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: fullWidth ? '100%' : 'auto',
        padding: sz.padding,
        background: disabled
          ? 'rgba(212, 175, 55, 0.2)'
          : `linear-gradient(135deg, ${COLORS.gold} 0%, ${COLORS.darkGold} 45%, ${COLORS.gold} 100%)`,
        border: `1px solid ${disabled ? 'rgba(212,175,55,0.3)' : COLORS.gold}`,
        borderRadius: '2px',
        color: disabled ? 'rgba(26, 15, 0, 0.4)' : '#1a0f00',
        fontFamily: 'var(--font-heading)',
        fontSize: sz.fontSize,
        fontWeight: 700,
        letterSpacing: sz.letterSpacing,
        textTransform: 'uppercase',
        cursor: disabled ? 'not-allowed' : 'pointer',
        boxShadow: disabled
          ? 'none'
          : '0 4px 24px rgba(212,175,55,0.35), 0 1px 0 rgba(255,255,255,0.15) inset',
        opacity: disabled ? 0.5 : 1,
        willChange: 'transform',
        touchAction: 'manipulation',
        transition: 'opacity 0.15s ease',
        // Gold sheen lines via repeating gradient overlay
        backgroundSize: '200% 100%',
        ...style,
      }}
    >
      {/* Inner highlight line — gives the "engraved" feel from design.md */}
      <span
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '2px',
          background:
            'linear-gradient(180deg, rgba(255,255,255,0.12) 0%, transparent 50%)',
          pointerEvents: 'none',
        }}
      />
      {children}
    </button>
  );
}
