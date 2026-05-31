import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { Config, type Config as ConfigT, type ProviderName } from "./schema.ts";

// Global config/data dir. Overridable via PRIVATEER_HOME (portability + tests).
// Computed lazily so the env var can be set before first use.
export function globalDir(): string {
  return process.env.PRIVATEER_HOME ?? join(homedir(), ".privateer");
}
export function globalConfigPath(): string {
  return join(globalDir(), "config.json");
}
export function projectConfigPath(): string {
  return join(process.cwd(), ".privateer", "config.json");
}

function readJsonIfExists(path: string): unknown {
  if (!existsSync(path)) return undefined;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (err) {
    throw new Error(`Failed to parse config at ${path}: ${(err as Error).message}`);
  }
}

// Shallow-merge two raw config objects (project overrides global; providers merge per-key).
function mergeRaw(base: any = {}, over: any = {}): any {
  return {
    ...base,
    ...over,
    providers: { ...(base.providers ?? {}), ...(over.providers ?? {}) },
    allowlist: over.allowlist ?? base.allowlist,
  };
}

// Environment fallbacks for provider credentials. Applied only when config omits them.
function applyEnv(cfg: ConfigT): ConfigT {
  const p = cfg.providers;
  const set = (name: ProviderName, key: "apiKey" | "baseURL", val?: string) => {
    if (!val) return;
    p[name] = { ...(p[name] ?? {}), [key]: (p[name] as any)?.[key] ?? val };
  };
  set("openrouter", "apiKey", process.env.OPENROUTER_API_KEY);
  set("anthropic", "apiKey", process.env.ANTHROPIC_API_KEY);
  set("openai", "apiKey", process.env.OPENAI_API_KEY);
  set("ollama", "baseURL", process.env.OLLAMA_BASE_URL);
  return cfg;
}

export function loadConfig(): ConfigT {
  const raw = mergeRaw(readJsonIfExists(globalConfigPath()), readJsonIfExists(projectConfigPath()));
  const cfg = Config.parse(raw ?? {});
  return applyEnv(cfg);
}

// Persist the global config (used by /model, /provider, /permissions to remember choices).
export function saveGlobalConfig(cfg: ConfigT): void {
  mkdirSync(globalDir(), { recursive: true });
  writeFileSync(globalConfigPath(), JSON.stringify(cfg, null, 2) + "\n", "utf8");
}
