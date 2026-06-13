export default function parseSymbologyText(raf) {
  const pages = [];
  let lines = [];

  let length = raf.readShort();
  do {
    while (length !== -1) {
      lines.push(raf.readString(length));
      length = raf.readShort();
    }
    pages.push(lines);
    lines = [];
    if (raf.getPos() < raf.getLength()) {
      length = raf.readShort();
    } else {
      length = -1;
    }
  } while (length === 80);

  raf.skip(-4);
  return { pages };
}
