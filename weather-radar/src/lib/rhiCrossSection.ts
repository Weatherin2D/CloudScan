import { parseLevel3, type Level3Parsed } from "@/lib/level3Parse";

import {

  level3FetchCode,

  NEXRAD_TILTS,

  OPERA_TILTS,

  operaElevationForTilt,

  resolveCrossSectionDataSource,

} from "@/lib/radarTilt";

import { level3ObjectUrl, fetchLevel3Frames, level3KeyToTime } from "@/lib/level3Radar";

import { isReflectivityProduct } from "@/lib/iemRadar";

import {
  buildRadarSliceColumns,
  sampleLevel3AtAzRange,
  sampleOdimAtAzRange,
  type RadarSliceColumn,
} from "@/lib/polarSample";

import { lineLengthKm, anchorRadarSliceAtStation, type LatLng } from "@/lib/crossSection";

import { loadOdimScan, operaMetaForStation } from "@/lib/operaRadar";

import type { OdimScanMeta } from "@/lib/renderPolar";

import type { RadarStation } from "@/data/stations";

import { getRadarProduct, isReflectivityFamily } from "@/lib/radarProducts";

import { KM_TO_KFT } from "@/lib/rhiRender";
import {
  buildTiltRows,
  buildVolumeGrid,
  pickRhiSampleCount,
  type RhiTiltSampler,
} from "@/lib/rhiVolume";



export interface RhiTiltRow {

  tiltIndex: number;

  elevDeg: number;

  /** Beam center height (km) at each distance sample. */

  heightsKm: number[];

  /** Reflectivity (dBZ) at each distance sample. */

  values: (number | null)[];

}



export interface RhiCrossSectionData {

  /** Distance along the slice line (km). */

  distancesKm: number[];

  /** Height above radar (km) — legacy height grid for compatibility. */

  heightsKm: number[];

  /** values[heightIdx][distIdx] — dBZ or null. */

  values: (number | null)[][];

  /** Per-tilt rows used for band rendering. */

  tiltRows: RhiTiltRow[];

  maxHeightKm: number;

  variable: string;

  unit: string;

  valueKind: "reflectivity";

  time: string;

  subtitle: string;

  source: "radar-rhi";

  lineLengthKm: number;

  stationId: string;

}



export interface RhiCrossSectionInput {

  start: LatLng;

  end: LatLng;

  station: RadarStation;

  productId?: string;

  dataSource?: "iem" | "level3" | "opera" | null;

  frameTime?: number;

  iemTmsId?: string;

  level3FrameKey?: string;

  sampleCount?: number;

  maxHeightKm?: number;

  heightStepKm?: number;

}



const DEFAULT_MAX_HEIGHT_KM = 50 / KM_TO_KFT;

const DEFAULT_HEIGHT_STEP = 0.1;



function buildHeightAxis(maxHeightKm: number, heightStepKm: number): number[] {

  const heights: number[] = [];

  for (let h = 0; h <= maxHeightKm + 1e-6; h += heightStepKm) {

    heights.push(Math.round(h * 100) / 100);

  }

  return heights;

}



function assembleRhiData(

  start: LatLng,

  end: LatLng,

  station: RadarStation,

  frameTime: number,

  sampleCount: number,

  maxHeightKm: number,

  heightStepKm: number,

  subtitle: string,

  radarLat: number,

  radarLon: number,

  columns: RadarSliceColumn[],

  tiltSamplers: RhiTiltSampler[],

): RhiCrossSectionData {

  const totalKm = columns[columns.length - 1]?.rangeKm ?? lineLengthKm(start, end);

  const heightsKm = buildHeightAxis(maxHeightKm, heightStepKm);

  const distancesKm = columns.map((col) => col.rangeKm);

  const tiltRows = buildTiltRows(columns, tiltSamplers);

  const values = buildVolumeGrid(columns, tiltSamplers, heightsKm);



  return {

    distancesKm,

    heightsKm,

    values,

    tiltRows,

    maxHeightKm,

    variable: "reflectivity",

    unit: "dBZ",

    valueKind: "reflectivity",

    time: frameTime ? new Date(frameTime * 1000).toISOString() : "",

    subtitle,

    source: "radar-rhi",

    lineLengthKm: totalKm,

    stationId: station.id,

  };

}



