import parseSymbologyText from "./symbologytext.js";

const textSymbologies = [3, 4, 5, 6, 7];

export default function parseSymbologyHeader(raf) {
  const blockDivider = raf.readShort();
  const blockId = raf.readShort();
  if (textSymbologies.includes(blockId)) return parseSymbologyText(raf);
  const blockLength = raf.readInt();

  if (blockDivider !== -1) throw new Error(`Invalid symbology block divider: ${blockDivider}`);
  if (blockId !== 1) throw new Error(`Invalid symbology id: ${blockId}`);
  if (blockLength + raf.getPos() - 8 > raf.getLength()) {
    throw new Error(`Block length ${blockLength} overruns file length for block id: ${blockId}`);
  }

  return {
    numberLayers: raf.readShort(),
  };
}
