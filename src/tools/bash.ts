import { tool } from "ai";
import { z } from "zod";
import type { ToolContext } from "./context.ts";
import { exec } from "./exec.ts";
import { PermissionDeniedError } from "../permissions/gate.ts";

const DEFAULT_TIMEOUT = 120_000;
const MAX_TIMEOUT = 600_000;

export function bashTool(ctx: ToolContext) {
  return tool({
    description:
      "Run a shell command in the working directory and return its output. " +
      "Use for builds, tests, git, and other CLI tasks. Avoid long-running/interactive commands.",
    inputSchema: z.object({
      command: z.string().describe("The shell command to run."),
      timeout: z.number().int().positive().optional().describe("Timeout in ms (max 600000)."),
    }),
    execute: async ({ command, timeout }) => {
      const decision = await ctx.gate.request({
        tool: "bash",
        kind: "bash",
        title: "Run command",
        detail: command,
      });
      if (decision === "deny") throw new PermissionDeniedError("bash");

      const timeoutMs = Math.min(timeout ?? DEFAULT_TIMEOUT, MAX_TIMEOUT);
      const { stdout, stderr, code, timedOut } = await exec(command, [], {
        cwd: ctx.cwd,
        timeoutMs,
        shell: true,
      });

      const parts: string[] = [];
      if (stdout.trim()) parts.push(stdout.trimEnd());
      if (stderr.trim()) parts.push(`[stderr]\n${stderr.trimEnd()}`);
      if (timedOut) parts.push(`[timed out after ${timeoutMs}ms]`);
      parts.push(`[exit code ${code ?? "null"}]`);
      return parts.join("\n");
    },
  });
}
