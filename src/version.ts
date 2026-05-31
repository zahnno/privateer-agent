// Single source of truth for the app's name/version, read from package.json.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(
  readFileSync(resolve(__dirname, "../package.json"), "utf8"),
) as { name: string; version: string; description: string };

export const NAME = "privateer";
export const VERSION = pkg.version;
export const DESCRIPTION = pkg.description;
