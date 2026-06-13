import { existsSync, unlinkSync } from "node:fs";

for (const file of ["package-lock.json", "yarn.lock"]) {
  if (existsSync(file)) {
    unlinkSync(file);
  }
}

const userAgent = process.env.npm_config_user_agent ?? "";
const execPath = process.env.npm_execpath ?? "";
const usingPnpm =
  userAgent.includes("pnpm") ||
  execPath.includes("pnpm") ||
  process.env.GITHUB_ACTIONS === "true";

if (!usingPnpm) {
  console.error("Use pnpm instead");
  process.exit(1);
}
