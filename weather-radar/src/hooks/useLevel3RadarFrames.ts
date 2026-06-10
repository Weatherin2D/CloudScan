import { useState, useEffect } from "react";
import type { RadarStation } from "@/data/stations";
import { fetchLevel3Frames, type Level3Frame } from "@/lib/level3Radar";
import { STATION_RADAR_REFRESH_MS } from "@/lib/radarRefresh";
import { level3FetchCode, shouldUseLevel3Frames } from "@/lib/radarTilt";

export function useLevel3RadarFrames(
  station: RadarStation | null,
  productId: string,
  tiltIndex: number,
) {
  const [frames, setFrames] = useState<Level3Frame[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (
      !station?.id ||
      !shouldUseLevel3Frames(station.country, productId, tiltIndex)
    ) {
      setFrames([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const code = level3FetchCode(productId, tiltIndex);

    const load = async (initial: boolean) => {
      if (initial) {
        setFrames([]);
        setLoading(true);
      }

      try {
        const next = await fetchLevel3Frames(station.id, code);
        if (!cancelled) setFrames(next);
      } catch {
        if (!cancelled && initial) setFrames([]);
      } finally {
        if (!cancelled && initial) setLoading(false);
      }
    };

    load(true);
    const timer = setInterval(() => load(false), STATION_RADAR_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [station?.id, station?.country, productId, tiltIndex]);

  return { frames, loading };
}
