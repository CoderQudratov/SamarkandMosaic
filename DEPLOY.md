# Samarkand Mosaic — Production Deployment Guide

## 1. Prerequisites

| Requirement | Where |
|---|---|
| Node 18+ | `node -v` |
| Vercel account | vercel.com |
| Telegram Bot (from @BotFather) | t.me/BotFather |
| Supabase project | supabase.com (optional — app works without it) |

---

## 2. Environment Variables

Set in Vercel Dashboard → Project → Settings → Environment Variables.

| Variable | Value | Required |
|---|---|---|
| `VITE_SUPABASE_URL` | `https://YOUR_PROJECT.supabase.co` | Optional |
| `VITE_SUPABASE_ANON_KEY` | Your project's **anon/public** key | Optional |

**Security rules:**
- ✅ Use the `anon` key (safe to expose in browser builds)
- ❌ NEVER set `SUPABASE_SERVICE_ROLE_KEY` here
- ❌ NEVER set any bot token here
- If both Supabase vars are absent, the app runs in localStorage-only mode — fully functional

---

## 3. Vercel Deployment

```bash
# First deploy
npx vercel --prod

# Subsequent deploys (from main branch)
git push origin main   # Vercel auto-deploys on push
```

After deploy, Vercel assigns a URL like `https://samarkand-mosaic.vercel.app`.

**The `vercel.json` already handles:**
- SPA routing (all paths → `/index.html`)
- Long-term caching for hashed assets (`Cache-Control: max-age=31536000, immutable`)
- `Accept-Ranges: bytes` on audio (enables Howler seeking)
- Security headers (`X-Content-Type-Options`, `X-Frame-Options: ALLOWALL`, `Referrer-Policy`)
- `Permissions-Policy: vibrate=self` (enables haptics inside Telegram)

---

## 4. Supabase Database Setup

Run the four MVP migrations in order in the Supabase SQL Editor:

```
supabase/migrations/20250625100001_mvp_create_profiles.sql
supabase/migrations/20250625100002_mvp_create_progress.sql
supabase/migrations/20250625100003_mvp_create_economy.sql
supabase/migrations/20250625100004_mvp_create_daily_rewards.sql
```

Or with the Supabase CLI:
```bash
supabase db push
```

---

## 5. BotFather Setup (Telegram Mini App)

Send these commands to **@BotFather** in Telegram, in order:

### 5a. Create the bot (if you don't have one)
```
/newbot
```
Enter name: `Samarkand Mosaic Bot`
Enter username: `SamarkandMosaicBot` (or available variation)

Save the **bot token** — you'll need it for initData validation later.

### 5b. Create the Mini App
```
/newapp
```
Select your bot when prompted.

Enter:
- **Title:** `Samarkand Mosaic`
- **Description:** `Restore ancient Timurid mosaics. A premium ASMR puzzle game.`
- **Photo:** Upload a 640×360px screenshot (JPEG)
- **URL:** `https://samarkand-mosaic.vercel.app` ← your Vercel URL

### 5c. Set the Web App domain
```
/setdomain
```
Select your bot.
Enter: `samarkand-mosaic.vercel.app`

### 5d. Update description
```
/setdescription
```
Select your bot.
Enter:
```
Restore ancient Samarkand mosaics piece by piece.
✦ ASMR puzzle gameplay
✦ Premium Timurid aesthetic
✦ Daily rewards & streak system
✦ Level progression & star ratings
```

### 5e. Short description (shown in search)
```
/setshortdescription
```
Select your bot.
Enter: `Premium ASMR mosaic puzzle. Restore ancient Timurid artworks.`

### 5f. Menu button (optional — launches the app from chat)
```
/setmenubutton
```
Select your bot.
- **Button text:** `Play`
- **URL:** `https://samarkand-mosaic.vercel.app`

### 5g. Verify HTTPS
The Mini App URL **must** be `https://`. Telegram refuses to load `http://` URLs.
Vercel provides HTTPS automatically.

---

## 6. Telegram SDK Production Checklist

After setting the domain, test in a real Telegram client (not browser):

| Feature | How to test |
|---|---|
| App opens full-screen | `expand()` called on boot — verify no blank strip at top |
| Theme colours applied | App background matches Telegram's current theme |
| BackButton visible | Navigate to LevelSelect — Telegram header shows ← |
| MainButton visible | Complete a level → "NEXT LEVEL" button appears at bottom |
| Haptics fire | Wrong drop → device vibrates (Android/iOS with haptics enabled) |
| Closing confirmation | Swipe down to close → Telegram shows "Leave?" dialog |
| initData present | `window.Telegram.WebApp.initData` non-empty |

---

## 7. Security Validation

| Check | Status |
|---|---|
| `.env` in `.gitignore` | ✅ (line 3 of .gitignore) |
| Anon key only in client build | ✅ — config.ts guards with `?? ''` fallback |
| No service-role key | ✅ — never referenced in frontend code |
| No bot token in client | ✅ — not referenced anywhere |
| HTTPS enforced by Telegram | ✅ — Mini Apps only run on HTTPS |
| RLS on all Supabase tables | ✅ — every table has owner-only policies |
| initData validation required for RLS | ⚠️ — needs Edge Function for production auth |

**The one remaining security gap:** RLS policies rely on a `telegram_id` JWT claim. For MVP,
the frontend calls Supabase with the anon key (no user-specific JWT). This means all rows
are currently readable by anyone with the anon key. **Before public launch:**
1. Create a Supabase Edge Function that validates `initData` HMAC
2. The function calls `auth.sign({ telegram_id })` and returns a JWT
3. Client uses this JWT for all subsequent Supabase calls
4. RLS then enforces per-user isolation correctly

---

## 8. Production Smoke Test Checklist

After deployment, run through these manually in Telegram:

- [ ] App opens without white flash
- [ ] Splash screen loads with progress bar (smooth, not jumping)
- [ ] Daily reward modal appears on first open
- [ ] Coin balance shows in top bar
- [ ] Play → Level Select → Level 1 loads
- [ ] Pieces appear in tray (no blank images)
- [ ] Drag a piece to wrong slot → shake + red pulse
- [ ] Drag a piece to correct slot → gold flash + snap sound
- [ ] Complete level → win FX + "Mosaic Restored" text
- [ ] Win screen shows coin breakdown
- [ ] Shop opens (via top-bar coin or Bazaar button)
- [ ] Buy Hint Pack (if enough coins) → hints increment
- [ ] Close app, reopen → progress restored
- [ ] BackButton (Telegram ←) → navigates back correctly

---

## 9. Bundle Analysis

| Chunk | Size (gzip) | Cached after first load |
|---|---|---|
| `vendor` (React + ReactDOM) | 45 KB | ✅ until React version changes |
| `gsap` | 28 KB | ✅ until GSAP version changes |
| `howler` | 10 KB | ✅ until Howler version changes |
| `index` (game code) | 39 KB | ✅ until game code changes |
| CSS | 1.2 KB | ✅ |
| **Total first load** | **~123 KB** | — |
| **Returning visit** | **~39 KB** | ← only game chunk re-fetched on deploy |

Logo PNG (2.2 MB) is the dominant asset. **Pre-launch optimization:** re-encode to WebP ≤ 100 KB.

---

## 10. Post-Launch Monitoring

- **Vercel Analytics** — enable in Dashboard → Analytics
- **Supabase Dashboard** — monitor DB usage, slow queries
- **Error tracking** — consider adding Sentry (the `GameErrorBoundary` catches all React render errors)
