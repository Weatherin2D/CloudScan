declare module "@workspace/nexrad-browser" {
  import type { Buffer } from "buffer";

  type NexradParser = (
    file: Buffer,
    options?: { logger?: false | Console },
  ) => {
    productDescription?: {
      latitude: number;
      longitude: number;
      elevationAngle?: number;
      code?: number;
    };
    radialPackets?: unknown[];
  };

  const parser: NexradParser;
  export default parser;
}
