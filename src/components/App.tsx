import React, { useState, useRef, useEffect, useMemo } from "react";
import { Box, Text, Static, useApp, useInput } from "ink";
import TextInput from "ink-text-input";
import Spinner from "ink-spinner";
import { Banner } from "./Banner.tsx";
import { StatusBar } from "./StatusBar.tsx";
import { EntryView } from "./Transcript.tsx";
import { ApprovalPrompt } from "./ApprovalPrompt.tsx";
import type { Entry } from "./types.ts";
import type { Config, PermissionMode } from "../config/schema.ts";
import { createSession } from "../session.ts";
import { QueryEngine } from "../engine/QueryEngine.ts";
import { emptyUsage, type UsageTotals } from "../engine/events.ts";
import { runCommand } from "../commands/registry.ts";
import { saveGlobalConfig } from "../config/load.ts";
import { ModeGate, type AskOutcome } from "../permissions/uiGate.ts";
import type { PermissionRequest } from "../permissions/gate.ts";
import { saveSession, type SessionData } from "../memory/store.ts";

interface PendingApproval {
  req: PermissionRequest;
  resolve: (outcome: AskOutcome) => void;
}

const BANNER = "__banner__";

function asText(output: unknown): string {
  return typeof output === "string" ? output : JSON.stringify(output);
}

