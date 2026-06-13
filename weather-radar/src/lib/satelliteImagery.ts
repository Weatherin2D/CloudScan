import { IEM_INVALID_TMS_TILE_SIZE, IEM_RIDGE_TMS } from "@/lib/iemRadar";

export const SATELLITE_TILE_ATTRIBUTION = "GOES · NASA GIBS / Iowa Environmental Mesonet";

/** NASA GIBS WMTS — supports 10-minute GOES history for animation. */
export const GIBS_WMTS_BASE = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best";
export const GIBS_TILE_MATRIX = "GoogleMapsCompatible_Level6";

/** Stable TMS endpoint for archived GOES frames (supports `_YYYYMMDDHHMM` suffix). */
export const IEM_GOES_ARCHIVE_TMS =
  "https://mesonet.agron.iastate.edu/c/tile.py/1.0.0";

/** Near-realtime GOES tiles (latest scan only). */
export const IEM_GOES_LIVE_TMS = IEM_RIDGE_TMS;

/** GOES-R ABI channels exposed via IEM TMS. */
export const GOES_CHANNELS = {
  visible: "ch02",
  infrared: "ch13",
  water_vapor: "ch09",
  shortwave_ir: "ch07",
  longwave_ir: "ch14",
} as const;

export type GoesChannelId = (typeof GOES_CHANNELS)[keyof typeof GOES_CHANNELS];

const GIBS_GOES_LAYERS: Partial<
  Record<GoesChannelId, { east: string; west: string }>
> = {
  ch02: {
    east: "GOES-East_ABI_Band2_Red_Visible_1km",
    west: "GOES-West_ABI_Band2_Red_Visible_1km",
  },
  ch13: {
    east: "GOES-East_ABI_Band13_Clean_Infrared",
    west: "GOES-West_ABI_Band13_Clean_Infrared",
  },
  ch09: {
    east: "GOES-East_ABI_Band9_Mid-Level_Water_Vapor",
    west: "GOES-West_ABI_Band9_Mid-Level_Water_Vapor",
  },
  ch07: {
    east: "GOES-East_ABI_Band7_Shortwave_Window",
    west: "GOES-West_ABI_Band7_Shortwave_Window",
  },
  ch14: {
    east: "GOES-East_ABI_Band14_Longwave_Window",
    west: "GOES-West_ABI_Band14_Longwave_Window",
  },
};

export const SATELLITE_PRODUCTS = {
  auto: {
    label: "Auto (day / night)",
    description: "Visible by day, infrared after dusk — blended per location",
    mode: "auto" as const,
    visible: GOES_CHANNELS.visible,
    infrared: GOES_CHANNELS.infrared,
  },
  visible: {
    label: "Visible",
    description: "Red visible band (0.64 µm)",
    mode: "single" as const,
    channel: GOES_CHANNELS.visible,
  },
  infrared: {
    label: "Infrared",
    description: "Clean longwave window (10.3 µm)",
    mode: "single" as const,
    channel: GOES_CHANNELS.infrared,
  },
  water_vapor: {
    label: "Water vapor",
    description: "Mid-level moisture (6.9 µm)",
    mode: "single" as const,
    channel: GOES_CHANNELS.water_vapor,
  },
  shortwave_ir: {
    label: "Shortwave IR",
    description: "Low cloud / fog at night (3.9 µm)",
    mode: "single" as const,
    channel: GOES_CHANNELS.shortwave_ir,
  },
  longwave_ir: {
    label: "Longwave IR",
    description: "Longwave window (11.2 µm)",
    mode: "single" as const,
    channel: GOES_CHANNELS.longwave_ir,
  },
} as const;

export type SatelliteProductId = keyof typeof SATELLITE_PRODUCTS;

export type GoesBird = "east" | "west";

/** Subsatellite longitudes — used to pick the best GOES view per location. */
const GOES_EAST_SUBSAT_LON = -75.2;
const GOES_WEST_SUBSAT_LON = -137.2;
const GOES_BLEND_HALF_WIDTH_DEG = 18;

export function goesFulldiskLayerId(bird: GoesBird, channel: GoesChannelId): string {
  return `goes_${bird}_fulldisk_${channel}`;
}

/** IEM archived layer id, e.g. goes_east_fulldisk_ch02_202606130355 or `_0` for latest. */
export function goesArchivedLayerId(
  bird: GoesBird,
  channel: GoesChannelId,
  tmsId: string,
): string {
  return `${goesFulldiskLayerId(bird, channel)}_${tmsId}`;
}

export function goesArchivedTileUrlAt(
  layerId: string,
  z: number,
  x: number,
  y: number,
): string {
  return `${IEM_GOES_ARCHIVE_TMS}/${layerId}/${z}/${x}/${y}.png`;
}

export function goesLiveTileUrlAt(
  layerId: string,
  z: number,
  x: number,
  y: number,
): string {
  return `${IEM_GOES_LIVE_TMS}/${layerId}/${z}/${x}/${y}.png`;
}

/** Round unix time to nearest 10-minute ISO timestamp for GIBS WMTS. */
export function unixToGibsIso(unixSec: number): string {
  const rounded = Math.round((unixSec * 1000) / (10 * 60 * 1000)) * (10 * 60 * 1000);
  return new Date(rounded).toISOString().replace(/\.\d{3}Z$/, "Z");
}

