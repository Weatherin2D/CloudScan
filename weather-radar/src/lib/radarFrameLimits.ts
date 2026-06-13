/** Default animated frame count for global and station radar. */
export const DEFAULT_RADAR_FRAME_LIMIT = 13;

/** Upper bound for frame-count sliders and fetches. */
export const MAX_RADAR_FRAME_LIMIT = 20;

export const MIN_RADAR_FRAME_LIMIT = 1;

export function clampFrameLimit(limit: number, available = MAX_RADAR_FRAME_LIMIT): number {
  const cap = Math.max(MIN_RADAR_FRAME_LIMIT, available);
  return Math.min(MAX_RADAR_FRAME_LIMIT, Math.max(MIN_RADAR_FRAME_LIMIT, limit), cap);
}

export function sliceRecentFrames<T>(frames: T[], limit: number): T[] {
  if (!frames.length) return [];
  return frames.slice(-clampFrameLimit(limit, frames.length));
}

/** IEM listing window: ~6 min between volume scans. */
export function iemListingMinutes(frameCount: number): number {
  return Math.max(90, frameCount * 6 + 30);
}

/** Level-III S3 listing lookback in hours. */
export function level3ListingHours(frameCount: number): number {
  return Math.max(2, frameCount * 0.12);
}
