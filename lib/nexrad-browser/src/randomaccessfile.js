import { Buffer } from "buffer";

const BIG_ENDIAN = 0;
const LITTLE_ENDIAN = 1;

/** Browser ESM port of nexrad-level-3-data RandomAccessFile (no CJS upstream import). */
export class RandomAccessFile {
  constructor(file, endian = BIG_ENDIAN, stringFormat = "utf-8") {
    this.offset = 0;
    this.buffer = null;
    this.stringFormat = stringFormat;

    if (endian < 0) return;
    this.bigEndian = endian === BIG_ENDIAN;

    if (typeof file === "string") {
      this.buffer = Buffer.from(file, "binary");
    } else {
      this.buffer = file;
    }

    if (this.bigEndian) {
      this.readFloatLocal = this.buffer.readFloatBE.bind(this.buffer);
      this.readIntLocal = this.buffer.readIntBE.bind(this.buffer);
      this.readUIntLocal = this.buffer.readUIntBE.bind(this.buffer);
    } else {
      this.readFloatLocal = this.buffer.readFloatLE.bind(this.buffer);
      this.readIntLocal = this.buffer.readIntLE.bind(this.buffer);
      this.readUIntLocal = this.buffer.readUIntLE.bind(this.buffer);
    }
  }

  getLength() {
    return this.buffer.length;
  }

  getPos() {
    return this.offset;
  }

  seek(byte) {
    this.offset = byte;
  }

  readString(bytes) {
    const data = this.buffer.toString(this.stringFormat, this.offset, (this.offset += bytes));
    return data;
  }

  readFloat() {
    const float = this.readFloatLocal(this.offset);
    this.offset += 4;
    return float;
  }

  readInt() {
    const int = this.readIntLocal(this.offset, 4);
    this.offset += 4;
    return int;
  }

  readUInt() {
    const int = this.readUIntLocal(this.offset, 4);
    this.offset += 4;
    return int;
  }

  readShort() {
    const short = this.readIntLocal(this.offset, 2);
    this.offset += 2;
    return short;
  }

  readUShort() {
    const short = this.readUIntLocal(this.offset, 2);
    this.offset += 2;
    return short;
  }

  readByte() {
    return this.read()[0];
  }

  read(bytes = 1) {
    const data = this.buffer.slice(this.offset, this.offset + bytes);
    this.offset += bytes;
    return data;
  }

  skip(bytes) {
    this.offset += bytes;
  }
}

export { BIG_ENDIAN, LITTLE_ENDIAN };