export function gibsLayerId(bird: GoesBird, channel: GoesChannelId): string | null {
  const entry = GIBS_GOES_LAYERS[channel];
  if (!entry) return null;
  return bird === "east" ? entry.east : entry.west;
}

export function gibsTileUrlAt(
  layerId: string,
  timeIso: string,
  z: number,
  x: number,
  y: number,
): string {
  return `${GIBS_WMTS_BASE}/${layerId}/default/${timeIso}/${GIBS_TILE_MATRIX}/${z}/${y}/${x}.png`;
}

/** Round radar frame time to nearest 10-minute GOES TMS id (YYYYMMDDHHMM). */
export function unixToGoesTms(unixSec: number): string {
  const d = new Date(unixSec * 1000);
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const h = String(d.getUTCHours()).padStart(2, "0");
  const mi = String(Math.floor(d.getUTCMinutes() / 10) * 10).padStart(2, "0");
  return `${y}${mo}${day}${h}${mi}`;
}

/** Weight for GOES-East vs GOES-West (1 = east only, 0 = west only). */
export function eastWestBlendWeight(lon: number): number {
  const boundary = (GOES_EAST_SUBSAT_LON + GOES_WEST_SUBSAT_LON) / 2;
  if (lon >= boundary + GOES_BLEND_HALF_WIDTH_DEG) return 1;
  if (lon <= boundary - GOES_BLEND_HALF_WIDTH_DEG) return 0;
  return (lon - (boundary - GOES_BLEND_HALF_WIDTH_DEG)) / (2 * GOES_BLEND_HALF_WIDTH_DEG);
}

/** Solar elevation in degrees (negative = below horizon). NOAA SPA-style approximation. */
export function solarElevationDeg(lat: number, lon: number, when = new Date()): number {
  const rad = Math.PI / 180;
  const start = new Date(when.getFullYear(), 0, 0);
  const dayOfYear = (when.getTime() - start.getTime()) / 86400000;
  const fracHour =
    when.getUTCHours() + when.getUTCMinutes() / 60 + when.getUTCSeconds() / 3600;

  const gamma = (2 * Math.PI / 365) * (dayOfYear - 1 + (fracHour - 12) / 24);
  const eqtime =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(gamma) -
      0.032077 * Math.sin(gamma) -
      0.014615 * Math.cos(2 * gamma) -
      0.040849 * Math.sin(2 * gamma));
  const decl =
    0.006918 -
    0.399912 * Math.cos(gamma) +
    0.070257 * Math.sin(gamma) -
    0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma) -
    0.002697 * Math.cos(3 * gamma) +
    0.00148 * Math.sin(3 * gamma);

  let trueSolarTime = fracHour * 60 + eqtime + 4 * lon;
  while (trueSolarTime > 1440) trueSolarTime -= 1440;
  while (trueSolarTime < 0) trueSolarTime += 1440;

  const hourAngle = ((trueSolarTime / 4) - 180) * rad;
  const latRad = lat * rad;
  const sinAlt =
    Math.sin(latRad) * Math.sin(decl) +
    Math.cos(latRad) * Math.cos(decl) * Math.cos(hourAngle);
  return Math.asin(Math.max(-1, Math.min(1, sinAlt))) / rad;
}

/** Blend weight for visible imagery (0 = full IR, 1 = full visible). */
export function visibleDaylightWeight(elevationDeg: number, twilightDeg = 6): number {
  if (elevationDeg >= twilightDeg) return 1;
  if (elevationDeg <= -twilightDeg) return 0;
  return (elevationDeg + twilightDeg) / (2 * twilightDeg);
}

/** Web Mercator tile pixel → WGS84. */
export function tilePixelToLatLon(
  z: number,
  x: number,
  y: number,
  px: number,
  py: number,
  tileSize = 256,
): { lat: number; lon: number } {
  const n = 2 ** z;
  const lon = ((x + px / tileSize) / n) * 360 - 180;
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + py / tileSize)) / n)));
  return { lat: (latRad * 180) / Math.PI, lon };
}

/** Load a TMS tile; rejects IEM's fixed-size "Invalid TMS Request" error PNG. */
export async function loadTileImage(url: string): Promise<HTMLImageElement | null> {
  try {
    const response = await fetch(url, { mode: "cors" });
    if (!response.ok) return null;

    const blob = await response.blob();
    if (blob.size === IEM_INVALID_TMS_TILE_SIZE) return null;
    if (!blob.type.startsWith("image/")) return null;

    const objectUrl = URL.createObjectURL(blob);
    return await new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(null);
      };
      img.src = objectUrl;
    });
  } catch {
    return null;
  }
}

export interface SatelliteTimelineFrame {
  time: number;
}

export function goesTmsForFrame(
  frames: SatelliteTimelineFrame[],
  frameIndex: number,
): string {
  const frame = frames[frameIndex];
  if (!frame?.time) return unixToGoesTms(Math.floor(Date.now() / 1000));
  return unixToGoesTms(frame.time);
}

export function preloadGoesTmsIds(
  frames: SatelliteTimelineFrame[],
  frameIndex: number,
  radius = 2,
): string[] {
  if (!frames.length) return [unixToGoesTms(Math.floor(Date.now() / 1000))];
  const ids = new Set<string>();
  for (let d = -radius; d <= radius; d++) {
    const i = (frameIndex + d + frames.length) % frames.length;
    ids.add(goesTmsForFrame(frames, i));
  }
  return Array.from(ids);
}
