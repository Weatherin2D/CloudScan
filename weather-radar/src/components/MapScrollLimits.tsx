import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import { MAP_MAX_BOUNDS } from "@/lib/mapConfig";

/** Prevent panning past the poles or wrapping the world vertically. */
export default function MapScrollLimits() {
  const map = useMap();

  useEffect(() => {
    map.setMaxBounds(L.latLngBounds(MAP_MAX_BOUNDS[0], MAP_MAX_BOUNDS[1]));
    map.setMaxBoundsViscosity(1);
  }, [map]);

  return null;
}
