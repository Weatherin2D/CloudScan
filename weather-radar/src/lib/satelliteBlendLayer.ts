import L from "leaflet";
import {
  eastWestBlendWeight,
  gibsLayerId,
  gibsTileUrlAt,
  goesArchivedLayerId,
  goesArchivedTileUrlAt,
  goesFulldiskLayerId,
  goesLiveTileUrlAt,
  loadTileImage,
  solarElevationDeg,
  tilePixelToLatLon,
  unixToGibsIso,
  visibleDaylightWeight,
  type GoesBird,
  type GoesChannelId,
} from "@/lib/satelliteImagery";

const TILE_SIZE = 256;

async function loadBirdImage(
  bird: GoesBird,
  channel: GoesChannelId,
  frameUnix: number | undefined,
  tmsId: string | undefined,
  coords: L.Coords,
): Promise<HTMLImageElement | null> {
  const candidates: Promise<HTMLImageElement | null>[] = [];

  const gibsLayer = gibsLayerId(bird, channel);
  if (gibsLayer && frameUnix) {
    candidates.push(
      loadTileImage(
        gibsTileUrlAt(
          gibsLayer,
          unixToGibsIso(frameUnix),
          coords.z,
          coords.x,
          coords.y,
        ),
      ),
    );
  }

  const archivedTms = tmsId ?? "0";
  const archivedLayerId = goesArchivedLayerId(bird, channel, archivedTms);
  candidates.push(
    loadTileImage(goesArchivedTileUrlAt(archivedLayerId, coords.z, coords.x, coords.y)),
  );

  const results = await Promise.all(candidates);
  const hit = results.find((img) => img !== null);
  if (hit) return hit;

  const liveUrl = goesLiveTileUrlAt(
    goesFulldiskLayerId(bird, channel),
    coords.z,
    coords.x,
    coords.y,
  );
  return loadTileImage(liveUrl);
}

/** Blend GOES-East/West with a horizontal alpha mask (no pixel reads — CORS-safe). */
function drawEastWestBlend(
  ctx: CanvasRenderingContext2D,
  coords: L.Coords,
  eastImg: CanvasImageSource | null,
  westImg: CanvasImageSource | null,
) {
  if (!eastImg && !westImg) return;
  if (!westImg) {
    ctx.drawImage(eastImg!, 0, 0, TILE_SIZE, TILE_SIZE);
    return;
  }
  if (!eastImg) {
    ctx.drawImage(westImg, 0, 0, TILE_SIZE, TILE_SIZE);
    return;
  }

  ctx.drawImage(westImg, 0, 0, TILE_SIZE, TILE_SIZE);

  const mask = document.createElement("canvas");
  mask.width = TILE_SIZE;
  mask.height = TILE_SIZE;
  const maskCtx = mask.getContext("2d");
  if (!maskCtx) {
    ctx.drawImage(eastImg, 0, 0, TILE_SIZE, TILE_SIZE);
    return;
  }

  maskCtx.drawImage(eastImg, 0, 0, TILE_SIZE, TILE_SIZE);

  const gradient = maskCtx.createLinearGradient(0, 0, TILE_SIZE, 0);
  for (let px = 0; px <= TILE_SIZE; px += 16) {
    const { lon } = tilePixelToLatLon(coords.z, coords.x, coords.y, px, TILE_SIZE / 2);
    gradient.addColorStop(px / TILE_SIZE, `rgba(0,0,0,${eastWestBlendWeight(lon)})`);
  }

  maskCtx.globalCompositeOperation = "destination-in";
  maskCtx.fillStyle = gradient;
  maskCtx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

  ctx.drawImage(mask, 0, 0);
}

