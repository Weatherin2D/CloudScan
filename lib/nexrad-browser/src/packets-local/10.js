export const code = 16;
export const description = "Digital Radial Data Array Packet";

export function parser(raf, productDescription) {
  const packetCode = raf.readUShort();
  if (packetCode !== code) throw new Error(`Packet codes do not match ${code} !== ${packetCode}`);

  const result = {
    firstBin: raf.readShort(),
    numberBins: raf.readShort(),
    iSweepCenter: raf.readShort(),
    jSweepCenter: raf.readShort(),
    rangeScale: raf.readShort() / 1000,
    numberRadials: raf.readShort(),
  };
  result.packetCodeHex = packetCode.toString(16);

  const scaling = {
    scale: productDescription?.plot?.scale ?? 1,
    offset: productDescription?.plot?.offset ?? 0,
  };

  const scaled = [];
  let start = 0;
  if (productDescription?.plot?.leadingFlags?.noData === 0) {
    start = 1;
    scaled[0] = null;
  }
  if (productDescription?.plot?.maxDataValue !== undefined) {
    for (let i = start; i <= productDescription.plot.maxDataValue; i += 1) {
      scaled.push((i - scaling.offset) / scaling.scale);
    }
  } else if (productDescription?.plot?.dataLevels !== undefined) {
    scaled[0] = null;
    scaled[1] = null;
    for (let i = 2; i <= productDescription.plot.dataLevels; i += 1) {
      scaled[i] =
        productDescription.plot.minimumDataValue +
        i * productDescription.plot.dataIncrement;
    }
  }

  const radials = [];
  const radialsRaw = [];
  for (let r = 0; r < result.numberRadials; r += 1) {
    const bytesInRadial = raf.readShort();
    const radial = {
      startAngle: raf.readShort() / 10,
      angleDelta: raf.readShort() / 10,
      bins: [],
    };
    const radialRaw = { ...radial, bins: [] };
    for (let i = 0; i < result.numberBins; i += 1) {
      const value = raf.readByte();
      radial.bins.push(scaled[value]);
      radialRaw.bins.push(value);
    }
    radials.push(radial);
    radialsRaw.push(radialRaw);
    if (bytesInRadial !== result.numberBins) raf.skip(bytesInRadial - result.numberBins);
  }
  result.radials = radials;
  result.radialsRaw = radialsRaw;
  return result;
}
