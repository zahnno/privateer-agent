import { resolve, isAbsolute, relative } from "node:path";
import type { PermissionGate } from "../permissions/gate.ts";

// Shared state handed to every tool's execute().
export interface ToolContext {
  cwd: string;
  gate: PermissionGate;
}

// Resolve a possibly-relative path against the session cwd and keep it inside the
// working directory (basic guardrail against `../` escapes from the model).
export function resolveInCwd(ctx: ToolContext, p: string): string {
  const abs = isAbsolute(p) ? p : resolve(ctx.cwd, p);
  const rel = relative(ctx.cwd, abs);
  if (rel.startsWith("..")) {
    throw new Error(`Path "${p}" is outside the working directory.`);
  }
  return abs;
}

// Display a path relative to cwd when possible (nicer for tool output / UI).
export function displayPath(ctx: ToolContext, abs: string): string {
  const rel = relative(ctx.cwd, abs);
  return rel === "" ? "." : rel;
}
