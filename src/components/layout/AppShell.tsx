import type { ReactNode } from 'react';
import { useUIStore } from '@/store/uiStore';

interface AppShellProps {
  children: ReactNode;
}

// Root shell: full-screen dark background with safe-area offsets.
// The Pixi canvas will be added inside this shell in the game phase.
export function AppShell({ children }: AppShellProps) {
  const safeArea = useUIStore((s) => s.safeArea);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100dvh',
        overflow: 'hidden',
        background: '#1a0f00',
        // Ambient background glow — very subtle warm center
        backgroundImage:
          'radial-gradient(ellipse 80% 50% at 50% 20%, rgba(212,175,55,0.07) 0%, transparent 70%)',
        paddingTop:    safeArea.top,
        paddingBottom: safeArea.bottom,
        paddingLeft:   safeArea.left,
        paddingRight:  safeArea.right,
        boxSizing: 'border-box',
      }}
    >
      {children}
    </div>
  );
}