export function App({
  model,
  config,
  cwd,
  resume,
}: {
  model: string;
  config: Config;
  cwd: string;
  resume?: SessionData | null;
}) {
  const { exit } = useApp();
  const [committed, setCommitted] = useState<Entry[]>([]);
  const [live, setLive] = useState<Entry[]>([]);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState("");
  const [modelSpec, setModelSpec] = useState(model);
  const [mode, setMode] = useState<PermissionMode>(config.permissionMode);
  const [usage, setUsage] = useState<UsageTotals>(resume?.usage ?? emptyUsage());
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingApproval | null>(null);
  const engineRef = useRef<QueryEngine | null>(null);
  const seededRef = useRef(false);

  // The gate reads the live mode via a ref (so changing mode doesn't require
  // rebuilding the session/tools) and surfaces approvals through React state.
  const modeRef = useRef(mode);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);
  const allowlistRef = useRef<string[]>([...config.allowlist]);

  const gate = useMemo(
    () =>
      new ModeGate({
        getMode: () => modeRef.current,
        setMode: (m) => setMode(m),
        allowlist: allowlistRef.current,
        ask: (req) => new Promise<AskOutcome>((resolve) => setPending({ req, resolve })),
      }),
    [],
  );

  // Build (and rebuild on model change) the agent session, carrying history forward.
  useEffect(() => {
    try {
      const prev = engineRef.current;
      const session = createSession({ config, modelSpec, cwd, gate });
      if (prev) {
        session.engine.messages.push(...prev.messages);
      } else if (!seededRef.current && resume) {
        // First build of a resumed session: restore prior history and usage.
        session.engine.messages.push(...resume.messages);
        session.engine.usage = resume.usage;
      }
      seededRef.current = true;
      engineRef.current = session.engine;
      setSessionError(null);
    } catch (err) {
      engineRef.current = null;
      setSessionError(err instanceof Error ? err.message : String(err));
    }
  }, [modelSpec]);

  // One-time notice when resuming a prior conversation.
  useEffect(() => {
    if (resume && resume.messages.length > 0) {
      setCommitted((c) => [
        { kind: "notice", text: `Resumed previous session (${resume.messages.length} messages).` },
        ...c,
      ]);
    }
  }, []);

  function persist() {
    const eng = engineRef.current;
    if (!eng) return;
    try {
      saveSession(cwd, { modelSpec, messages: eng.messages, usage: eng.usage });
    } catch {
      /* non-fatal */
    }
  }

  useInput((input, key) => {
    if (key.ctrl && input === "c") exit();
  });

  const append = (...entries: Entry[]) => setCommitted((c) => [...c, ...entries]);

  function handleCommand(raw: string): boolean {
    const res = runCommand(raw, { config, modelSpec, mode, usage, cwd });
    if (!res) return false;
    append({ kind: "user", text: raw });
    switch (res.type) {
      case "exit":
        exit();
        break;
      case "clear":
        setCommitted([]);
        setLive([]);
        setUsage(emptyUsage());
        if (engineRef.current) {
          engineRef.current.messages.length = 0;
          engineRef.current.usage = emptyUsage();
        }
        persist();
        break;
      case "setModel":
        setModelSpec(res.spec);
        trySave({ ...config, defaultModel: res.spec });
        append({ kind: "notice", text: `Model set to ${res.spec}` });
        break;
      case "setMode":
        setMode(res.mode);
        trySave({ ...config, permissionMode: res.mode });
        append({ kind: "notice", text: `Permission mode: ${res.mode}` });
        break;
      case "notice":
        append({ kind: "notice", text: res.text, tone: res.tone });
        break;
    }
    return true;
  }

  function trySave(next: Config) {
    try {
      saveGlobalConfig(next);
    } catch {
      /* non-fatal: settings just won't persist */
    }
  }

  async function runTurn(text: string) {
    append({ kind: "user", text });
    const engine = engineRef.current;
    if (!engine) {
      append({
        kind: "notice",
        tone: "error",
        text: sessionError ?? "No model configured. Use /model or /provider.",
      });
      return;
    }

    setBusy(true);
    let liveEntries: Entry[] = [];
    let assistantIdx = -1;
    const sync = () => setLive(liveEntries);
    const pushLive = (e: Entry) => {
      liveEntries = [...liveEntries, e];
      sync();
    };

    try {
      for await (const ev of engine.send(text)) {
        switch (ev.type) {
          case "text":
            if (assistantIdx === -1) {
              pushLive({ kind: "assistant", text: ev.text });
              assistantIdx = liveEntries.length - 1;
            } else {
              const idx = assistantIdx;
              liveEntries = liveEntries.map((e, i) =>
                i === idx && e.kind === "assistant" ? { ...e, text: e.text + ev.text } : e,
              );
              sync();
            }
            break;
          case "tool-call":
            pushLive({ kind: "tool", id: ev.id, name: ev.name, input: ev.input, status: "running" });
            assistantIdx = -1;
            break;
          case "tool-result":
            liveEntries = liveEntries.map((e) =>
              e.kind === "tool" && e.id === ev.id ? { ...e, status: "done", output: asText(ev.output) } : e,
            );
            sync();
            break;
          case "tool-error":
            liveEntries = liveEntries.map((e) =>
              e.kind === "tool" && e.id === ev.id ? { ...e, status: "error", error: ev.error } : e,
            );
            sync();
            break;
          case "finish":
            setUsage(engine.usage);
            break;
          case "error":
            pushLive({ kind: "notice", tone: "error", text: ev.error });
            break;
        }
      }
    } catch (err) {
      pushLive({ kind: "notice", tone: "error", text: err instanceof Error ? err.message : String(err) });
    } finally {
      const finalEntries = liveEntries;
      setLive([]);
      setCommitted((c) => [...c, ...finalEntries]);
      setBusy(false);
      persist();
    }
  }

  function onSubmit(value: string) {
    const text = value.trim();
    setInput("");
    if (!text || busy) return;
    if (text.startsWith("/")) {
      handleCommand(text);
      return;
    }
    void runTurn(text);
  }

  const staticItems: (typeof BANNER | Entry)[] = [BANNER, ...committed];

  return (
    <Box flexDirection="column">
      <Static items={staticItems}>
        {(item, i) =>
          item === BANNER ? (
            <Box key="banner" paddingX={1} paddingTop={1}>
              <Banner model={modelSpec} />
            </Box>
          ) : (
            <Box key={i} paddingX={1}>
              <EntryView entry={item as Entry} />
            </Box>
          )
        }
      </Static>

      <Box flexDirection="column" paddingX={1}>
        {live.map((e, i) => (
          <EntryView key={i} entry={e} />
        ))}

        {busy && (
          <Box marginTop={1}>
            <Text color="cyan">
              <Spinner type="dots" />
            </Text>
            <Text dimColor> working…</Text>
          </Box>
        )}

        <StatusBar modelSpec={modelSpec} cwd={cwd} totalTokens={usage.totalTokens} mode={mode} />

        {pending ? (
          <ApprovalPrompt
            req={pending.req}
            onRespond={(outcome) => {
              pending.resolve(outcome);
              setPending(null);
            }}
          />
        ) : (
          <Box>
            <Text color={busy ? "gray" : "blue"}>{"› "}</Text>
            <TextInput
              value={input}
              onChange={setInput}
              onSubmit={onSubmit}
              placeholder={busy ? "working…" : "type a prompt, or /help"}
            />
          </Box>
        )}
      </Box>
    </Box>
  );
}
