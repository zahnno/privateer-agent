import type { Config } from "./config/schema.ts";
import { resolveModel } from "./providers/resolve.ts";
import { createTools } from "./tools/index.ts";
import { buildSystemPrompt } from "./context/systemPrompt.ts";
import { QueryEngine } from "./engine/QueryEngine.ts";
import { autoApproveGate, type PermissionGate } from "./permissions/gate.ts";

export interface SessionOptions {
  config: Config;
  modelSpec: string;
  cwd: string;
  gate?: PermissionGate;
}

export interface Session {
  engine: QueryEngine;
  modelSpec: string;
  provider: string;
  modelId: string;
  cwd: string;
}

// Assemble a ready-to-run agent session: resolve the model, bind tools to the
// cwd + permission gate, build the system prompt, and create the engine.
export function createSession(opts: SessionOptions): Session {
  const resolved = resolveModel(opts.modelSpec, opts.config);
  const gate = opts.gate ?? autoApproveGate;
  const tools = createTools({ cwd: opts.cwd, gate });
  const system = buildSystemPrompt({ cwd: opts.cwd, model: opts.modelSpec });

  const engine = new QueryEngine({
    model: resolved.model,
    system,
    tools,
    maxSteps: opts.config.maxSteps,
  });

  return {
    engine,
    modelSpec: opts.modelSpec,
    provider: resolved.provider,
    modelId: resolved.modelId,
    cwd: opts.cwd,
  };
}
