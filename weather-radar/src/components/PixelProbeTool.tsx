import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";

interface Props {
  active: boolean;
  point: { lat: number; lon: number } | null;
  onPoint: (point: { lat: number; lon: number } | null) => void;
}

const PICKER_SIZE = 44;
const PICKER_ANCHOR = PICKER_SIZE / 2;

/** Crosshair reticle — corner brackets, axis hairs, open center. */
const PICKER_ICON = L.divIcon({
  className: "pixel-probe-picker",
  iconSize: [PICKER_SIZE, PICKER_SIZE],
  iconAnchor: [PICKER_ANCHOR, PICKER_ANCHOR],
  html: `
    <svg xmlns="http://www.w3.org/2000/svg" width="${PICKER_SIZE}" height="${PICKER_SIZE}" viewBox="0 0 44 44" aria-hidden="true">
      <g stroke="#22d3ee" stroke-width="1.75" fill="none" stroke-linecap="square">
        <path d="M10 16 V10 H16" />
        <path d="M34 16 V10 H28" />
        <path d="M10 28 V34 H16" />
        <path d="M34 28 V34 H28" />
        <line x1="22" y1="4" x2="22" y2="14" opacity="0.85" />
        <line x1="22" y1="30" x2="22" y2="40" opacity="0.85" />
        <line x1="4" y1="22" x2="14" y2="22" opacity="0.85" />
        <line x1="30" y1="22" x2="40" y2="22" opacity="0.85" />
      </g>
      <circle cx="22" cy="22" r="4" fill="none" stroke="#ffffff" stroke-width="1.5" />
      <circle cx="22" cy="22" r="1.25" fill="#22d3ee" />
    </svg>
  `,
});

export default function PixelProbeTool({ active, point, onPoint }: Props) {
  const map = useMap();
  const markerRef = useRef<L.Marker | null>(null);
  const onPointRef = useRef(onPoint);
  onPointRef.current = onPoint;

  useEffect(() => {
    if (!active) return;

    const container = map.getContainer();

    const onMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      if (x < 0 || y < 0 || x > rect.width || y > rect.height) return;
      const latlng = map.containerPointToLatLng(L.point(x, y));
      onPointRef.current({ lat: latlng.lat, lon: latlng.lng });
    };

    const onLeave = () => onPointRef.current(null);

    container.addEventListener("mousemove", onMove);
    container.addEventListener("mouseleave", onLeave);

    return () => {
      container.removeEventListener("mousemove", onMove);
      container.removeEventListener("mouseleave", onLeave);
    };
  }, [active, map]);

  useEffect(() => {
    if (!point) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }

    if (!markerRef.current) {
      markerRef.current = L.marker([point.lat, point.lon], {
        icon: PICKER_ICON,
        interactive: false,
        keyboard: false,
        zIndexOffset: 2000,
      }).addTo(map);
    } else {
      markerRef.current.setLatLng([point.lat, point.lon]);
    }
  }, [map, point]);

  useEffect(() => {
    return () => {
      markerRef.current?.remove();
      markerRef.current = null;
    };
  }, [map]);

  useEffect(() => {
    if (!active) return;
    const container = map.getContainer();
    const prev = container.style.cursor;
    container.style.cursor = "none";
    return () => {
      container.style.cursor = prev;
    };
  }, [active, map]);

  return null;
}
