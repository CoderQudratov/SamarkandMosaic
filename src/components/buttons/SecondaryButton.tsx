import type { ReactNode, CSSProperties } from 'react';
import { useButtonAnimation } from '@/hooks/useButtonAnimation';
import { COLORS } from '@/constants';

interface SecondaryButtonProps {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  fullWidth?: boolean;
  size?: 'sm' | 'md' | 'lg';
  style?: CSSProperties;
}

const SIZE_MAP = {
  sm: { padding: '9px 24px',  fontSize: '11px', letterSpacing: '2.5px' },
  md: { padding: '13px 36px', fontSize: '13px', letterSpacing: '3px'   },
  lg: { padding: '16px 48px', fontSize: '14px', letterSpacing: '3.5px' },
} as const;

export function SecondaryButton({
  children,
  onClick,
  disabled = false,
  fullWidth = false,
  size = 'md',
  style,
}: SecondaryButtonProps) {
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
        background: 'transparent',
        border: `1px solid ${disabled ? 'rgba(212,175,55,0.2)' : 'rgba(212,175,55,0.5)'}`,
        borderRadius: '2px',
        color: disabled ? 'rgba(212,175,55,0.3)' : COLORS.gold,
        fontFamily: 'var(--font-heading)',
        fontSize: sz.fontSize,
        fontWeight: 600,
        letterSpacing: sz.letterSpacing,
        textTransform: 'uppercase',
        cursor: disabled ? 'not-allowed' : 'pointer',
        boxShadow: disabled ? 'none' : '0 2px 12px rgba(212,175,55,0.15)',
        opacity: disabled ? 0.5 : 1,
        willChange: 'transform',
        touchAction: 'manipulation',
        transition: 'border-color 0.15s ease, color 0.15s ease',
        ...style,
      }}
      onPointerEnter={(e) => {
        if (!disabled && ref.current) {
          ref.current.style.borderColor = COLORS.gold;
          ref.current.style.background = 'rgba(212,175,55,0.08)';
        }
        handlers.onPointerEnter();
        (e as unknown as { stopPropagation: () => void }).stopPropagation?.();
      }}
      onPointerLeave={() => {
        if (!disabled && ref.current) {
          ref.current.style.borderColor = 'rgba(212,175,55,0.5)';
          ref.current.style.background = 'transparent';
        }
        handlers.onPointerLeave();
      }}
    >
      {children}
    </button>
  );
}
