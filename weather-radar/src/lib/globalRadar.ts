import { RADAR_LOOKBACK_HOURS } from "@/lib/radarFrameLimits";
import { iemScanIsoToTms, IEM_USCOMP_PRODUCT, IEM_USCOMP_RADAR } from "@/lib/iemRadar";

const LIST_URL = "https://mesonet.agron.iastate.edu/json/radar.py";
const RAINVIEWER_URL = "https://api.rainviewer.com/public/weather-maps.json";

export { IEM_USCOMP_RADAR as GLOBAL_IEM_RADAR, IEM_USCOMP_PRODUCT as GLOBAL_IEM_PRODUCT };

export interface GlobalRadarFrame {
  time: number;
  /** RainViewer worldwide mosaic (recent ~2 h). */
  rainViewerPath?: string;
  /** IEM US composite TMS id (up to 24 h). */
  iemTmsId?: string;
}

function toIemIso(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

async function fetchRainViewerPast(): Promise<{ time: number; path: string }[]> {
  const res = await fetch(RAINVIEWER_URL);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.radar?.past ?? []).map((f: { time: number; path: string }) => ({
    time: f.time,
    path: f.path,
  }));
}

async function fetchIemCompositeScans(listingMinutes: number): Promise<{ ts: string }[]> {
  const end = toIemIso(new Date());
  const start = toIemIso(new Date(Date.now() - listingMinutes * 60 * 1000));
  const params = new URLSearchParams({
    operation: "list",
    radar: IEM_USCOMP_RADAR,
    product: IEM_USCOMP_PRODUCT,
    start,
    end,
  });
  const res = await fetch(`${LIST_URL}?${params}`);
  if (!res.ok) return [];
  const json = await res.json();
  return json.scans ?? [];
}

function nearestRainViewerPath(
  time: number,
  rainViewer: { time: number; path: string }[],
): string | undefined {
  let best: { time: number; path: string } | undefined;
  let bestDelta = Infinity;
  for (const frame of rainViewer) {
    const delta = Math.abs(frame.time - time);
    if (delta <= 300 && delta < bestDelta) {
      best = frame;
      bestDelta = delta;
    }
  }
  return best?.path;
}

/** RainViewer for recent worldwide data + IEM US composite for up to 24 h of history. */
export async function fetchGlobalRadarFrames(): Promise<GlobalRadarFrame[]> {
  const listingMinutes = RADAR_LOOKBACK_HOURS * 60;
  const [rainViewer, iemScans] = await Promise.all([
    fetchRainViewerPast(),
    fetchIemCompositeScans(listingMinutes),
  ]);

  const byTime = new Map<number, GlobalRadarFrame>();

  for (const scan of iemScans) {
    const time = Math.floor(new Date(scan.ts).getTime() / 1000);
    byTime.set(time, {
      time,
      iemTmsId: iemScanIsoToTms(scan.ts),
      rainViewerPath: nearestRainViewerPath(time, rainViewer),
    });
  }

  for (const frame of rainViewer) {
    const existing = [...byTime.values()].find((f) => Math.abs(f.time - frame.time) <= 300);
    if (existing) {
      existing.rainViewerPath = frame.path;
      existing.time = frame.time;
    } else {
      byTime.set(frame.time, { time: frame.time, rainViewerPath: frame.path });
    }
  }

  return [...byTime.values()].sort((a, b) => a.time - b.time);
}
