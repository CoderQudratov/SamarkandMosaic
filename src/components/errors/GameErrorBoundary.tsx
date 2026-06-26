import { Component, type ErrorInfo, type ReactNode } from 'react';
import { COLORS } from '@/constants';
import { useUIStore } from '@/store/uiStore';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

// The only class component in the codebase — React error boundaries cannot be
// function components. It catches rendering errors inside PuzzleBoard and other
// game screens without crashing the entire app.
export class GameErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error('[GameErrorBoundary]', error, info.componentStack);
  }

  private handleRetry = (): void => {
    this.setState({ error: null });
  };

  private handleMenu = (): void => {
    this.setState({ error: null });
    useUIStore.getState().setScene('mainMenu');
  };

  render(): ReactNode {
    if (!this.state.error) return this.props.children;

    return (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '20px',
          padding: '40px 32px',
          background: '#1a0f00',
          textAlign: 'center',
        }}
      >
        {/* Star icon */}
        <span style={{ fontSize: '48px', lineHeight: 1, color: COLORS.gold, opacity: 0.7 }}>
          ✦
        </span>

        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(20px, 5vw, 26px)',
            fontWeight: 700,
            letterSpacing: '4px',
            textTransform: 'uppercase',
            color: COLORS.gold,
          }}
        >
          Restore Mosaic
        </h1>

        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '12px',
            lineHeight: 1.7,
            color: COLORS.sandstone,
            opacity: 0.75,
            maxWidth: '260px',
          }}
        >
          An unexpected error occurred. Your progress has been saved.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', maxWidth: '240px' }}>
          <button
            onClick={this.handleRetry}
            style={{
              padding: '14px',
              background: `linear-gradient(135deg, ${COLORS.gold}, ${COLORS.darkGold})`,
              border: `1px solid ${COLORS.gold}`,
              borderRadius: '2px',
              color: '#1a0f00',
              fontFamily: 'var(--font-heading)',
              fontSize: '12px',
              fontWeight: 700,
              letterSpacing: '3px',
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            ↺ &nbsp; Retry
          </button>
          <button
            onClick={this.handleMenu}
            style={{
              padding: '12px',
              background: 'transparent',
              border: `1px solid rgba(212,175,55,0.35)`,
              borderRadius: '2px',
              color: COLORS.sandstone,
              fontFamily: 'var(--font-heading)',
              fontSize: '11px',
              letterSpacing: '2.5px',
              textTransform: 'uppercase',
              cursor: 'pointer',
              opacity: 0.8,
            }}
          >
            Return to Menu
          </button>
        </div>
      </div>
    );
  }
}
