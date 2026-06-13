export default function parseMessageHeader(raf) {
  return {
    code: raf.readShort(),
    julianDate: raf.readShort(),
    seconds: raf.readInt(),
    length: raf.readInt(),
    source: raf.readShort(),
    dest: raf.readShort(),
    blocks: raf.readShort(),
  };
}
