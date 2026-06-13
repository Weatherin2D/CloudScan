import { useEffect, useMemo, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import { GoesGlobeTileLayerClass, type GoesGlobeTileLayer } from "@/lib/satelliteBlendLayer";
import {
  goesTmsForFrame,
  preloadGoesTmsIds,
  SATELLITE_PRODUCTS,
  SATELLITE_TILE_ATTRIBUTION,
  type SatelliteProductId,
  type SatelliteTimelineFrame,
} from "@/lib/satelliteImagery";

interface Props {
  enabled: boolean;
  opacity: number;
  product: SatelliteProductId;
  frames: SatelliteTimelineFrame[];
  frameIndex: number;
}

const SATELLITE_TILE_OPTS: L.TileLayerOptions = {
  updateWhenZooming: false,
  updateWhenIdle: true,
  keepBuffer: 8,
  maxNativeZoom: 6,
  maxZoom: 18,
  zIndex: 2,
  attribution: SATELLITE_TILE_ATTRIBUTION,
};

function frameUnixForTms(frames: SatelliteTimelineFrame[], tmsId: string): number | undefined {
  for (let i = 0; i < frames.length; i++) {
    if (goesTmsForFrame(frames, i) === tmsId) return frames[i]?.time;
  }
  return undefined;
}

export default function SatelliteOverlayLayer({
  enabled,
  opacity,
  product,
  frames,
  frameIndex,
}: Props) {
  const map = useMap();
  const poolRef = useRef<Map<string, GoesGlobeTileLayer>>(new Map());

  const productDef = SATELLITE_PRODUCTS[product];

  const preloadTmsIds = useMemo(
    () => (enabled ? preloadGoesTmsIds(frames, frameIndex) : []),
    [enabled, frames, frameIndex],
  );

  const activeTmsId = useMemo(
    () => (enabled ? goesTmsForFrame(frames, frameIndex) : "0"),
    [enabled, frames, frameIndex],
  );

  useEffect(() => {
    if (!enabled) {
      poolRef.current.forEach((layer) => layer.remove());
      poolRef.current.clear();
      return;
    }

    for (const tmsId of preloadTmsIds) {
      if (poolRef.current.has(tmsId)) continue;

      const frameUnix = frameUnixForTms(frames, tmsId);
      const layer =
        productDef.mode === "auto"
          ? new GoesGlobeTileLayerClass("", {
              ...SATELLITE_TILE_OPTS,
              opacity: 0,
              mode: "auto",
              tmsId,
              frameUnix,
              visibleChannel: productDef.visible,
              infraredChannel: productDef.infrared,
            })
          : new GoesGlobeTileLayerClass("", {
              ...SATELLITE_TILE_OPTS,
              opacity: 0,
              mode: "single",
              tmsId,
              frameUnix,
              channel: productDef.channel,
            });

      layer.addTo(map);
      poolRef.current.set(tmsId, layer);
    }

    for (const [tmsId, layer] of poolRef.current.entries()) {
      if (!preloadTmsIds.includes(tmsId)) {
        layer.remove();
        poolRef.current.delete(tmsId);
      }
    }

    poolRef.current.forEach((layer, tmsId) => {
      const active = tmsId === activeTmsId;
      layer.setOpacity(active ? opacity : 0);
      layer.setZIndex(active ? 4 : 2);
      if (active) layer.redraw();
    });
  }, [enabled, preloadTmsIds, activeTmsId, map, opacity, productDef, frames]);

  useEffect(() => {
    return () => {
      poolRef.current.forEach((layer) => layer.remove());
      poolRef.current.clear();
    };
  }, [map]);

  return null;
}
