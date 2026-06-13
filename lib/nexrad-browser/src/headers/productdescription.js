export const MODE_MAINTENANCE = 0;
export const MODE_CLEAN_AIR = 1;
export const MODE_PRECIPITATION = 2;

export function parse(raf, product) {
  const divider = raf.readShort();
  if (divider !== -1) throw new Error(`Invalid product description divider: ${divider}`);

  const result = {
    abbreviation: product.abbreviation,
    description: product.description,
    latitude: raf.readInt() / 1000,
    longitude: raf.readInt() / 1000,
    height: raf.readShort(),
    code: raf.readShort(),
    mode: raf.readShort(),
    vcp: raf.readShort(),
    sequenceNumber: raf.readShort(),
    volumeScanNumber: raf.readShort(),
    volumeScanDate: raf.readShort(),
    volumeScanTime: raf.readInt(),
    productDate: raf.readShort(),
    productTime: raf.readInt(),
    ...(product?.productDescription?.halfwords27_28?.(raf.read(4)) ?? { dependent27_28: raf.read(4) }),
    elevationNumber: raf.readShort(),
    ...(product?.productDescription?.halfwords30_53?.(raf.read(48)) ?? { dependent30_53: raf.read(48) }),
    version: raf.readByte(),
    spotBlank: raf.readByte(),
    offsetSymbology: raf.readInt(),
    offsetGraphic: raf.readInt(),
    offsetTabular: raf.readInt(),
    supplemental: product.supplemental,
  };

  return result;
}
