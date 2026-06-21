import { useEffect, useRef, type ReactNode } from 'react';
import { gsap } from '@/lib/gsap';
import { TIMINGS, COLORS } from '@/constants';
import { CornerFlourish } from '@/components/ui/CornerFlourish';

interface ModalProps {
  isOpen: boolean;
  onClose?: () => void;
  title?: string;
  children: ReactNode;
  /** Prevent backdrop click from closing */
  locked?: boolean;
}

export function Modal({ isOpen, onClose, title, children, locked = false }: ModalProps) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!backdropRef.current || !panelRef.current) return;

    if (isOpen) {
      gsap.set(backdropRef.current, { display: 'flex' });
      gsap.fromTo(
        backdropRef.current,
        { opacity: 0 },
        { opacity: 1, duration: TIMINGS.modalIn, ease: 'power2.out' },
      );
      gsap.fromTo(
        panelRef.current,
        { opacity: 0, y: 24, scale: 0.96 },
        { opacity: 1, y: 0, scale: 1, duration: TIMINGS.modalIn, ease: 'back.out(1.4)' },
      );
    } else {
      gsap.to([panelRef.current, backdropRef.current], {
        opacity: 0,
        duration: TIMINGS.modalOut,
        ease: 'power2.in',
        onComplete: () => {
          if (backdropRef.current) {
            backdropRef.current.style.display = 'none';
          }
        },
      });
    }
  }, [isOpen]);

  const handleBackdropClick = () => {
    if (!locked) onClose?.();
  };

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      style={{
        display: 'none',
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(8, 4, 0, 0.88)',
        padding: '24px',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '360px',
          background: 'linear-gradient(180deg, #1e1204 0%, #150c02 100%)',
          border: `1px solid rgba(212, 175, 55, 0.3)`,
          borderRadius: '4px',
          padding: '32px 28px',
          boxShadow: `0 0 60px rgba(212,175,55,0.12) inset, 0 24px 80px rgba(0,0,0,0.8)`,
        }}
      >
        {/* Corner flourishes */}
        <CornerFlourish corner="tl" />
        <CornerFlourish corner="tr" />
        <CornerFlourish corner="bl" />
        <CornerFlourish corner="br" />

        {/* Close button */}
        {onClose && !locked && (
          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              top: 12,
              right: 14,
              background: 'none',
              border: 'none',
              color: COLORS.gold,
              fontSize: '18px',
              cursor: 'pointer',
              opacity: 0.6,
              lineHeight: 1,
              padding: '4px',
            }}
            aria-label="Close"
          >
            ✕
          </button>
        )}

        {/* Title */}
        {title && (
          <h2
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '16px',
              fontWeight: 700,
              letterSpacing: '3px',
              textTransform: 'uppercase',
              color: COLORS.gold,
              textAlign: 'center',
              marginBottom: '20px',
            }}
          >
            {title}
          </h2>
        )}

        {children}
      </div>
    </div>
  );
}
