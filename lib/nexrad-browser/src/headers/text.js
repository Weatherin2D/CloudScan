export default function parseTextHeader(raf) {
  const text = {};
  text.fileType = raf.readString(6);
  raf.readString(1);
  text.id = raf.readString(4);
  raf.readString(1);
  text.ddhhmm = raf.readString(6);
  raf.readString(3);
  text.type = raf.readString(3);
  text.id3 = raf.readString(3);
  raf.readString(3);
  return text;
}
