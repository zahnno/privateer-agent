import { test } from "node:test";
import assert from "node:assert/strict";
import { runCommand, type CommandContext } from "../src/commands/registry.ts";
import { Config } from "../src/config/schema.ts";
import { emptyUsage } from "../src/engine/events.ts";

const ctx: CommandContext = {
  config: Config.parse({ providers: { anthropic: { apiKey: "x" } } }),
  modelSpec: "anthropic:claude-opus-4-8",
  mode: "default",
  usage: emptyUsage(),
  cwd: process.cwd(),
};

test("non-slash input is not a command", () => {
  assert.equal(runCommand("hello world", ctx), null);
});

test("/help lists commands", () => {
  const r = runCommand("/help", ctx);
  assert.equal(r?.type, "notice");
  assert.match((r as any).text, /\/model/);
  assert.match((r as any).text, /\/provider/);
});

test("/model with no args reports current, with arg sets it", () => {
  assert.match((runCommand("/model", ctx) as any).text, /anthropic:claude-opus-4-8/);
  const set = runCommand("/model openrouter:foo/bar", ctx);
  assert.deepEqual(set, { type: "setModel", spec: "openrouter:foo/bar" });
});

test("/model rejects malformed spec", () => {
  const r = runCommand("/model nocolon", ctx);
  assert.equal(r?.type, "notice");
  assert.equal((r as any).tone, "error");
});

test("/provider shows readiness", () => {
  const r = runCommand("/provider", ctx);
  assert.match((r as any).text, /anthropic/);
  assert.match((r as any).text, /openrouter/);
});

test("/permissions sets a known mode and rejects unknown", () => {
  assert.deepEqual(runCommand("/permissions bypass", ctx), { type: "setMode", mode: "bypass" });
  assert.equal((runCommand("/permissions nope", ctx) as any).tone, "error");
});

test("unknown command errors", () => {
  const r = runCommand("/frobnicate", ctx);
  assert.equal((r as any).tone, "error");
});

test("/clear and /exit map to control results", () => {
  assert.deepEqual(runCommand("/clear", ctx), { type: "clear" });
  assert.deepEqual(runCommand("/exit", ctx), { type: "exit" });
});
