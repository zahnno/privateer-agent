import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { ModelMessage } from "ai";
import { globalDir } from "../config/load.ts";
import type { UsageTotals } from "../engine/events.ts";

// Persisted conversation for a project. Keeps just the latest session per project,
// which is what `--continue` restores.
export interface SessionData {
  updatedAt: string;
  modelSpec: string;
  messages: ModelMessage[];
  usage: UsageTotals;
}

// A stable per-project key derived from the absolute cwd.
function projectKey(cwd: string): string {
  return createHash("sha1").update(cwd).digest("hex").slice(0, 12);
}

function projectDir(cwd: string): string {
  return join(globalDir(), "projects", projectKey(cwd));
}

function latestPath(cwd: string): string {
  return join(projectDir(cwd), "latest.json");
}

export function saveSession(cwd: string, data: Omit<SessionData, "updatedAt">): void {
  const dir = projectDir(cwd);
  mkdirSync(dir, { recursive: true });
  const payload: SessionData = { ...data, updatedAt: new Date().toISOString() };
  writeFileSync(latestPath(cwd), JSON.stringify(payload), "utf8");
}

export function loadLatest(cwd: string): SessionData | null {
  const path = latestPath(cwd);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as SessionData;
  } catch {
    return null;
  }
}
