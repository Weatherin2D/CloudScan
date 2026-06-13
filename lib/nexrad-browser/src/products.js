/**
 * Browser-safe replacement for nexrad-level-3-data/src/products/index.js
 * (the upstream module uses fs.readdirSync(__dirname), which fails in the browser).
 */
import { RandomAccessFile } from "./randomaccessfile.js";

function deltaTime(value) {
  return {
    deltaTime: (value & 0xffe0) >> 5,
    nonSupplementalScan: (value & 0x001f) === 0,
    sailsScan: (value & 0x001f) === 1,
    mrleScan: (value & 0x001f) === 2,
  };
}

/** ICD layout: HW30 elev + 32-byte threshold (scale/offset floats) + HW47–53 tail. */
function digitalHalfwords30_53(data) {
  const raf = new RandomAccessFile(data);
  const elevationAngle = raf.readShort() / 10;
  const threshold = raf.read(32);
  const scale = threshold.readFloatBE(0);
  const offset = threshold.readFloatBE(4);
  const maxReflectivity = raf.readShort();
  const dependent48_49 = raf.read(4);
  const deltaShort = raf.readShort();
  const compressionMethod = raf.readShort();
  const uncompressedProductSize = (raf.readUShort() << 16) + raf.readUShort();
  return {
    elevationAngle,
    plot: {
      scale,
      offset,
      maxDataValue: 255,
      leadingFlags: { noData: 0 },
    },
    maxReflectivity,
    dependent48_49,
    ...deltaTime(deltaShort),
    compressionMethod,
    uncompressedProductSize,
  };
}

const digitalProductDescription = { halfwords30_53: digitalHalfwords30_53 };

function digitalProduct(code, abbreviation, description) {
  return { code, abbreviation, description, productDescription: digitalProductDescription };
}

/** ICD layout for 256-level reflectivity/velocity products (153, 154, 94). */
function leveledHalfwords30_53(data) {
  const raf = new RandomAccessFile(data);
  return {
    elevationAngle: raf.readShort() / 10,
    plot: {
      minimumDataValue: raf.readShort() / 10,
      dataIncrement: raf.readShort() / 10,
      dataLevels: raf.readShort(),
    },
    dependent34_46: raf.read(26),
    maxReflectivity: raf.readShort(),
    dependent48_49: raf.read(4),
    ...deltaTime(raf.readShort()),
    compressionMethod: raf.readShort(),
    uncompressedProductSize: (raf.readUShort() << 16) + raf.readUShort(),
  };
}

const leveledProductDescription = { halfwords30_53: leveledHalfwords30_53 };

function leveledProduct(code, abbreviation, description) {
  return { code, abbreviation, description, productDescription: leveledProductDescription };
}

const productsRaw = [
  digitalProduct(
    161,
    ["NXC", "NYC", "NZC", "N0C", "NAC", "N1C", "NBC", "N2C", "N3C"],
    "Correlation Coefficient",
  ),
  digitalProduct(
    159,
    ["NXD", "NYD", "NZD", "N0X", "NAD", "N1X", "NBD", "N2X", "N3X"],
    "Differential Reflectivity",
  ),
  digitalProduct(
    163,
    ["NXK", "NYK", "NZK", "N0K", "NAK", "N1K", "NBK", "N2K", "N3K"],
    "Specific Differential Phase",
  ),
  leveledProduct(
    153,
    ["NXB", "NYB", "NZB", "N0B", "NAB", "N1B", "NBB", "N2B", "N3B"],
    "Base Reflectivity",
  ),
  leveledProduct(
    154,
    ["NXG", "NYG", "NZG", "N0G", "NAG", "N1G", "NBG", "N2G", "N3G"],
    "Base Radial Velocity",
  ),
];

const products = {};
for (const product of productsRaw) {
  if (products[product.code]) {
    throw new Error(`Duplicate product code ${product.code}`);
  }
  products[product.code] = product;
}

const productAbbreviations = productsRaw.flatMap((product) => product.abbreviation);

export { products, productAbbreviations };
export default { products, productAbbreviations };