function drawDayNightBird(
  ctx: CanvasRenderingContext2D,
  coords: L.Coords,
  visImg: HTMLImageElement | null,
  irImg: HTMLImageElement | null,
  when: Date,
) {
  const { lat, lon } = tilePixelToLatLon(coords.z, coords.x, coords.y, TILE_SIZE / 2, TILE_SIZE / 2);
  const daylight = visibleDaylightWeight(solarElevationDeg(lat, lon, when));

  if (irImg) ctx.drawImage(irImg, 0, 0, TILE_SIZE, TILE_SIZE);
  if (visImg && daylight > 0) {
    ctx.globalAlpha = daylight;
    ctx.drawImage(visImg, 0, 0, TILE_SIZE, TILE_SIZE);
    ctx.globalAlpha = 1;
  }
}

function compositeBirdPair(
  ctx: CanvasRenderingContext2D,
  coords: L.Coords,
  east: CanvasImageSource | null,
  west: CanvasImageSource | null,
) {
  const off = document.createElement("canvas");
  off.width = TILE_SIZE;
  off.height = TILE_SIZE;
  const offCtx = off.getContext("2d");
  if (!offCtx) return;
  drawEastWestBlend(offCtx, coords, east, west);
  ctx.drawImage(off, 0, 0);
}

export type GoesGlobeTileLayer = L.TileLayer & {
  options: L.TileLayerOptions & {
    mode: "auto" | "single";
    tmsId: string;
    frameUnix?: number;
    channel?: GoesChannelId;
    visibleChannel?: GoesChannelId;
    infraredChannel?: GoesChannelId;
  };
};

export const GoesGlobeTileLayerClass = L.TileLayer.extend({
  createTile(coords: L.Coords, done: L.DoneCallback) {
    const canvas = document.createElement("canvas");
    canvas.width = TILE_SIZE;
    canvas.height = TILE_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      done(undefined, canvas);
      return canvas;
    }

    const opts = (this as GoesGlobeTileLayer).options;
    const when = opts.frameUnix ? new Date(opts.frameUnix * 1000) : new Date();

    const load = async () => {
      const tmsId = opts.tmsId;
      if (opts.mode === "auto") {
        const [eastVis, eastIr, westVis, westIr] = await Promise.all([
          loadBirdImage("east", opts.visibleChannel!, opts.frameUnix, tmsId, coords),
          loadBirdImage("east", opts.infraredChannel!, opts.frameUnix, tmsId, coords),
          loadBirdImage("west", opts.visibleChannel!, opts.frameUnix, tmsId, coords),
          loadBirdImage("west", opts.infraredChannel!, opts.frameUnix, tmsId, coords),
        ]);

        const eastOff = document.createElement("canvas");
        eastOff.width = TILE_SIZE;
        eastOff.height = TILE_SIZE;
        const eastCtx = eastOff.getContext("2d");
        if (eastCtx) drawDayNightBird(eastCtx, coords, eastVis, eastIr, when);

        const westOff = document.createElement("canvas");
        westOff.width = TILE_SIZE;
        westOff.height = TILE_SIZE;
        const westCtx = westOff.getContext("2d");
        if (westCtx) drawDayNightBird(westCtx, coords, westVis, westIr, when);

        compositeBirdPair(
          ctx,
          coords,
          eastVis || eastIr ? eastOff : null,
          westVis || westIr ? westOff : null,
        );
      } else {
        const channel = opts.channel!;
        const [east, west] = await Promise.all([
          loadBirdImage("east", channel, opts.frameUnix, tmsId, coords),
          loadBirdImage("west", channel, opts.frameUnix, tmsId, coords),
        ]);
        drawEastWestBlend(ctx, coords, east, west);
      }
      done(undefined, canvas);
    };

    load().catch(() => done(undefined, canvas));
    return canvas;
  },
}) as unknown as new (
  url: string,
  options: L.TileLayerOptions & {
    mode: "auto" | "single";
    tmsId: string;
    frameUnix?: number;
    channel?: GoesChannelId;
    visibleChannel?: GoesChannelId;
    infraredChannel?: GoesChannelId;
  },
) => GoesGlobeTileLayer;
