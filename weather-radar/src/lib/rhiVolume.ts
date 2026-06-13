import { beamHeightKm } from "@/lib/polarSample";
import type { RadarSliceColumn } from "@/lib/polarSample";
import type { RhiTiltRow } from "@/lib/rhiCrossSection";

export interface RhiTiltSampler {
  index: number;
  elevDeg: number;
  sampleAt: (azDeg: number, rangeKm: number) => number | null;
}

/** Horizontal samples along the slice (~1 km spacing, clamped for performance). */
export function pickRhiSampleCount(lineLengthKm: number): number {
  const target = Math.round(lineLengthKm);
  return Math.min(1024, Math.max(200, target));
}

function maxNullable(a: number | null, b: number | null): number | null {
  if (a == null) return b;
  if (b == null) return a;
  return Math.max(a, b);
}

function maxTiltSample(
  sorted: RhiTiltSampler[],
  azDeg: number,
  rangeKm: number,
): number | null {
  let max: number | null = null;
  for (const tilt of sorted) {
    const value = tilt.sampleAt(azDeg, rangeKm);
    if (value != null) max = max == null ? value : Math.max(max, value);
  }
  return max;
}

/** Interpolate reflectivity at a target height using bracketing tilt beam heights. */
export function sampleAtHeight(
  tilts: RhiTiltSampler[],
  azDeg: number,
  rangeKm: number,
  heightKm: number,
): number | null {
  if (tilts.length === 0) return null;

  const sorted = [...tilts].sort((a, b) => a.elevDeg - b.elevDeg);
  const effRangeKm = Math.max(rangeKm, 0.01);

  const beams = sorted.map((tilt) => ({
    tilt,
    beamH: beamHeightKm(effRangeKm, tilt.elevDeg),
  }));

  const lowest = beams[0];
  if (heightKm <= lowest.beamH) {
    return maxTiltSample(sorted, azDeg, rangeKm);
  }

  const highest = beams[beams.length - 1];
  if (heightKm >= highest.beamH) {
    return highest.tilt.sampleAt(azDeg, rangeKm);
  }

  for (let i = 0; i < beams.length - 1; i++) {
    const lower = beams[i];
    const upper = beams[i + 1];
    if (heightKm < lower.beamH || heightKm > upper.beamH) continue;

    const lowerVal = lower.tilt.sampleAt(azDeg, rangeKm);
    const upperVal = upper.tilt.sampleAt(azDeg, rangeKm);
    // Max preserves storm cores; linear blend pulls high dBZ down toward clear-air aloft.
    return maxNullable(lowerVal, upperVal);
  }

  let best = beams[0];
  let bestDiff = Infinity;
  for (const entry of beams) {
    const diff = Math.abs(entry.beamH - heightKm);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = entry;
    }
  }
  return best.tilt.sampleAt(azDeg, rangeKm);
}

function fillBelowLowestBeam(
  grid: (number | null)[][],
  heightsKm: number[],
  columns: RadarSliceColumn[],
  tilts: RhiTiltSampler[],
): void {
  if (!tilts.length) return;
  const sorted = [...tilts].sort((a, b) => a.elevDeg - b.elevDeg);

  for (let di = 0; di < columns.length; di++) {
    const col = columns[di];
    const effRangeKm = Math.max(col.rangeKm, 0.01);
    const composite = maxTiltSample(sorted, col.azimuthDeg, col.rangeKm);
    if (composite == null) continue;

    const ceiling = beamHeightKm(effRangeKm, sorted[0].elevDeg);
    for (let hi = 0; hi < heightsKm.length; hi++) {
      if (heightsKm[hi] <= ceiling + 1e-6) {
        grid[hi][di] = maxNullable(grid[hi][di], composite);
      }
    }
  }
}

export function buildVolumeGrid(
  columns: RadarSliceColumn[],
  tilts: RhiTiltSampler[],
  heightsKm: number[],
): (number | null)[][] {
  const cols = columns.length;
  const rows = heightsKm.length;
  const grid: (number | null)[][] = Array.from({ length: rows }, () => Array(cols).fill(null));

  for (let di = 0; di < cols; di++) {
    const col = columns[di];
    for (let hi = 0; hi < rows; hi++) {
      grid[hi][di] = sampleAtHeight(
        tilts,
        col.azimuthDeg,
        col.rangeKm,
        heightsKm[hi],
      );
    }
  }

  fillBelowLowestBeam(grid, heightsKm, columns, tilts);
  return grid;
}

export function buildTiltRows(
  columns: RadarSliceColumn[],
  tilts: RhiTiltSampler[],
): RhiTiltRow[] {
  return tilts.map((tilt) => {
    const heightsKm: number[] = [];
    const values: (number | null)[] = [];
    for (const col of columns) {
      heightsKm.push(beamHeightKm(Math.max(col.rangeKm, 0.01), tilt.elevDeg));
      values.push(tilt.sampleAt(col.azimuthDeg, col.rangeKm));
    }
    return {
      tiltIndex: tilt.index,
      elevDeg: tilt.elevDeg,
      heightsKm,
      values,
    };
  });
}
