import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Plugin: serve src/assets/levels/ at /assets/levels/ ──────────────────────
//
// Problem this solves:
//   Vite only serves `public/` as static files. Level art lives in
//   `src/assets/levels/` (authoritative source). Without this plugin runtime
//   fetches to /assets/levels/* hit stale `public/assets/levels/` copies.
//
// Dev:   Requests to /assets/levels/* are intercepted before Vite's public
//        handler. Files found in src/ are returned with Cache-Control: no-cache.
//        Files NOT in src/ fall through to public/ as a compatibility shim.
//
// Build: After bundle write, src/assets/levels/ is copied into
//        dist/assets/levels/ — overwriting any stale public/ copies.

function srcLevelAssetsPlugin(): Plugin {
  const srcLevelsDir = path.resolve(__dirname, 'src/assets/levels');

  const MIME: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.json': 'application/json',
    '.txt': 'text/plain',
  };

  // Debug-only and unused assets — never ship to production.
  const EXCLUDED_FILES = new Set([
    'master.png',
    'debug_reconstruction.png',
    'segmentation_debug.png',
    'vision_debug.png',
    'preview.png',
    'guide.png',
    'placements.json',
  ]);

  function copyDirSync(src: string, dest: string): void {
    if (!fs.existsSync(src)) return;
    fs.mkdirSync(dest, { recursive: true });
    for (const item of fs.readdirSync(src)) {
      if (EXCLUDED_FILES.has(item)) continue;
      const s = path.join(src, item);
      const d = path.join(dest, item);
      fs.statSync(s).isDirectory() ? copyDirSync(s, d) : fs.copyFileSync(s, d);
    }
  }

  return {
    name: 'src-level-assets',

    configureServer(server) {
      const realBase = fs.realpathSync(srcLevelsDir);

      server.middlewares.use('/assets/levels', (req, res, next) => {
        // Strip query string and decode before joining to prevent traversal.
        const raw = (req as { url?: string }).url ?? '/';
        const decoded = decodeURIComponent(raw.split('?')[0]);
        const candidate = path.resolve(srcLevelsDir, '.' + decoded);

        // Resolve symlinks then verify the result stays inside srcLevelsDir.
        let realFile: string;
        try { realFile = fs.realpathSync(candidate); } catch { next(); return; }
        if (realFile !== realBase && !realFile.startsWith(realBase + path.sep)) {
          res.statusCode = 403; res.end('Forbidden'); return;
        }

        try {
          if (!fs.statSync(realFile).isFile()) { next(); return; }
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          res.setHeader('Pragma', 'no-cache');
          const ext = path.extname(realFile).toLowerCase();
          res.setHeader('Content-Type', MIME[ext] ?? 'application/octet-stream');
          fs.createReadStream(realFile).pipe(res);
        } catch {
          next(); // not in src/ → fall through to public/
        }
      });
    },

    closeBundle() {
      const distLevels = path.resolve(__dirname, 'dist/assets/levels');
      copyDirSync(srcLevelsDir, distLevels);
      console.log('[src-level-assets] Synced src/assets/levels → dist/assets/levels');
    },
  };
}

// ── Vite config ───────────────────────────────────────────────────────────────

export default defineConfig({
  plugins: [
    react({ jsxRuntime: 'automatic' }),
    srcLevelAssetsPlugin(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    target: 'es2020',
    assetsDir: 'assets',
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          gsap: ['gsap'],
          howler: ['howler'],
        },
      },
    },
  },
  server: {
    host: true,
    port: 5173,
  },
});
