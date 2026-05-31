import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, existsSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { QueryEngine } from "../src/engine/QueryEngine.ts";
import { createTools } from "../src/tools/index.ts";
import { autoApproveGate } from "../src/permissions/gate.ts";

// Build a ReadableStream that emits the given AI SDK v2 stream parts in order.
function streamFrom(chunks: any[]): ReadableStream {
  return new ReadableStream({
    start(controller) {
      for (const c of chunks) controller.enqueue(c);
      controller.close();
    },
  });
}

// Minimal hand-rolled LanguageModelV2 mock: step 1 calls the `write` tool, step 2
// emits a final text answer. Exercises the real multi-step tool loop, our tool
// execution, event normalization, and usage accumulation — no network, no test deps.
function scriptedModel(filePath: string) {
  let step = 0;
  return {
    specificationVersion: "v2",
    provider: "mock",
    modelId: "mock-1",
    supportedUrls: {},
    async doStream() {
      step++;
      if (step === 1) {
        return {
          stream: streamFrom([
            { type: "stream-start", warnings: [] },
            {
              type: "tool-call",
              toolCallId: "c1",
              toolName: "write",
              input: JSON.stringify({ path: filePath, content: "hi from privateer\n" }),
            },
            { type: "finish", finishReason: "tool-calls", usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 } },
          ]),
        };
      }
      return {
        stream: streamFrom([
          { type: "stream-start", warnings: [] },
          { type: "text-start", id: "t1" },
          { type: "text-delta", id: "t1", delta: "Created the file." },
          { type: "text-end", id: "t1" },
          { type: "finish", finishReason: "stop", usage: { inputTokens: 20, outputTokens: 8, totalTokens: 28 } },
        ]),
      };
    },
  };
}

test("engine runs a full tool-call loop and accumulates usage", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "privateer-engine-"));
  try {
    const tools = createTools({ cwd, gate: autoApproveGate });
    const engine = new QueryEngine({
      model: scriptedModel("out.txt") as any,
      system: "test",
      tools,
      maxSteps: 10,
    });

    const events: string[] = [];
    let text = "";
    for await (const ev of engine.send("make the file")) {
      events.push(ev.type);
      if (ev.type === "text") text += ev.text;
      if (ev.type === "error") throw new Error(`engine error: ${ev.error}`);
    }

    assert.ok(events.includes("tool-call"), "should emit tool-call");
    assert.ok(events.includes("tool-result"), "should emit tool-result");
    assert.ok(events.includes("finish"), "should emit finish");
    assert.equal(text, "Created the file.");
    assert.ok(existsSync(join(cwd, "out.txt")), "tool actually wrote the file");
    assert.equal(readFileSync(join(cwd, "out.txt"), "utf8"), "hi from privateer\n");
    assert.ok(engine.usage.totalTokens > 0, "usage accumulated");
    assert.ok(engine.messages.length >= 2, "history persisted");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
