import { expand4_4 } from "./utilities/rle.js";

export const code = 0xaf1f;
export const description = "Radial Data Packet (16 Data Levels)";

export function parser(raf) {
  const packetCode = raf.readUShort();
  if (packetCode !== code) throw new Error(`Packet codes do not match ${code} !== ${packetCode}`);

  const result = {
    firstBin: raf.readShort(),
    numberBins: raf.readShort(),
    iSweepCenter: raf.readShort(),
    jSweepCenter: raf.readShort(),
    rangeScale: raf.readShort() / 1000,
    numRadials: raf.readShort(),
  };
  result.packetCodeHex = packetCode.toString(16);

  const radials = [];
  for (let r = 0; r < result.numRadials; r += 1) {
    const rleLength = raf.readShort() * 2;
    const radial = {
      startAngle: raf.readShort() / 10,
      angleDelta: raf.readShort() / 10,
      bins: [],
    };
    for (let i = 0; i < rleLength; i += 1) {
      radial.bins.push(...expand4_4(raf.readByte()));
    }
    radials.push(radial);
  }
  result.radials = radials;
  return result;
}
