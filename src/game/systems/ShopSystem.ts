// ─── ShopSystem ───────────────────────────────────────────────────────────────
// Pure purchase logic for the in-game shop. No React.
//
// All transactions go through existing store actions (spendCoins / addHint /
// addHeart / resetHearts) so localStorage persistence is automatic and the
// SaveSystem subscription picks them up for the unified save.

import { usePlayerStore } from '@/store/playerStore';
import { useGameStore, MAX_HEARTS } from '@/store/gameStore';
import { sync } from '@/services/sync.service';
import { syncManager } from '@/game/systems/SyncManager';

// ── Catalog ──────────────────────────────────────────────────────────────────

export type ShopItemId = 'hints_pack' | 'hearts_pack' | 'starter_pack';

export interface ShopItem {
  id: ShopItemId;
  title: string;
  description: string;
  icon: string;     // emoji / glyph shown in card
  price: number;    // coins
  grants: { hints?: number; hearts?: number };
}

export const SHOP_CATALOG: readonly ShopItem[] = [
  {
    id: 'hints_pack',
    title: 'Hint Pack',
    description: '+3 Hints',
    icon: '✸',
    price: 60,
    grants: { hints: 3 },
  },
  {
    id: 'hearts_pack',
    title: 'Heart Pack',
    description: '+3 Hearts',
    icon: '♥',
    price: 80,
    grants: { hearts: 3 },
  },
  {
    id: 'starter_pack',
    title: 'Starter Pack',
    description: '+5 Hints + 5 Hearts',
    icon: '✦',
    price: 180,
    grants: { hints: 5, hearts: 5 },
  },
] as const;

// ── Purchase result ───────────────────────────────────────────────────────────

export type PurchaseResult = 'ok' | 'insufficient' | 'invalid';

// ── Anti-spam lock ────────────────────────────────────────────────────────────
// One purchase at a time — prevents double-taps and rapid repeat buys.
let _busy = false;

// ── Purchase ─────────────────────────────────────────────────────────────────

/**
 * Attempt to buy `itemId` from the shop.
 * • Returns 'ok' on success, 'insufficient' when coins are too few,
 *   'invalid' for unknown ids.
 * • The busy lock is released in both success and failure paths.
 */
export function purchaseItem(itemId: ShopItemId): PurchaseResult {
  if (_busy) return 'insufficient'; // treat busy as not-available
  const item = SHOP_CATALOG.find((i) => i.id === itemId);
  if (!item) return 'invalid';

  _busy = true;
  try {
    // Deduct coins first (atomic — returns false without mutating on failure).
    const ok = usePlayerStore.getState().spendCoins(item.price);
    if (!ok) return 'insufficient';

    // Grant items.
    const player = usePlayerStore.getState();
    const game = useGameStore.getState();

    if (item.grants.hints) {
      for (let i = 0; i < item.grants.hints; i++) player.addHint();
    }
    if (item.grants.hearts) {
      for (let i = 0; i < item.grants.hearts; i++) {
        if (game.hearts < MAX_HEARTS) game.addHeart();
      }
    }

    // Remote economy sync (fire-and-forget).
    sync.economy();
    syncManager.bumpVersion(); // shop purchase
    return 'ok';
  } finally {
    // Always release the lock so the UI can react immediately.
    _busy = false;
  }
}

/** True while a purchase is in flight (for UI button locking). */
export function isShopBusy(): boolean {
  return _busy;
}
