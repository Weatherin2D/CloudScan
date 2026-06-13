import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useMap } from "react-leaflet";
import type { Map as LeafletMap } from "leaflet";
import type { RhiCrossSectionData } from "@/lib/rhiCrossSection";
import type { LatLng } from "@/lib/crossSection";
import { drawRhiCrossSection, DEFAULT_RHI_MAX_KFT } from "@/lib/rhiRender";

interface Props {
  start: LatLng;
  end: LatLng;
  data: RhiCrossSectionData;
}

function CurtainCanvas({
  map,
  start,
  end,
  data,
}: Props & { map: LeafletMap }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;

    const update = () => {
      const p1 = map.latLngToContainerPoint([start.lat, start.lon]);
      const p2 = map.latLngToContainerPoint([end.lat, end.lon]);
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const lineLen = Math.sqrt(dx * dx + dy * dy) || 1;
      const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;

      const curtainH = Math.min(320, Math.max(180, map.getSize().y * 0.38));
      const curtainW = Math.max(140, Math.min(lineLen, map.getSize().x * 0.55));
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;

      host.style.width = `${curtainW}px`;
      host.style.height = `${curtainH}px`;
      host.style.left = `${midX - curtainW / 2}px`;
      host.style.top = `${midY - curtainH * 0.92}px`;
      host.style.transform = `rotateZ(${angleDeg}deg) rotateX(58deg)`;

      const dpr = window.devicePixelRatio || 1;
      canvas.width = curtainW * dpr;
      canvas.height = curtainH * dpr;
      canvas.style.width = `${curtainW}px`;
      canvas.style.height = `${curtainH}px`;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawRhiCrossSection(ctx, data, {
        x: 0,
        y: 0,
        width: curtainW,
        height: curtainH,
        padL: 28,
        padR: 28,
        padT: 6,
        padB: 14,
      }, {
        maxHeightKft: DEFAULT_RHI_MAX_KFT,
        showGrid: true,
        showLabels: true,
        showFrame: true,
      });
    };

    update();
    map.on("move zoom resize", update);
    return () => {
      map.off("move zoom resize", update);
    };
  }, [map, start, end, data]);

  return (
    <div
      ref={hostRef}
      className="pointer-events-none"
      style={{
        position: "absolute",
        zIndex: 450,
        transformOrigin: "50% 100%",
        transformStyle: "preserve-3d",
        perspective: "900px",
      }}
    >
      <canvas
        ref={canvasRef}
        className="block rounded-sm"
        style={{
          boxShadow: "0 12px 40px rgba(0,0,0,0.65)",
          border: "1px solid rgba(255,255,255,0.35)",
          background: "#050505",
        }}
      />
    </div>
  );
}

/** Vertical reflectivity curtain along the cross-section line (RadarScope-style 3D slice). */
export default function RhiCurtainOverlay(props: Props) {
  const map = useMap();
  const [container, setContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setContainer(map.getContainer());
  }, [map]);

  if (!container) return null;

  return createPortal(
    <CurtainCanvas map={map} {...props} />,
    container,
  );
}