async function loadLevel3Tilt(

  stationId: string,

  productId: string,

  tiltIndex: number,

  frameTime?: number,

  frameKey?: string,

): Promise<Level3Parsed | null> {

  const code = level3FetchCode(productId, tiltIndex);

  const frames = await fetchLevel3Frames(stationId, code, 13);

  if (!frames.length) return null;

  let frame = frames[frames.length - 1];
  const targetTime = frameKey ? level3KeyToTime(frameKey) : frameTime;
  if (targetTime && targetTime > 0) {
    frame = frames.reduce((best, f) =>
      Math.abs(f.time - targetTime) < Math.abs(best.time - targetTime) ? f : best,
    );
  }

  const res = await fetch(level3ObjectUrl(frame.key));

  if (!res.ok) return null;

  return parseLevel3(await res.arrayBuffer());

}



async function loadOdimTilt(

  station: RadarStation,

  tiltIndex: number,

): Promise<OdimScanMeta | null> {

  const { fetchOperaFrames } = await import("@/lib/operaRadar");

  const meta = operaMetaForStation(station.id);

  if (!meta) return null;

  const frames = await fetchOperaFrames(station.id, "DBZH", tiltIndex, 1);

  if (!frames.length) return null;
  return loadOdimScan(frames[frames.length - 1].odimUrl, station.lat, station.lon);
}



async function buildLevel3Rhi(

  start: LatLng,

  end: LatLng,

  station: RadarStation,

  productId: string,

  frameTime: number,

  sampleCount: number,

  maxHeightKm: number,

  heightStepKm: number,

  level3FrameKey?: string,

  iemTmsId?: string,

): Promise<RhiCrossSectionData> {

  const parsedLayers = await Promise.all(

    NEXRAD_TILTS.map(async (t) => ({

      tilt: t,

      parsed: await loadLevel3Tilt(station.id, productId, t.index, frameTime, level3FrameKey),

    })),

  );



  const active = parsedLayers.filter((p) => p.parsed);

  if (!active.length) {

    throw new Error("No Level-III tilt data available for cross-section");

  }



  const radarLat = active[0].parsed!.latitude;

  const radarLon = active[0].parsed!.longitude;

  const sliceStart = { lat: radarLat, lon: radarLon };

  const columns = buildRadarSliceColumns(radarLat, radarLon, end, sampleCount);

  let iemByRange: Map<number, number | null> | null = null;
  if (iemTmsId) {
    const { pickSampleZoom, sampleIemDbz } = await import("@/lib/tileSample");
    const zoom = pickSampleZoom(columns[columns.length - 1]?.rangeKm ?? 100);
    const iemValues = await Promise.all(
      columns.map((col) =>
        sampleIemDbz(col.lat, col.lon, station.id, productId, iemTmsId, zoom),
      ),
    );
    iemByRange = new Map<number, number | null>();
    columns.forEach((col, i) => {
      iemByRange!.set(col.rangeKm, iemValues[i]);
    });
  }



  const tiltSamplers = active.map(({ tilt, parsed }) => ({

    index: tilt.index,

    elevDeg: parsed!.elevationAngle ?? parseFloat(tilt.label),

    sampleAt: (azDeg: number, rangeKm: number) => {

      const l3 = sampleLevel3AtAzRange(parsed!.layer, azDeg, rangeKm);

      const iem = iemByRange?.get(rangeKm) ?? null;

      if (l3 == null) return iem;

      if (iem == null) return l3;

      return Math.max(l3, iem);

    },

  }));



  const tiltSummary = active

    .map(({ tilt, parsed }) => `${tilt.index}:${(parsed!.elevationAngle ?? tilt.label).toString().replace("°", "")}°`)

    .join(", ");



  return assembleRhiData(

    sliceStart,

    end,

    station,

    frameTime,

    sampleCount,

    maxHeightKm,

    heightStepKm,

    `${station.id} · ${active.length}/${NEXRAD_TILTS.length} tilts (${tiltSummary})`,

    radarLat,

    radarLon,

    columns,

    tiltSamplers,

  );

}



async function buildOperaRhi(

  start: LatLng,

  end: LatLng,

  station: RadarStation,

  frameTime: number,

  sampleCount: number,

  maxHeightKm: number,

  heightStepKm: number,

): Promise<RhiCrossSectionData> {

  const scans = await Promise.all(

    OPERA_TILTS.map(async (t) => ({

      tilt: t,

      scan: await loadOdimTilt(station, t.index),

    })),

  );

  const active = scans.filter((s) => s.scan);

  if (!active.length) throw new Error("No OPERA tilt data for cross-section");



  const radarLat = active[0].scan!.lat;

  const radarLon = active[0].scan!.lon;

  const sliceStart = { lat: radarLat, lon: radarLon };

  const columns = buildRadarSliceColumns(radarLat, radarLon, end, sampleCount);



  const tiltSamplers = active.map(({ tilt, scan }) => ({

    index: tilt.index,

    elevDeg: operaElevationForTilt(tilt.index),

    sampleAt: (azDeg: number, rangeKm: number) => sampleOdimAtAzRange(scan!, azDeg, rangeKm),

  }));



  return assembleRhiData(

    sliceStart,

    end,

    station,

    frameTime,

    sampleCount,

    maxHeightKm,

    heightStepKm,

    `${station.id} · OPERA multi-tilt`,

    radarLat,

    radarLon,

    columns,

    tiltSamplers,

  );

}



