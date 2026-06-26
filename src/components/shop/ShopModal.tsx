import { useRef, useState } from 'react';
import { gsap } from '@/lib/gsap';
import { COLORS } from '@/constants';
import { Modal } from '@/components/modals/Modal';
import { usePlayerStore } from '@/store/playerStore';
import { audioManager } from '@/game/audio/AudioManager';
import { hapticsManager } from '@/game/haptics/HapticsManager';
import { spawnCoinReward } from '@/game/effects/coinFX';
import {
  SHOP_CATALOG,
  purchaseItem,
  type ShopItem,
  type ShopItemId,
} from '@/game/systems/ShopSystem';

interface ShopModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Per-item state during a transaction.
type ItemState = 'idle' | 'buying' | 'success' | 'insufficient';

function ShopItemCard({
  item,
  coins,
}: {
  item: ShopItem;
  coins: number;
}) {
  const [state, setState] = useState<ItemState>('idle');
  const cardRef = useRef<HTMLDivElement>(null);
  const btnRef  = useRef<HTMLButtonElement>(null);
  const canAfford = coins >= item.price;

  const handleBuy = () => {
    if (state === 'buying') return; // anti-spam lock (UI layer)
    setState('buying');

    const result = purchaseItem(item.id as ShopItemId);

    if (result === 'ok') {
      // Coin-fly animation from button position.
      if (btnRef.current) {
        const r = btnRef.current.getBoundingClientRect();
        spawnCoinReward(-item.price, r.left + r.width / 2, r.top + r.height / 2);
      }
      // Button glow + success pulse on card.
      if (cardRef.current) {
        try {
          gsap.timeline()
            .to(cardRef.current, {
              boxShadow: '0 0 28px rgba(212,175,55,0.75), 0 0 0 2px rgba(212,175,55,0.5)',
              duration: 0.22,
              ease: 'power2.out',
            })
            .to(cardRef.current, {
              boxShadow: '0 0 0px rgba(212,175,55,0), 0 0 0 0px rgba(212,175,55,0)',
              duration: 0.45,
              ease: 'power2.in',
            });
          gsap.fromTo(
            cardRef.current,
            { scale: 1 },
            { scale: 1.04, duration: 0.15, yoyo: true, repeat: 1, ease: 'power2.out' },
          );
        } catch { /* noop */ }
      }
      audioManager.play('click');
      hapticsManager.trigger('success');
      setState('success');
      setTimeout(() => setState('idle'), 1400);
    } else {
      // Insufficient — red shake.
      if (cardRef.current) {
        try {
          gsap.killTweensOf(cardRef.current);
          gsap
            .timeline({ onComplete: () => setState('idle') })
            .to(cardRef.current, { x: -7, duration: 0.05, ease: 'power2.out' })
            .to(cardRef.current, { x: 7, duration: 0.08 })
            .to(cardRef.current, { x: -5, duration: 0.06 })
            .to(cardRef.current, { x: 0, duration: 0.05 });
          gsap.to(cardRef.current, {
            boxShadow: '0 0 20px rgba(204,34,0,0.6)',
            duration: 0.12,
            yoyo: true,
            repeat: 1,
          });
        } catch { setState('idle'); }
      } else {
        setState('idle');
      }
      hapticsManager.trigger('warning');
      setState('insufficient');
      setTimeout(() => setState('idle'), 1200);
    }
  };

  const btnLabel =
    state === 'buying'      ? '…'
    : state === 'success'   ? '✓  Bought'
    : state === 'insufficient' ? 'Not enough coins'
    : `${item.price} ✦`;

  const btnColor =
    state === 'success'     ? 'rgba(60,140,60,0.85)'
    : state === 'insufficient' ? 'rgba(140,40,40,0.7)'
    : canAfford             ? `linear-gradient(135deg, ${COLORS.gold}, ${COLORS.darkGold})`
    : 'rgba(212,175,55,0.18)';

  return (
    <div
      ref={cardRef}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        padding: '14px 16px',
        borderRadius: '6px',
        background: 'linear-gradient(180deg, rgba(32,19,4,0.97), rgba(20,12,2,0.99))',
        border: `1px solid rgba(212,175,55,${canAfford ? '0.32' : '0.14'})`,
        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        transition: 'border-color 0.2s ease',
      }}
    >
      {/* Icon */}
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: '50%',
          background: 'rgba(212,175,55,0.1)',
          border: `1.5px solid rgba(212,175,55,0.35)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '22px',
          flexShrink: 0,
          color: item.id === 'hearts_pack' ? '#CC2200' : COLORS.gold,
        }}
      >
        {item.icon}
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '13px',
            fontWeight: 700,
            letterSpacing: '1px',
            color: COLORS.ivory,
          }}
        >
          {item.title}
        </div>
        <div
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '10px',
            letterSpacing: '1px',
            color: COLORS.sandstone,
            opacity: 0.75,
            marginTop: '2px',
          }}
        >
          {item.description}
        </div>
      </div>

      {/* Buy button */}
      <button
        ref={btnRef}
        onClick={state === 'buying' ? undefined : handleBuy}
        disabled={state === 'buying'}
        style={{
          padding: '8px 14px',
          borderRadius: '4px',
          background: btnColor,
          border: `1px solid ${canAfford && state === 'idle' ? COLORS.gold : 'rgba(212,175,55,0.2)'}`,
          color: state !== 'idle' ? COLORS.ivory : canAfford ? '#1a0f00' : 'rgba(212,175,55,0.4)',
          fontFamily: 'var(--font-heading)',
          fontSize: '11px',
          fontWeight: 700,
          letterSpacing: '0.5px',
          cursor: state !== 'idle' || !canAfford ? 'default' : 'pointer',
          whiteSpace: 'nowrap',
          flexShrink: 0,
          minWidth: 90,
          textAlign: 'center',
          transition: 'all 0.15s ease',
          boxShadow: canAfford && state === 'idle'
            ? '0 2px 10px rgba(212,175,55,0.3)'
            : 'none',
        }}
      >
        {btnLabel}
      </button>
    </div>
  );
}

export function ShopModal({ isOpen, onClose }: ShopModalProps) {
  const coins = usePlayerStore((s) => s.coins);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Bazaar">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {/* Coin balance reminder */}
        <div
          style={{
            textAlign: 'center',
            marginBottom: '4px',
            fontFamily: 'var(--font-heading)',
            fontSize: '11px',
            letterSpacing: '2px',
            color: COLORS.sandstone,
            opacity: 0.75,
          }}
        >
          Your balance:&nbsp;
          <span style={{ color: COLORS.gold, fontWeight: 700 }}>{coins} ✦</span>
        </div>

        {SHOP_CATALOG.map((item) => (
          <ShopItemCard key={item.id} item={item} coins={coins} />
        ))}
      </div>
    </Modal>
  );
}
