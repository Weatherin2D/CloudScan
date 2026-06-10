import { useEffect } from "react";
import { useMap } from "react-leaflet";
import type { RadarStation } from "@/data/stations";

interface Props {
  station?: RadarStation | null;
  target?: { lat: number; lon: number } | null;
  zoom?: number;
}

export default function MapFlyTo({ station, target, zoom = 7 }: Props) {
  const map = useMap();

  useEffect(() => {
    if (station) {
      map.flyTo([station.lat, station.lon], zoom, { duration: 0.8 });
      return;
    }
    if (target) {
      map.flyTo([target.lat, target.lon], zoom, { duration: 0.8 });
    }
  }, [station, target, zoom, map]);

  return null;
}
