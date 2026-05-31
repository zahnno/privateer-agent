import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTools } from "../src/tools/index.ts";
import { autoApproveGate } from "../src/permissions/gate.ts";

function setup() {
  const cwd = mkdtempSync(join(tmpdir(), "privateer-test-"));
  const tools: any = createTools({ cwd, gate: autoApproveGate });
  const run = (name: string, args: any) => tools[name].execute(args, { toolCallId: "t", messages: [] });
  return { cwd, run, cleanup: () => rmSync(cwd, { recursive: true, force: true }) };
}

test("write then read round-trips content", async () => {
  const { cwd, run, cleanup } = setup();
  try {
    const w = await run("write", { path: "a.txt", content: "line1\nline2\n" });
    assert.match(w, /Created a\.txt/);
    assert.equal(readFileSync(join(cwd, "a.txt"), "utf8"), "line1\nline2\n");
    const r = await run("read", { path: "a.txt" });
    assert.match(r, /1\tline1/);
    assert.match(r, /2\tline2/);
  } finally {
    cleanup();
  }
});

test("edit replaces a unique string and rejects ambiguous matches", async () => {
  const { cwd, run, cleanup } = setup();
  try {
    writeFileSync(join(cwd, "b.txt"), "foo bar foo");
    const ambiguous = await run("edit", { path: "b.txt", old_string: "foo", new_string: "baz" });
    assert.match(ambiguous, /matches 2 places/);
    const ok = await run("edit", { path: "b.txt", old_string: "bar", new_string: "BAR" });
    assert.match(ok, /Edited b\.txt/);
    assert.equal(readFileSync(join(cwd, "b.txt"), "utf8"), "foo BAR foo");
    const all = await run("edit", { path: "b.txt", old_string: "foo", new_string: "X", replace_all: true });
    assert.match(all, /2 replacements/);
    assert.equal(readFileSync(join(cwd, "b.txt"), "utf8"), "X BAR X");
  } finally {
    cleanup();
  }
});

test("glob and grep find files and content", async () => {
  const { cwd, run, cleanup } = setup();
  try {
    writeFileSync(join(cwd, "x.ts"), "export const hello = 1;\n");
    writeFileSync(join(cwd, "y.md"), "# doc\n");
    const g = await run("glob", { pattern: "*.ts" });
    assert.match(g, /x\.ts/);
    assert.doesNotMatch(g, /y\.md/);
    const gr = await run("grep", { pattern: "hello", glob: "*.ts" });
    assert.match(gr, /x\.ts.*hello/);
  } finally {
    cleanup();
  }
});

test("bash runs a command and reports exit code", async () => {
  const { run, cleanup } = setup();
  try {
    const out = await run("bash", { command: "echo privateer-ok" });
    assert.match(out, /privateer-ok/);
    assert.match(out, /\[exit code 0\]/);
  } finally {
    cleanup();
  }
});

test("path guardrail blocks escaping the cwd", async () => {
  const { run, cleanup } = setup();
  try {
    await assert.rejects(() => run("read", { path: "../../etc/passwd" }), /outside the working directory/);
  } finally {
    cleanup();
  }
});