async function buildSingleTiltRhi(

  start: LatLng,

  end: LatLng,

  station: RadarStation,

  elevDeg: number,

  sample: (lat: number, lon: number) => number | null,

  frameTime: number,

  sampleCount: number,

  maxHeightKm: number,

  heightStepKm: number,

  subtitle: string,

): Promise<RhiCrossSectionData> {

  const sliceStart = { lat: station.lat, lon: station.lon };
  const columns = buildRadarSliceColumns(station.lat, station.lon, end, sampleCount);
  const sampleByRange = new Map<number, number | null>();
  columns.forEach((col) => {
    sampleByRange.set(col.rangeKm, sample(col.lat, col.lon));
  });
  const tiltSamplers: RhiTiltSampler[] = [{
    index: 0,
    elevDeg,
    sampleAt: (_azDeg, rangeKm) => sampleByRange.get(rangeKm) ?? null,
  }];

  return assembleRhiData(

    sliceStart,

    end,

    station,

    frameTime,

    sampleCount,

    maxHeightKm,

    heightStepKm,

    subtitle,

    station.lat,

    station.lon,

    columns,

    tiltSamplers,

  );

}



export async function fetchRhiCrossSection(input: RhiCrossSectionInput): Promise<RhiCrossSectionData> {
  const { end, station } = input;
  const { start: sliceStart, end: sliceEnd } = anchorRadarSliceAtStation(
    { lat: station.lat, lon: station.lon },
    end,
  );
  const totalKm = lineLengthKm(sliceStart, sliceEnd);
  const sampleCount = input.sampleCount ?? pickRhiSampleCount(totalKm);
  const maxHeightKm = input.maxHeightKm ?? DEFAULT_MAX_HEIGHT_KM;
  const heightStepKm = input.heightStepKm ?? DEFAULT_HEIGHT_STEP;
  const productId = input.productId ?? "N0Q";

  const product = getRadarProduct(productId);
  const isReflectivity = product
    ? isReflectivityFamily(product.family)
    : isReflectivityProduct(productId);
  if (!isReflectivity) {
    throw new Error("Cross-section requires a reflectivity product");
  }

  const dataSource =
    resolveCrossSectionDataSource(productId, station.country) ?? input.dataSource;



  if (dataSource === "level3") {

    return buildLevel3Rhi(

      sliceStart,

      sliceEnd,

      station,

      productId,

      input.frameTime ?? 0,

      sampleCount,

      maxHeightKm,

      heightStepKm,

      input.level3FrameKey,

      input.iemTmsId,

    );

  }



  if (dataSource === "opera") {

    return buildOperaRhi(

      sliceStart,

      sliceEnd,

      station,

      input.frameTime ?? 0,

      sampleCount,

      maxHeightKm,

      heightStepKm,

    );

  }



  if (dataSource === "iem") {
    const { clearTileSampleCache, pickSampleZoom, sampleIemDbz } = await import("@/lib/tileSample");
    clearTileSampleCache();
    const totalKm = lineLengthKm(sliceStart, sliceEnd);
    const zoom = pickSampleZoom(totalKm);
    const tmsId = input.iemTmsId;
    if (!tmsId) throw new Error("No IEM frame for cross-section");

    const columns = buildRadarSliceColumns(station.lat, station.lon, sliceEnd, sampleCount);
    const precomputed = await Promise.all(
      columns.map((col) =>
        sampleIemDbz(col.lat, col.lon, station.id, productId, tmsId, zoom),
      ),
    );
    const sampleByRange = new Map<number, number | null>();
    columns.forEach((col, i) => {
      sampleByRange.set(col.rangeKm, precomputed[i]);
    });
    const tiltSamplers: RhiTiltSampler[] = [{
      index: 0,
      elevDeg: 0.5,
      sampleAt: (_azDeg, rangeKm) => sampleByRange.get(rangeKm) ?? null,
    }];

    return assembleRhiData(
      sliceStart,
      sliceEnd,
      station,
      input.frameTime ?? 0,
      sampleCount,
      maxHeightKm,
      heightStepKm,
      `${station.id} · lowest tilt (IEM)`,
      station.lat,
      station.lon,
      columns,
      tiltSamplers,
    );
  }



  throw new Error("Cross-section requires multi-tilt radar data — select a NEXRAD or OPERA station");

}


