import { useState, useEffect } from "react";
import type { RadarStation } from "@/data/stations";
import { fetchOperaFrames, operaMetaForStation, type OperaFrame } from "@/lib/operaRadar";
import { getRadarProduct } from "@/lib/radarProducts";
import { STATION_RADAR_REFRESH_MS } from "@/lib/radarRefresh";
import { productSupportsTilt } from "@/lib/radarTilt";

export function useOperaRadarFrames(
  station: RadarStation | null,
  productId: string,
  tiltIndex: number,
  frameCount: number,
) {
  const [frames, setFrames] = useState<OperaFrame[]>([]);
  const [loading, setLoading] = useState(false);
  const hasOpera = station ? operaMetaForStation(station.id) != null : false;

  useEffect(() => {
    const product = getRadarProduct(productId);
    if (
      !station?.id ||
      station.country !== "eu" ||
      !hasOpera ||
      product?.sources.eu !== "opera" ||
      !product.fetchCode
    ) {
      setFrames([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const tilt = productSupportsTilt(product) ? tiltIndex : 0;

    const load = async (initial: boolean) => {
      if (initial) {
        setFrames([]);
        setLoading(true);
      }

      try {
        const next = await fetchOperaFrames(
          station.id,
          product.fetchCode as "DBZH" | "VRADH",
          tilt,
          frameCount,
        );
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
  }, [station?.id, station?.country, productId, tiltIndex, hasOpera, frameCount]);

  return { frames, loading, hasOpera };
}
