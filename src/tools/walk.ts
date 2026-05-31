import { readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";

// Directories we never descend into, so searches stay fast and relevant without
// needing a full .gitignore parser. (A richer ignore story can come later.)
const SKIP_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  ".next",
  ".cache",
  "coverage",
  ".venv",
  "__pycache__",
  ".turbo",
]);

const MAX_FILES = 20_000;

// Recursively list files under `root`, returning paths relative to `root` with
// forward slashes (so glob patterns behave consistently across platforms).
export function walkFiles(root: string): string[] {
  const out: string[] = [];
  const stack: string[] = [root];
  while (stack.length && out.length < MAX_FILES) {
    const dir = stack.pop()!;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue; // unreadable dir — skip
    }
    for (const e of entries) {
      if (e.isDirectory()) {
        if (SKIP_DIRS.has(e.name)) continue;
        stack.push(join(dir, e.name));
      } else if (e.isFile()) {
        out.push(relative(root, join(dir, e.name)).split(sep).join("/"));
      }
    }
  }
  return out;
}
