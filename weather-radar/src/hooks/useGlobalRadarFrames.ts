import { useState, useEffect } from "react";
import { fetchGlobalRadarFrames, type GlobalRadarFrame } from "@/lib/globalRadar";
import { RAINVIEWER_REFRESH_MS } from "@/lib/radarRefresh";

/** Loads the full global archive (24 h IEM US + RainViewer recent). Slice in the UI. */
export function useGlobalRadarFrames() {
  const [frames, setFrames] = useState<GlobalRadarFrame[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async (initial: boolean) => {
      if (initial) {
        setFrames([]);
        setLoading(true);
      }

      try {
        const next = await fetchGlobalRadarFrames();
        if (!cancelled) setFrames(next);
      } catch {
        if (!cancelled && initial) setFrames([]);
      } finally {
        if (!cancelled && initial) setLoading(false);
      }
    };

    load(true);
    const timer = setInterval(() => load(false), RAINVIEWER_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  return { frames, loading };
}
