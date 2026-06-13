import { X, Loader2 } from "lucide-react";
import type { PixelProbeResult } from "@/lib/pixelProbe";
import { formatProbeValue } from "@/lib/pixelProbe";

interface Props {
  active: boolean;
  result: PixelProbeResult | null;
  loading: boolean;
  onClose: () => void;
}

function formatTime(unix?: number): string {
  if (!unix) return "—";
  return new Date(unix * 1000).toUTCString().replace(" GMT", " UTC");
}

export default function PixelProbePanel({ active, result, loading, onClose }: Props) {
  if (!active) return null;

  return (
    <div className="absolute bottom-20 right-3 z-[600] w-64 max-w-[calc(100%-1.5rem)] bg-gray-900/95 backdrop-blur border border-cyan-500/40 rounded-xl shadow-xl pointer-events-auto">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800">
        <span className="text-sm font-semibold text-cyan-300">Pixel probe</span>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-gray-800"
          aria-label="Close probe panel"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="px-3 py-2.5 space-y-2 text-sm">
        {result ? (
          <>
            <div className="text-xs text-gray-500 font-mono">
              {result.lat.toFixed(4)}°, {result.lon.toFixed(4)}°
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-gray-400">{result.productLabel}</span>
              {loading ? (
                <Loader2 className="w-4 h-4 text-cyan-400 animate-spin flex-shrink-0" />
              ) : (
                <span className="text-lg font-mono font-semibold text-white">
                  {formatProbeValue(result)}
                </span>
              )}
            </div>
            <div className="text-xs text-gray-500">
              Frame: {formatTime(result.frameTime)}
            </div>
          </>
        ) : (
          <div className="text-gray-400 text-xs">
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Sampling…
              </span>
            ) : (
              "Move cursor over the map"
            )}
          </div>
        )}
      </div>
    </div>
  );
}
