import { createRequire } from "node:module";
import path from "node:path";
import type { Plugin } from "vite";

const require = createRequire(path.join(import.meta.dirname, "package.json"));
const viteDir = path.dirname(require.resolve("vite/package.json"));
const { transformSync } = require(require.resolve("esbuild", { paths: [viteDir] }));

/** Transform nexrad-level-3-data CommonJS modules for browser ESM loading in Vite dev. */
export function nexradLevel3Cjs(): Plugin {
  return {
    name: "nexrad-level-3-cjs",
    enforce: "pre",
    transform(code, id) {
      const normalized = id.replace(/\\/g, "/");
      if (!normalized.includes("/nexrad-level-3-data/")) return null;
      if (!normalized.endsWith(".js")) return null;
      if (!/\bmodule\.exports\b/.test(code) && !/\brequire\s*\(/.test(code)) return null;

      try {
        const result = transformSync(code, {
          loader: "js",
          format: "esm",
          platform: "browser",
          target: "es2020",
        });
        return { code: result.code, map: result.map || undefined };
      } catch {
        return null;
      }
    },
  };
}
