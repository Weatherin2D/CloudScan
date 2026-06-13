import { useState, useEffect, useRef } from "react";
import { decodeBlitzortungPayload, wsDataToString } from "@/lib/blitzortung";

export interface LightningStrike {
  lat: number;
  lon: number;
  time: number;
  id: string;
}

const STRIKE_TTL = 60 * 60 * 1000;
const MAX_STRIKES = 20_000;
const FLUSH_MS = 30;
const KEEPALIVE_MS = 30_000;
const SOCKET_COUNT = 2;

const SOCKET_HOSTS = ["ws1", "ws2", "ws3", "ws7", "ws8"];

/** Retain strikes across lightning toggle so re-enabling shows recent activity. */
let strikeCache: LightningStrike[] = [];

/** Shared socket pool — warmed on first hook mount so toggling lightning is instant. */
let sharedSockets: WebSocket[] = [];
let sharedKeepalive: ReturnType<typeof setInterval> | null = null;
let sharedReconnect: ReturnType<typeof setTimeout> | null = null;
let sharedWatchdog: ReturnType<typeof setInterval> | null = null;
let sharedFlushTimer: ReturnType<typeof setInterval> | null = null;
let sharedCleanupTimer: ReturnType<typeof setInterval> | null = null;
let sharedPending: LightningStrike[] = [];
let sharedIdx = 0;
let sharedSubscribers = 0;
let sharedClosed = false;

function strikeKey(s: LightningStrike): string {
  return `${s.time}:${s.lat.toFixed(4)}:${s.lon.toFixed(4)}`;
}

function coordFromRecord(rec: Record<string, unknown>): { lat: number; lon: number } | null {
  const latRaw = rec.lat ?? rec.latitude;
  const lonRaw = rec.lon ?? rec.longitude;
  if (latRaw == null || lonRaw == null) return null;

  let lat = Number(latRaw);
  let lon = Number(lonRaw);
  if (Number.isNaN(lat) || Number.isNaN(lon)) return null;

  if (Math.abs(lat) > 90) lat /= 1e7;
  if (Math.abs(lon) > 180) lon /= 1e7;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;

  return { lat, lon };
}

function strikeTimeFromRecord(rec: Record<string, unknown>): number {
  const raw = rec.time ?? rec.timestamp;
  if (raw == null) return Date.now();

  const n = Number(raw);
  if (Number.isNaN(n)) return Date.now();

  // Nanoseconds since epoch (live Blitzortung feed).
  if (n > 1e15) return Math.floor(n / 1e6);
  // Milliseconds since epoch.
  if (n > 1e12) return Math.floor(n);
  // Seconds since epoch.
  if (n > 1e9) return Math.floor(n * 1000);

  return Date.now();
}

function strikeFromRecord(
  rec: Record<string, unknown>,
  idxRef: { current: number },
): LightningStrike | null {
  const coords = coordFromRecord(rec);
  if (!coords) return null;

  const time = strikeTimeFromRecord(rec);
  return {
    lat: coords.lat,
    lon: coords.lon,
    time,
    id: `${time}-${coords.lat.toFixed(4)}-${coords.lon.toFixed(4)}-${idxRef.current++}`,
  };
}

function parseStrikePayload(raw: string, idxRef: { current: number }): LightningStrike[] {
  const data = decodeBlitzortungPayload(raw);
  if (!data) return [];

  if (Array.isArray(data)) {
    return data.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const strike = strikeFromRecord(item as Record<string, unknown>, idxRef);
      return strike ? [strike] : [];
    });
  }

  if (typeof data !== "object") return [];

  const obj = data as Record<string, unknown>;
  if (Array.isArray(obj.strokes)) {
    return obj.strokes.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const strike = strikeFromRecord(item as Record<string, unknown>, idxRef);
      return strike ? [strike] : [];
    });
  }

  const strike = strikeFromRecord(obj, idxRef);
  return strike ? [strike] : [];
}

function mergeStrikes(prev: LightningStrike[], incoming: LightningStrike[]): LightningStrike[] {
  if (!incoming.length) return prev;

  const now = Date.now();
  const seen = new Set<string>();
  const merged: LightningStrike[] = [];

  for (const s of prev) {
    if (now - s.time >= STRIKE_TTL) continue;
    const key = strikeKey(s);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(s);
  }

  for (const s of incoming) {
    const key = strikeKey(s);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(s);
  }

  return merged.length > MAX_STRIKES ? merged.slice(-MAX_STRIKES) : merged;
}

