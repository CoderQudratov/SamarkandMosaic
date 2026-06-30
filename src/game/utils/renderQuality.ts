// Handles high-quality texture processing for the swap puzzle renderer.
//
// Strategy:
//   1. Load board.png once (584×1022 for level-1).
//   2. Upscale 2× via progressive canvas steps (better than single-step bilinear).
//   3. Slice into individual tile canvases at 2× resolution.
//   4. At render time, each tile is displayed at or near its 2× size →
//      browser only needs a mild downscale instead of an upscale, which is
//      inherently sharper.
//
// Result: tiles are always in the "sweet spot" of slight downscaling on any DPR.

export interface RenderQualityInfo {
  sourceWidth: number;
  sourceHeight: number;
  upscaleFactor: number;
  upscaledWidth: number;
  upscaledHeight: number;
  tileSourceSize: number;
  tileUpscaledSize: number;
  devicePixelRatio: number;
  displayCellW: number;
  displayCellH: number;
  effectiveDeviceScale: number;
  smoothingEnabled: boolean;
  textureScaleMode: string;
  tilesSliced: number;
}

export interface RenderQualityReport {
  timestamp: string;
  levelId: number | string;
  sourceResolution: { width: number; height: number };
  tileResolution: { width: number; height: number };
  effectiveRenderScale: number;
  smoothingEnabled: boolean;
  textureScaleMode: string;
  devicePixelRatio: number;
  viewportSize: { width: number; height: number };
  boardSize: { width: number; height: number };
  upscaleFactor: number;
  tilesProcessed: number;
  tilesTotal: number;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load: ${src}`));
    img.src = src;
  });
}

// Progressive upscale: doubles repeatedly for integer-factor upscales.
// Uses 'high' imageSmoothingQuality at each step — closest to Lanczos in canvas API.
function progressiveScale(
  srcCanvas: HTMLCanvasElement,
  targetW: number,
  targetH: number,
): HTMLCanvasElement {
  let cur = srcCanvas;
  let curW = srcCanvas.width;
  let curH = srcCanvas.height;

  // Upscaling: double until within 2× of target
  while (curW * 2 <= targetW || curH * 2 <= targetH) {
    const nextW = Math.min(curW * 2, targetW);
    const nextH = Math.min(curH * 2, targetH);
    const next = document.createElement('canvas');
    next.width = nextW;
    next.height = nextH;
    const ctx = next.getContext('2d')!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(cur, 0, 0, nextW, nextH);
    cur = next;
    curW = nextW;
    curH = nextH;
  }

  // Downscaling: halve until within 2× of target
  while (curW / 2 >= targetW && curH / 2 >= targetH) {
    const nextW = Math.max(Math.ceil(curW / 2), targetW);
    const nextH = Math.max(Math.ceil(curH / 2), targetH);
    const next = document.createElement('canvas');
    next.width = nextW;
    next.height = nextH;
    const ctx = next.getContext('2d')!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(cur, 0, 0, nextW, nextH);
    cur = next;
    curW = nextW;
    curH = nextH;
  }

  // Final step if not yet exactly at target
  if (curW !== targetW || curH !== targetH) {
    const final = document.createElement('canvas');
    final.width = targetW;
    final.height = targetH;
    const ctx = final.getContext('2d')!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(cur, 0, 0, targetW, targetH);
    return final;
  }

  return cur;
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<string> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(URL.createObjectURL(blob));
      else reject(new Error('toBlob failed'));
    }, 'image/png');
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface TextureSet {
  // tileId (1-based) → blob URL at upscaled resolution
  tileUrls: Map<number, string>;
  boardUrl: string;
  guideUrl: string;
  qualityInfo: RenderQualityInfo;
  // Call when done to free memory
  revoke: () => void;
}

/**
 * Loads board.png, upscales it 2× via progressive canvas steps,
 * then slices it into per-tile blob URLs at 2× resolution.
 *
 * Also upscales guide.png for a sharper overlay.
 *
 * @param boardSrc   URL of board.png
 * @param guideSrc   URL of guide.png
 * @param cols       Grid columns
 * @param rows       Grid rows
 * @param tileSize   Source tile size in pixels (square)
 * @param displayCellW  CSS cell width in layout
 * @param displayCellH  CSS cell height in layout
 * @param dpr        window.devicePixelRatio
 */
export async function processBoardTextures(
  boardSrc: string,
  guideSrc: string,
  cols: number,
  rows: number,
  tileSize: number,
  displayCellW: number,
  displayCellH: number,
  dpr: number,
): Promise<TextureSet> {
  const blobUrls: string[] = [];

  // Device pixel size we want to serve each tile at.
  // Targeting 2× device pixels gives plenty of resolution for all DPRs.
  const targetDeviceW = Math.round(displayCellW * Math.max(dpr, 2));
  const targetDeviceH = Math.round(displayCellH * Math.max(dpr, 2));

  // Load both images in parallel
  const [boardImg, guideImg] = await Promise.all([
    loadImg(boardSrc),
    loadImg(guideSrc).catch(() => null), // guide is optional
  ]);

  const srcW = boardImg.naturalWidth;   // 584
  const srcH = boardImg.naturalHeight;  // 1022

  // Full board target size
  const boardTargetW = targetDeviceW * cols;
  const boardTargetH = targetDeviceH * rows;

  // Draw source into canvas then upscale
  const srcCanvas = document.createElement('canvas');
  srcCanvas.width = srcW;
  srcCanvas.height = srcH;
  const srcCtx = srcCanvas.getContext('2d')!;
  srcCtx.imageSmoothingEnabled = true;
  srcCtx.imageSmoothingQuality = 'high';
  srcCtx.drawImage(boardImg, 0, 0);

  const upscaledBoard = progressiveScale(srcCanvas, boardTargetW, boardTargetH);

  // Slice individual tiles from the upscaled board canvas
  const tileUrls = new Map<number, string>();
  const tileCanvas = document.createElement('canvas');
  tileCanvas.width = targetDeviceW;
  tileCanvas.height = targetDeviceH;
  const tileCtx = tileCanvas.getContext('2d')!;
  tileCtx.imageSmoothingEnabled = true;
  tileCtx.imageSmoothingQuality = 'high';

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const tileId = r * cols + c + 1;
      tileCtx.clearRect(0, 0, targetDeviceW, targetDeviceH);
      tileCtx.drawImage(
        upscaledBoard,
        c * targetDeviceW, r * targetDeviceH, targetDeviceW, targetDeviceH,  // src crop
        0, 0, targetDeviceW, targetDeviceH,                                   // dst
      );
      const blobUrl = await canvasToBlob(tileCanvas);
      blobUrls.push(blobUrl);
      tileUrls.set(tileId, blobUrl);
    }
  }

  // Board URL (upscaled, for background layer)
  const boardUrl = await canvasToBlob(upscaledBoard);
  blobUrls.push(boardUrl);

  // Guide URL (upscaled, same dimensions as board)
  let guideUrl = guideSrc;
  if (guideImg) {
    const guideCanvas = document.createElement('canvas');
    guideCanvas.width = srcW;
    guideCanvas.height = srcH;
    const gCtx = guideCanvas.getContext('2d')!;
    gCtx.drawImage(guideImg, 0, 0);
    const upscaledGuide = progressiveScale(guideCanvas, boardTargetW, boardTargetH);
    guideUrl = await canvasToBlob(upscaledGuide);
    blobUrls.push(guideUrl);
  }

  const upscaleFactor = Math.round((boardTargetW / srcW) * 100) / 100;

  const qualityInfo: RenderQualityInfo = {
    sourceWidth: srcW,
    sourceHeight: srcH,
    upscaleFactor,
    upscaledWidth: boardTargetW,
    upscaledHeight: boardTargetH,
    tileSourceSize: tileSize,
    tileUpscaledSize: targetDeviceW,
    devicePixelRatio: dpr,
    displayCellW: Math.round(displayCellW),
    displayCellH: Math.round(displayCellH),
    effectiveDeviceScale: Math.round((targetDeviceW / Math.round(displayCellW * dpr)) * 1000) / 1000,
    smoothingEnabled: true,
    textureScaleMode: 'progressive-bilinear-high',
    tilesSliced: tileUrls.size,
  };

  console.info('[renderQuality] Board textures processed:', qualityInfo);

  return {
    tileUrls,
    boardUrl,
    guideUrl,
    qualityInfo,
    revoke: () => {
      for (const url of blobUrls) URL.revokeObjectURL(url);
    },
  };
}

// ── Per-tile texture processing (for levels with individual tile files) ───────

/**
 * Loads individual pre-sliced tile images, upscales each 2× via progressive
 * canvas steps, then returns blob URLs at upscaled resolution.
 *
 * Each tile is scaled to its OWN natural pixel dimensions × upscale factor.
 * NEVER forces all tiles to a shared nominal size — non-uniform grids (where
 * rowHeights differ by 1–7px) would be compressed/stretched, creating black
 * gaps and broken ornament continuity at row seams.
 *
 * displayCellW/displayCellH are used only for the quality report metadata.
 */
export async function processTileTextures(
  sourceTileUrls: Map<number, string>,
  guideSrc: string | null,
  displayCellW: number,
  displayCellH: number,
  dpr: number,
): Promise<TextureSet> {
  const blobUrls: string[] = [];
  const tileUrls = new Map<number, string>();
  const upscaleFactor = Math.max(dpr, 2);

  for (const [tileId, src] of sourceTileUrls) {
    try {
      const img = await loadImg(src);
      const srcCanvas = document.createElement('canvas');
      srcCanvas.width = img.naturalWidth;
      srcCanvas.height = img.naturalHeight;
      srcCanvas.getContext('2d')!.drawImage(img, 0, 0);

      // Scale each tile by its OWN natural dimensions — preserves the exact
      // pixel aspect ratio. A 256×149 tile becomes 512×298 at 2× DPR; a
      // 256×142 tile becomes 512×284. Each then fills its CSS slot (which is
      // also 149 or 142 px tall respectively) with no stretching or gaps.
      const targetW = Math.round(img.naturalWidth  * upscaleFactor);
      const targetH = Math.round(img.naturalHeight * upscaleFactor);
      const upscaled = progressiveScale(srcCanvas, targetW, targetH);
      const blobUrl = await canvasToBlob(upscaled);
      blobUrls.push(blobUrl);
      tileUrls.set(tileId, blobUrl);
    } catch {
      // Failed tile: keep original URL (no blob, no revoke needed)
      tileUrls.set(tileId, src);
    }
  }

  const nominalUpscale = Math.round(upscaleFactor * 100) / 100;
  const qualityInfo: RenderQualityInfo = {
    sourceWidth: 0,
    sourceHeight: 0,
    upscaleFactor: nominalUpscale,
    upscaledWidth:  Math.round(displayCellW * upscaleFactor),
    upscaledHeight: Math.round(displayCellH * upscaleFactor),
    tileSourceSize: 0,
    tileUpscaledSize: Math.round(displayCellW * upscaleFactor),
    devicePixelRatio: dpr,
    displayCellW: Math.round(displayCellW),
    displayCellH: Math.round(displayCellH),
    effectiveDeviceScale: nominalUpscale,
    smoothingEnabled: true,
    textureScaleMode: 'per-tile-natural-upscale',
    tilesSliced: tileUrls.size,
  };

  console.info('[renderQuality] Tile textures processed:', qualityInfo);

  return {
    tileUrls,
    boardUrl: '',
    guideUrl: guideSrc ?? '',
    qualityInfo,
    revoke: () => { for (const url of blobUrls) URL.revokeObjectURL(url); },
  };
}

// ── Quality report ────────────────────────────────────────────────────────────

export function buildQualityReport(
  levelId: number | string,
  info: RenderQualityInfo,
  boardLayoutW: number,
  boardLayoutH: number,
  tilesTotal: number,
): RenderQualityReport {
  return {
    timestamp: new Date().toISOString(),
    levelId,
    sourceResolution: { width: info.sourceWidth, height: info.sourceHeight },
    tileResolution: { width: info.tileUpscaledSize, height: info.tileUpscaledSize },
    effectiveRenderScale: info.effectiveDeviceScale,
    smoothingEnabled: info.smoothingEnabled,
    textureScaleMode: info.textureScaleMode,
    devicePixelRatio: info.devicePixelRatio,
    viewportSize: { width: window.innerWidth, height: window.innerHeight },
    boardSize: { width: Math.round(boardLayoutW), height: Math.round(boardLayoutH) },
    upscaleFactor: info.upscaleFactor,
    tilesProcessed: info.tilesSliced,
    tilesTotal,
  };
}

export function downloadQualityReport(report: RenderQualityReport): void {
  const json = JSON.stringify(report, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'render_quality_report.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Sharpness debug PNG ───────────────────────────────────────────────────────

export async function generateSharpnessDebug(
  originalSrc: string,
  processedSrc: string,
  displayW: number,
  displayH: number,
  dpr: number,
): Promise<void> {
  const [orig, proc] = await Promise.all([
    loadImg(originalSrc),
    loadImg(processedSrc),
  ]);

  // Show at 3× display size for easy visual comparison
  const zoom = 3;
  const W = Math.round(displayW * zoom);
  const H = Math.round(displayH * zoom);
  const PAD = 16;
  const LABEL_H = 30;

  const canvas = document.createElement('canvas');
  canvas.width = W * 2 + PAD * 3;
  canvas.height = H + PAD * 2 + LABEL_H;

  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#1a0f00';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw both at high quality for comparison
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Left: original
  ctx.drawImage(orig, PAD, PAD + LABEL_H, W, H);
  ctx.fillStyle = '#D4AF37';
  ctx.font = 'bold 12px monospace';
  ctx.fillText(`ORIGINAL  ${orig.naturalWidth}×${orig.naturalHeight}`, PAD, PAD + LABEL_H - 10);

  // Right: processed (2× pre-upscaled, then downscaled to match)
  ctx.drawImage(proc, PAD * 2 + W, PAD + LABEL_H, W, H);
  ctx.fillText(
    `2× UPSCALED  ${proc.naturalWidth}×${proc.naturalHeight}  (DPR=${dpr})`,
    PAD * 2 + W,
    PAD + LABEL_H - 10,
  );

  // Divider
  ctx.strokeStyle = 'rgba(212,175,55,0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(Math.round(PAD * 1.5 + W), PAD);
  ctx.lineTo(Math.round(PAD * 1.5 + W), canvas.height - PAD);
  ctx.stroke();

  await new Promise<void>((resolve) => {
    canvas.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'sharpness_debug.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
      resolve();
    }, 'image/png');
  });
}
