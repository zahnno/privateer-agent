# Privateer — Architecture

Privateer is a terminal coding agent built around one idea: **the model provider is a
swappable detail.** Everything above the provider layer — the agent loop, tools, UI,
permissions — is provider-agnostic, because the [Vercel AI SDK](https://ai-sdk.dev)
normalizes tool-calling and streaming across providers.

```
                 ┌──────────────────────────────────────────┐
   keypresses →  │              Ink TUI (App.tsx)             │  → frames
                 │  Banner · Transcript · ToolCallView ·      │
                 │  StatusBar · ApprovalPrompt · PromptInput  │
                 └───────────────┬───────────────┬────────────┘
                                 │ EngineEvents  │ approvals
                                 ▼               ▲
                 ┌──────────────────────────────────────────┐
                 │            QueryEngine (engine/)           │
                 │  streamText({ tools, stopWhen }) loop      │
                 │  → normalized EngineEvents + usage         │
                 └───────┬───────────────────┬───────────────┘
                         │ model             │ tool.execute()
                         ▼                   ▼
        ┌────────────────────────┐   ┌───────────────────────────┐
        │  providers/ (registry) │   │  tools/ (read/write/edit/  │
        │  provider:model →      │   │  glob/grep/bash)           │
        │  AI SDK LanguageModel  │   │  each gated by permissions │
        └────────────────────────┘   └───────────────────────────┘
```

## The provider layer (`src/providers/`)

The heart of the project. A model is named `provider:model`:

- `openrouter:anthropic/claude-opus-4.8`
- `anthropic:claude-opus-4-8`
- `openai:gpt-5.5`
- `ollama:qwen3-coder`

`resolve.ts` parses the spec (splitting on the **first** `:`, so model ids may contain
`/` and `:`), validates the provider is known and has credentials, then `registry.ts`
builds the matching AI SDK `LanguageModel`. Adding a provider = adding one factory entry.
Construction is offline; the network is only touched when the model actually runs.

## The agent loop (`src/engine/QueryEngine.ts`)

Each user turn calls `streamText({ model, system, messages, tools, stopWhen:
stepCountIs(maxSteps) })`. The AI SDK runs the **multi-step tool loop internally** —
calling our tools' `execute()` and feeding results back — while `QueryEngine` consumes
`result.fullStream` and translates raw stream parts into a small, UI-friendly
`EngineEvent` union (`text`, `tool-call`, `tool-result`, `tool-error`, `finish`,
`error`). Conversation history and token usage live on the engine instance, so follow-up
turns keep context. A quick Q&A and a long autonomous run are the same loop with a
different step budget.

## Tools (`src/tools/`)

Six tools, each a self-contained AI SDK `tool({ description, inputSchema, execute })`:

| Tool | Notes |
|---|---|
| `read` | line-numbered, offset/limit |
| `write` | creates dirs; gated |
| `edit` | exact-string replace, unique-match guard; gated |
| `glob` | pure-Node walk + `picomatch` |
| `grep` | pure-Node regex search |
| `bash` | shell exec with timeout; gated |

`glob`/`grep` are deliberately **pure-Node** (no ripgrep dependency) so Privateer runs
anywhere. Mutating tools call the **permission gate** before acting; because `execute` is
async, an approval is just an `await` the UI resolves.

## Permissions (`src/permissions/`)

`mode.ts` holds the pure policy: given a request + mode + allowlist, return
`allow`/`deny`/`ask`.

| Mode | Behavior |
|---|---|
| `default` | prompt before edits and shell |
| `acceptEdits` | auto-approve edits; still prompt for other shell |
| `bypass` | no prompts |
| `plan` | read-only; mutations denied |

`uiGate.ts` (`ModeGate`) applies the policy, and only when it yields `ask` does it surface
the Ink `ApprovalPrompt` (**y** allow · **a** always · **n** deny). The gate reads the
current mode via a getter, so changing modes never requires rebuilding the session.

## Config & persistence (`src/config/`, `src/memory/`)

`loadConfig()` merges `~/.privateer/config.json` (global) with `./.privateer/config.json`
(project) and falls back to env vars for keys. The data dir is overridable via
`PRIVATEER_HOME`. `memory/store.ts` persists the latest conversation per project
(keyed by a hash of the cwd) so `--continue` can restore history.

## TUI (`src/components/`)

React + [Ink](https://github.com/vadimdemedes/ink). Committed transcript lines render in
`<Static>` (write-once scrollback); the in-flight turn streams live below, followed by the
status bar and either the prompt input or an approval prompt. Model switching rebuilds the
session while carrying history forward.

## Runtime

Node ≥ 20 executed through [`tsx`](https://github.com/privatenumber/tsx) — no build step.
`bin/privateer.mjs` registers the tsx ESM loader and imports `src/main.tsx`, where
Commander parses flags and either renders the TUI or runs the headless `-p` path.

## Testing

`npm test` (Node's built-in test runner via tsx) covers tools, the engine loop (driven by
a hand-rolled `LanguageModelV2` mock — no network), slash commands, permissions, the store,
and a TUI render smoke test. `npm run typecheck` runs `tsc --noEmit`.
