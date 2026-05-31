import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Config, PermissionMode } from "../config/schema.ts";
import { PERMISSION_MODES } from "../config/schema.ts";
import { configuredProviders, parseModelSpec } from "../providers/resolve.ts";
import { KNOWN_PROVIDERS } from "../config/schema.ts";
import type { UsageTotals } from "../engine/events.ts";
import { VERSION } from "../version.ts";

// The result of running a slash command. The App interprets these so command logic
// stays free of React/Ink concerns and is unit-testable.
export type CommandResult =
  | { type: "notice"; text: string; tone?: "info" | "error" }
  | { type: "clear" }
  | { type: "exit" }
  | { type: "setModel"; spec: string }
  | { type: "setMode"; mode: PermissionMode };

export interface CommandContext {
  config: Config;
  modelSpec: string;
  mode: PermissionMode;
  usage: UsageTotals;
  cwd: string;
}

interface CommandDef {
  name: string;
  summary: string;
  run: (args: string, ctx: CommandContext) => CommandResult;
}

const COMMANDS: CommandDef[] = [
  {
    name: "help",
    summary: "show available commands",
    run: () => ({
      type: "notice",
      text:
        "Commands:\n" +
        COMMANDS.map((c) => `  /${c.name.padEnd(11)} ${c.summary}`).join("\n"),
    }),
  },
  {
    name: "model",
    summary: "show or set the model (provider:model)",
    run: (args, ctx) => {
      const spec = args.trim();
      if (!spec) return { type: "notice", text: `Current model: ${ctx.modelSpec}` };
      try {
        parseModelSpec(spec); // validate shape
      } catch (err) {
        return { type: "notice", tone: "error", text: (err as Error).message };
      }
      return { type: "setModel", spec };
    },
  },
  {
    name: "provider",
    summary: "list providers and their readiness",
    run: (_args, ctx) => {
      const lines = configuredProviders(ctx.config).map(
        (p) => `  ${p.ready ? "✓" : "·"} ${p.name}${p.ready ? "" : "  (no key)"}`,
      );
      return {
        type: "notice",
        text: `Providers (${KNOWN_PROVIDERS.length}):\n${lines.join("\n")}`,
      };
    },
  },
  {
    name: "permissions",
    summary: "show or set permission mode",
    run: (args, ctx) => {
      const m = args.trim();
      if (!m) {
        return {
          type: "notice",
          text: `Permission mode: ${ctx.mode}\nModes: ${PERMISSION_MODES.join(", ")}`,
        };
      }
      if (!(PERMISSION_MODES as readonly string[]).includes(m)) {
        return { type: "notice", tone: "error", text: `Unknown mode "${m}". Use: ${PERMISSION_MODES.join(", ")}` };
      }
      return { type: "setMode", mode: m as PermissionMode };
    },
  },
  {
    name: "cost",
    summary: "show token usage this session",
    run: (_args, ctx) => ({
      type: "notice",
      text: `Tokens — in: ${ctx.usage.inputTokens}  out: ${ctx.usage.outputTokens}  total: ${ctx.usage.totalTokens}`,
    }),
  },
  {
    name: "init",
    summary: "create a PRIVATEER.md project context file",
    run: (_args, ctx) => {
      const path = join(ctx.cwd, "PRIVATEER.md");
      if (existsSync(path)) return { type: "notice", tone: "error", text: "PRIVATEER.md already exists." };
      writeFileSync(
        path,
        "# Project context\n\nDescribe this project, conventions, and anything Privateer should\n" +
          "always keep in mind here. This file is loaded into the system prompt.\n",
        "utf8",
      );
      return { type: "notice", text: "Created PRIVATEER.md." };
    },
  },
  {
    name: "doctor",
    summary: "environment diagnostics",
    run: (_args, ctx) => {
      const provs = configuredProviders(ctx.config)
        .map((p) => `${p.name}:${p.ready ? "ready" : "—"}`)
        .join("  ");
      return {
        type: "notice",
        text:
          `Privateer v${VERSION}\n` +
          `  node: ${process.version}\n` +
          `  cwd: ${ctx.cwd}\n` +
          `  model: ${ctx.modelSpec}\n` +
          `  mode: ${ctx.mode}\n` +
          `  providers: ${provs}`,
      };
    },
  },
  {
    name: "clear",
    summary: "clear the conversation",
    run: () => ({ type: "clear" }),
  },
  {
    name: "exit",
    summary: "quit Privateer",
    run: () => ({ type: "exit" }),
  },
  { name: "quit", summary: "quit Privateer", run: () => ({ type: "exit" }) },
];

export const COMMAND_NAMES = COMMANDS.map((c) => c.name);

// Parse and run a "/command args" line. Returns null if not a slash command.
export function runCommand(raw: string, ctx: CommandContext): CommandResult | null {
  if (!raw.startsWith("/")) return null;
  const [name, ...rest] = raw.slice(1).split(" ");
  const cmd = COMMANDS.find((c) => c.name === name);
  if (!cmd) {
    return { type: "notice", tone: "error", text: `Unknown command "/${name}". Try /help.` };
  }
  return cmd.run(rest.join(" "), ctx);
}
