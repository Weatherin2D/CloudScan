import type { RhiCrossSectionData } from "@/lib/rhiCrossSection";
import { colorAtDbz, DEFAULT_PAL_STOPS } from "@/lib/palPalette";

export const KM_TO_KFT = 3.28084;
export const DEFAULT_RHI_MAX_KFT = 50;

export function kmToKft(km: number): number {
  return km * KM_TO_KFT;
}

export function rhiCellColor(dbz: number | null): string {
  if (dbz == null) return "#0a0a0a";
  const [r, g, b] = colorAtDbz(dbz, DEFAULT_PAL_STOPS);
  return `rgb(${r},${g},${b})`;
}

function dbzToRgba(dbz: number | null): [number, number, number, number] {
  if (dbz == null) return [5, 5, 5, 255];
  const [r, g, b] = colorAtDbz(dbz, DEFAULT_PAL_STOPS);
  return [r, g, b, 255];
}

export interface RhiDrawBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  padL?: number;
  padR?: number;
  padT?: number;
  padB?: number;
}

export interface RhiDrawOptions {
  maxHeightKft?: number;
  showGrid?: boolean;
  showLabels?: boolean;
  showFrame?: boolean;
}

function plotArea(bounds: RhiDrawBounds) {
  const padL = bounds.padL ?? 36;
  const padR = bounds.padR ?? 12;
  const padT = bounds.padT ?? 8;
  const padB = bounds.padB ?? 20;
  return {
    padL,
    padR,
    padT,
    padB,
    plotW: bounds.width - padL - padR,
    plotH: bounds.height - padT - padB,
    plotX: bounds.x + padL,
    plotY: bounds.y + padT,
  };
}

function sampleVolumeBilinear(
  data: RhiCrossSectionData,
  distKm: number,
  heightKm: number,
): number | null {
  const cols = data.distancesKm.length;
  const rows = data.heightsKm.length;
  if (cols === 0 || rows === 0) return null;

  const dists = data.distancesKm;
  const maxDist = dists[cols - 1] ?? 0;
  if (maxDist <= 0) return null;

  const clampedDist = Math.max(0, Math.min(maxDist, distKm));
  let d0 = 0;
  while (d0 < cols - 1 && dists[d0 + 1] < clampedDist) d0++;
  const d1 = Math.min(cols - 1, d0 + 1);
  const span = dists[d1] - dists[d0];
  const dt = span > 1e-6 ? (clampedDist - dists[d0]) / span : 0;

  const maxH = data.heightsKm[rows - 1] ?? data.maxHeightKm;
  const hNorm = Math.max(0, Math.min(1, heightKm / maxH));
  const hPos = hNorm * Math.max(1, rows - 1);
  const h0 = Math.floor(hPos);
  const h1 = Math.min(rows - 1, h0 + 1);
  const ht = hPos - h0;

  const v = data.values;
  const q00 = v[h0]?.[d0] ?? null;
  const q10 = v[h0]?.[d1] ?? null;
  const q01 = v[h1]?.[d0] ?? null;
  const q11 = v[h1]?.[d1] ?? null;

  const lerp = (a: number | null, b: number | null, t: number) => {
    if (a == null && b == null) return null;
    if (a == null) return b;
    if (b == null) return a;
    return a + t * (b - a);
  };

  const top = lerp(q00, q10, dt);
  const bot = lerp(q01, q11, dt);
  return lerp(top, bot, ht);
}

function drawVolumeImage(
  ctx: CanvasRenderingContext2D,
  data: RhiCrossSectionData,
  plotX: number,
  plotY: number,
  plotW: number,
  plotH: number,
  maxHeightKm: number,
) {
  const w = Math.max(1, Math.ceil(plotW));
  const h = Math.max(1, Math.ceil(plotH));
  const image = ctx.createImageData(w, h);
  const px = image.data;

  for (let y = 0; y < h; y++) {
    const heightKm = maxHeightKm * (1 - y / h);
    for (let x = 0; x < w; x++) {
      const maxDist = data.distancesKm[data.distancesKm.length - 1] ?? data.lineLengthKm;
      const distKm = maxDist * (x / Math.max(1, w - 1));
      const dbz = sampleVolumeBilinear(data, distKm, heightKm);
      const [r, g, b, a] = dbzToRgba(dbz);
      const i = (y * w + x) * 4;
      px[i] = r;
      px[i + 1] = g;
      px[i + 2] = b;
      px[i + 3] = a;
    }
  }

  ctx.putImageData(image, plotX, plotY);
}

/** Draw high-resolution RHI cross-section from the dense volume grid. */
export function drawRhiCrossSection(
  ctx: CanvasRenderingContext2D,
  data: RhiCrossSectionData,
  bounds: RhiDrawBounds,
  options: RhiDrawOptions = {},
) {
  const { plotW, plotH, plotX, plotY, padL, padT } = plotArea(bounds);
  const maxHeightKft = options.maxHeightKft ?? DEFAULT_RHI_MAX_KFT;
  const maxHeightKm = maxHeightKft / KM_TO_KFT;

  ctx.fillStyle = "#050505";
  ctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);

  if (data.heightsKm.length === 0 || data.distancesKm.length === 0) return;

  drawVolumeImage(ctx, data, plotX, plotY, plotW, plotH, maxHeightKm);

  if (options.showGrid !== false) {
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 1;
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "right";

    for (let kft = 10; kft <= maxHeightKft; kft += 10) {
      const y = plotY + plotH - (kft / KM_TO_KFT / maxHeightKm) * plotH;
      ctx.beginPath();
      ctx.moveTo(plotX, y);
      ctx.lineTo(plotX + plotW, y);
      ctx.stroke();
      if (options.showLabels !== false) {
        ctx.fillText(`${kft}`, plotX - 4, y + 3);
        ctx.textAlign = "left";
        ctx.fillText(`${kft}`, plotX + plotW + 4, y + 3);
        ctx.textAlign = "right";
      }
    }
  }

  if (options.showFrame !== false) {
    ctx.strokeStyle = "rgba(255,255,255,0.65)";
    ctx.lineWidth = 1;
    ctx.strokeRect(plotX, plotY, plotW, plotH);
  }

  if (options.showLabels !== false) {
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.font = "9px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("0 km", plotX, plotY + plotH + 14);
    const maxDist = data.distancesKm[data.distancesKm.length - 1] ?? data.lineLengthKm;
    ctx.fillText(`${Math.round(maxDist)} km`, plotX + plotW, plotY + plotH + 14);
    ctx.textAlign = "right";
    ctx.fillText("kft", padL - 4, plotY + 10);
  }
}
