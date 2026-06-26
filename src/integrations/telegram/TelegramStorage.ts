// ─── TelegramStorage ──────────────────────────────────────────────────────────
// Cloud-storage foundation using Telegram.CloudStorage where available,
// falling back to the existing storageService (localStorage) transparently.
//
// MIGRATION NOTE: Current game state persists entirely via storageService
// (per-key localStorage + unified sm_save). This module provides the cloud
// layer as a foundation for future migration without breaking existing saves.
//
// Constraints:
//   • CloudStorage keys must be <= 128 chars; values <= 4096 chars.
//   • Async-only API — callers must await.
//   • TWA CloudStorage is per-user and survives app reinstalls.

import { getTWA, isTelegramEnv } from '@/lib/telegram';
import { storageService } from '@/services/storage.service';

// ── Capability check ──────────────────────────────────────────────────────────

function cloudAvailable(): boolean {
  if (!isTelegramEnv()) return false;
  const twa = getTWA();
  return !!(twa && twa.CloudStorage);
}

// ── Core API ──────────────────────────────────────────────────────────────────

/**
 * Persist a string value under `key`.
 * Writes to Telegram CloudStorage when available; falls back to localStorage.
 */
export function save(key: string, value: string): Promise<void> {
  if (!cloudAvailable()) {
    storageService.set(key, value);
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    getTWA()!.CloudStorage.setItem(key, value, (err, stored) => {
      if (err || !stored) {
        // CloudStorage write failed — persist locally as fallback.
        storageService.set(key, value);
        reject(new Error(err ?? 'CloudStorage.setItem failed'));
      } else {
        resolve();
      }
    });
  });
}

/**
 * Load a string value for `key`.
 * Reads from Telegram CloudStorage when available; falls back to localStorage.
 * Returns null when the key does not exist.
 */
export function load(key: string): Promise<string | null> {
  if (!cloudAvailable()) {
    const raw = storageService.get<string>(key);
    return Promise.resolve(raw ?? null);
  }

  return new Promise((resolve) => {
    getTWA()!.CloudStorage.getItem(key, (err, value) => {
      if (err || value === undefined) {
        // Fall back to local storage.
        const local = storageService.get<string>(key);
        resolve(local ?? null);
      } else {
        resolve(value || null);
      }
    });
  });
}

/**
 * Remove a key from both CloudStorage and localStorage.
 */
export function remove(key: string): Promise<void> {
  storageService.remove(key); // always clear local copy

  if (!cloudAvailable()) return Promise.resolve();

  return new Promise((resolve) => {
    getTWA()!.CloudStorage.removeItem(key, () => resolve());
  });
}

/**
 * List all keys stored in CloudStorage (Telegram) or returns empty array in
 * browser mode (localStorage does not expose a scoped key listing).
 */
export function listKeys(): Promise<string[]> {
  if (!cloudAvailable()) return Promise.resolve([]);

  return new Promise((resolve) => {
    getTWA()!.CloudStorage.getKeys((err, keys) => {
      resolve(err ? [] : keys);
    });
  });
}

// ── Convenience typed helpers ─────────────────────────────────────────────────

/** Save any JSON-serialisable value. */
export async function saveJSON<T>(key: string, value: T): Promise<void> {
  try {
    await save(key, JSON.stringify(value));
  } catch {
    // Silent — localStorage fallback already handled inside save().
  }
}

/** Load and parse a JSON value. Returns null on missing/parse error. */
export async function loadJSON<T>(key: string): Promise<T | null> {
  try {
    const raw = await load(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
