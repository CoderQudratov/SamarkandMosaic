import type { CSSProperties, ReactNode } from 'react';
import { useUIStore } from '@/store/uiStore';

interface SafeAreaViewProps {
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
  /** Skip top safe area inset (useful for screens that intentionally bleed under nav bar) */
  skipTop?: boolean;
  skipBottom?: boolean;
}

export function SafeAreaView({
  children,
  style,
  className,
  skipTop = false,
  skipBottom = false,
}: SafeAreaViewProps) {
  const safeArea = useUIStore((s) => s.safeArea);

  return (
    <div
      className={className}
      style={{
        width: '100%',
        height: '100%',
        paddingTop:    skipTop    ? 0 : safeArea.top,
        paddingBottom: skipBottom ? 0 : safeArea.bottom,
        paddingLeft:   safeArea.left,
        paddingRight:  safeArea.right,
        boxSizing: 'border-box',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
