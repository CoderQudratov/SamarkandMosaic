// ─── ChestSystem ──────────────────────────────────────────────────────────────
// Pure reward logic for the post-level reward chest. The modal (React) calls
// rollChestReward() once when the player opens the chest, then applyChestReward()
// once on claim. Keeping roll + apply here keeps the component presentational.

import { usePlayerStore } from '@/store/playerStore';
import { useGameStore } from '@/store/gameStore';
import { CONFIG } from '@/constants';

export type ChestRewardType = 'coins' | 'heart' | 'hint' | 'shard';

export interface ChestReward {
  type: ChestRewardType;
  amount: number; // coin count, or 1 for single-item rewards
  label: string;  // display text, e.g. "+50 Coins"
}

// Probability bands (cumulative): coins 70%, heart 20%, hint 8%, shard 2%.
const P_COINS = 0.70;
const P_HEART = 0.90; // 0.70–0.90
const P_HINT = 0.98;  // 0.90–0.98
// remainder (0.98–1.0) → rare shard

/** Roll a single random reward from the chest pool. */
export function rollChestReward(): ChestReward {
  const r = Math.random();

  if (r < P_COINS) {
    const { coinMin, coinMax } = CONFIG.chest;
    const amount = Math.floor(coinMin + Math.random() * (coinMax - coinMin + 1));
    return { type: 'coins', amount, label: `+${amount} Coins` };
  }
  if (r < P_HEART) {
    return { type: 'heart', amount: 1, label: '+1 Heart' };
  }
  if (r < P_HINT) {
    return { type: 'hint', amount: 1, label: '+1 Hint' };
  }
  return { type: 'shard', amount: 1, label: 'Rare Shard' };
}

/** Apply a reward to the persistent stores (each action persists to localStorage). */
export function applyChestReward(reward: ChestReward): void {
  switch (reward.type) {
    case 'coins':
      usePlayerStore.getState().addCoins(reward.amount);
      break;
    case 'heart':
      useGameStore.getState().addHeart();
      break;
    case 'hint':
      usePlayerStore.getState().addHint();
      break;
    case 'shard':
      usePlayerStore.getState().addShard();
      break;
  }
}