function pickSocketHosts(count: number): string[] {
  const shuffled = [...SOCKET_HOSTS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function applyStrikeCache(next: LightningStrike[]) {
  strikeCache = next;
}

function flushPending() {
  if (!sharedPending.length) return;
  const batch = sharedPending;
  sharedPending = [];
  applyStrikeCache(mergeStrikes(strikeCache, batch));
}

function connectSocket(host: string) {
  try {
    const ws = new WebSocket(`wss://${host}.blitzortung.org/`);
    ws.binaryType = "arraybuffer";

    ws.onopen = () => {
      try {
        ws.send(JSON.stringify({ a: 111 }));
      } catch {
        /* ignore */
      }
    };

    ws.onmessage = async (event) => {
      const raw = await wsDataToString(event.data as string | Blob | ArrayBuffer);
      if (!raw) return;
      const idx = { current: sharedIdx };
      const parsed = parseStrikePayload(raw, idx);
      sharedIdx = idx.current;
      if (parsed.length) sharedPending.push(...parsed);
    };

    ws.onerror = () => ws.close();
    sharedSockets.push(ws);
  } catch {
    /* ignore single host failure */
  }
}

function connectShared() {
  if (sharedClosed) return;
  sharedSockets.forEach((ws) => ws.close());
  sharedSockets = [];

  for (const host of pickSocketHosts(SOCKET_COUNT)) {
    connectSocket(host);
  }

  if (sharedKeepalive) clearInterval(sharedKeepalive);
  sharedKeepalive = setInterval(() => {
    for (const ws of sharedSockets) {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({ a: 542 }));
        } catch {
          /* ignore */
        }
      }
    }
  }, KEEPALIVE_MS);
}

function scheduleReconnect() {
  if (sharedClosed || sharedReconnect) return;
  sharedReconnect = setTimeout(() => {
    sharedReconnect = null;
    connectShared();
  }, 1500);
}

function startSharedConnection() {
  if (sharedFlushTimer) return;

  sharedClosed = false;
  connectShared();

  sharedFlushTimer = setInterval(flushPending, FLUSH_MS);

  sharedWatchdog = setInterval(() => {
    if (sharedClosed) return;
    const open = sharedSockets.filter((ws) => ws.readyState === WebSocket.OPEN);
    if (open.length === 0 && sharedSockets.length > 0) {
      scheduleReconnect();
    }
  }, 3000);

  sharedCleanupTimer = setInterval(() => {
    const now = Date.now();
    applyStrikeCache(strikeCache.filter((s) => now - s.time < STRIKE_TTL));
  }, 60_000);
}

function stopSharedConnection() {
  sharedClosed = true;
  if (sharedFlushTimer) clearInterval(sharedFlushTimer);
  if (sharedCleanupTimer) clearInterval(sharedCleanupTimer);
  if (sharedWatchdog) clearInterval(sharedWatchdog);
  if (sharedReconnect) clearTimeout(sharedReconnect);
  if (sharedKeepalive) clearInterval(sharedKeepalive);
  sharedFlushTimer = null;
  sharedCleanupTimer = null;
  sharedWatchdog = null;
  sharedReconnect = null;
  sharedKeepalive = null;
  flushPending();
  sharedSockets.forEach((ws) => ws.close());
  sharedSockets = [];
}

export function useLightning(enabled: boolean) {
  const [strikes, setStrikes] = useState<LightningStrike[]>(enabled ? strikeCache : []);
  const enabledRef = useRef(enabled);

  useEffect(() => {
    enabledRef.current = enabled;
    if (enabled) {
      setStrikes(strikeCache);
    }
  }, [enabled]);

  useEffect(() => {
    sharedSubscribers += 1;
    startSharedConnection();

    const syncTimer = setInterval(() => {
      if (enabledRef.current) setStrikes(strikeCache);
    }, FLUSH_MS);

    return () => {
      clearInterval(syncTimer);
      sharedSubscribers -= 1;
      if (sharedSubscribers <= 0) {
        stopSharedConnection();
      }
    };
  }, []);

  return strikes;
}
