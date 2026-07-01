// ═════════════════════════════════════════════════════════════════════════════
// Edge Function: telegram-auth
// ═════════════════════════════════════════════════════════════════════════════
// Exchanges a Telegram WebApp `initData` string for a Supabase-compatible JWT.
//
// Flow:
//   1. Client sends { initData } (the raw string from window.Telegram.WebApp.initData).
//   2. We verify its HMAC signature against TELEGRAM_BOT_TOKEN (Telegram's
//      documented WebApp validation algorithm).
//   3. We extract telegram_id from the verified `user` field.
//   4. We mint an HS256 JWT signed with SUPABASE_JWT_SECRET carrying a
//      `telegram_id` claim, `role: authenticated`, `aud: authenticated`.
//      auth.telegram_id() (see supabase/migrations/20250625100001_*.sql) reads
//      that claim, so RLS policies scoped to telegram_id start working.
//   5. Return { access_token, expires_in }.
//
// Required project secrets (`supabase secrets set NAME=value`):
//   TELEGRAM_BOT_TOKEN  — the bot token from @BotFather
//   SUPABASE_JWT_SECRET — Project Settings → API → JWT Secret (NOT the anon/service key)
// ═════════════════════════════════════════════════════════════════════════════

import { create as createJWT } from 'https://deno.land/x/djwt@v3.0.2/mod.ts';

const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
const JWT_SECRET = Deno.env.get('SUPABASE_JWT_SECRET');

const TOKEN_TTL_SECONDS = 60 * 60; // 1 hour — client re-authenticates on every app boot
const MAX_AUTH_AGE_SECONDS = 24 * 60 * 60; // reject initData older than 24h

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function toHex(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function hmacSha256(keyMaterial: ArrayBuffer | Uint8Array, message: string): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey(
    'raw',
    keyMaterial,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
}

interface TelegramAuthUser {
  id: number;
  first_name?: string;
  username?: string;
}

// Verifies initData per Telegram's WebApp data-integrity algorithm:
// https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
async function verifyInitData(
  initData: string,
  botToken: string,
): Promise<{ ok: true; user: TelegramAuthUser; authDate: number } | { ok: false; reason: string }> {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return { ok: false, reason: 'missing hash' };
  params.delete('hash');

  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  // secret_key = HMAC_SHA256(bot_token, key="WebAppData")
  const secretKey = await hmacSha256(new TextEncoder().encode('WebAppData'), botToken);
  const computedHash = toHex(await hmacSha256(secretKey, dataCheckString));

  if (computedHash !== hash) return { ok: false, reason: 'hash mismatch' };

  const authDate = Number(params.get('auth_date'));
  if (!authDate || Date.now() / 1000 - authDate > MAX_AUTH_AGE_SECONDS) {
    return { ok: false, reason: 'initData expired' };
  }

  const userRaw = params.get('user');
  if (!userRaw) return { ok: false, reason: 'missing user' };

  let user: TelegramAuthUser;
  try {
    user = JSON.parse(userRaw);
  } catch {
    return { ok: false, reason: 'malformed user field' };
  }
  if (!user?.id) return { ok: false, reason: 'missing user.id' };

  return { ok: true, user, authDate };
}

// Deterministic UUID (v5-style via SHA-256, truncated) so the same Telegram
// user always maps to the same `sub` claim without needing a lookup table.
async function telegramIdToUuid(telegramId: number): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`telegram:${telegramId}`),
  );
  const bytes = new Uint8Array(digest).slice(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50; // version 5
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant
  const hex = toHex(bytes);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  if (!BOT_TOKEN || !JWT_SECRET) {
    console.error('[telegram-auth] Missing TELEGRAM_BOT_TOKEN or SUPABASE_JWT_SECRET secret');
    return json({ error: 'server misconfigured' }, 500);
  }

  let initData: string;
  try {
    const body = await req.json();
    initData = body.initData;
  } catch {
    return json({ error: 'invalid JSON body' }, 400);
  }
  if (!initData || typeof initData !== 'string') {
    return json({ error: 'initData is required' }, 400);
  }

  const verified = await verifyInitData(initData, BOT_TOKEN);
  if (!verified.ok) {
    return json({ error: `initData verification failed: ${verified.reason}` }, 401);
  }

  const telegramId = verified.user.id;
  const sub = await telegramIdToUuid(telegramId);
  const now = Math.floor(Date.now() / 1000);

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(JWT_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const accessToken = await createJWT(
    { alg: 'HS256', typ: 'JWT' },
    {
      sub,
      role: 'authenticated',
      aud: 'authenticated',
      iat: now,
      exp: now + TOKEN_TTL_SECONDS,
      telegram_id: telegramId,
    },
    key,
  );

  return json({ access_token: accessToken, expires_in: TOKEN_TTL_SECONDS });
});
