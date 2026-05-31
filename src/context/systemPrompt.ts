import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Minimal system prompt for the agent. Phase 5 expands this with richer environment
// detail and project memory; for now it covers identity, the toolset, and house style.
export function buildSystemPrompt(opts: { cwd: string; model: string }): string {
  const parts: string[] = [];

  parts.push(
    `You are Privateer, a provider-agnostic terminal coding agent. You help with software ` +
      `engineering tasks directly from the user's terminal.`,
  );
  parts.push(
    `Tools available: read, write, edit, glob, grep, bash. Prefer 'edit' over 'write' for ` +
      `changes to existing files. Use 'grep'/'glob' to explore before editing. Read files before ` +
      `editing them. Keep responses concise; let tool actions speak for themselves.`,
  );
  parts.push(
    `Environment:\n- cwd: ${opts.cwd}\n- model: ${opts.model}\n- platform: ${process.platform}`,
  );

  // Project context file, our CLAUDE.md analog.
  const ctxFile = join(opts.cwd, "PRIVATEER.md");
  if (existsSync(ctxFile)) {
    parts.push(`Project context from PRIVATEER.md:\n${readFileSync(ctxFile, "utf8").trim()}`);
  }

  return parts.join("\n\n");
}
