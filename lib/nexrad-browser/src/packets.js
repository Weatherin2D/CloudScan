/**
 * Browser-safe replacement for nexrad-level-3-data/src/packets/index.js
 */
import * as pkt10 from "./packets-local/10.js";
import * as pktAf1f from "./packets-local/af1f.js";
import { cjs } from "./interop.js";

const packetsRaw = [cjs(pkt10), cjs(pktAf1f)];

const packets = {};
for (const packet of packetsRaw) {
  if (packets[packet.code]) {
    throw new Error(`Duplicate packet code ${packet.code}`);
  }
  packets[packet.code] = packet;
}

function parser(raf, productDescription) {
  const packetCode = raf.readUShort();
  raf.skip(-2);
  const packetCodeHex = packetCode.toString(16).padStart(4, "0");
  const packet = packets[packetCode];
  if (!packet) throw new Error(`Unsupported packet code 0x${packetCodeHex}`);
  return packet.parser(raf, productDescription);
}

export { packets, parser };
export default { packets, parser };
