import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import type { ProviderName, ProviderConfig } from "../config/schema.ts";
import { PROVIDER_LIST, type ProviderMeta } from "../providers/catalog.ts";
import { theme } from "./theme.ts";
import { WELCOME } from "./figures.ts";

export interface OnboardingResult {
  providers: Partial<Record<ProviderName, ProviderConfig>>;
  defaultModel: string;
}

// Step 1 — multi-select the providers to configure. Arrows/jk move, space toggles,
// enter confirms (needs at least one). Mirrors Claude Code's checkbox-list feel.
function SelectStep({
  initial,
  onConfirm,
}: {
  initial: Set<ProviderName>;
  onConfirm: (selected: ProviderMeta[]) => void;
}) {
  const [cursor, setCursor] = useState(0);
  const [selected, setSelected] = useState<Set<ProviderName>>(new Set(initial));

  useInput((input, key) => {
    if (key.upArrow || input === "k") setCursor((c) => (c - 1 + PROVIDER_LIST.length) % PROVIDER_LIST.length);
    else if (key.downArrow || input === "j") setCursor((c) => (c + 1) % PROVIDER_LIST.length);
    else if (input === " ") {
      const name = PROVIDER_LIST[cursor].name;
      setSelected((s) => {
        const next = new Set(s);
        next.has(name) ? next.delete(name) : next.add(name);
        return next;
      });
    } else if (key.return && selected.size > 0) {
      onConfirm(PROVIDER_LIST.filter((p) => selected.has(p.name)));
    }
  });

  return (
    <Box flexDirection="column">
      <Text color={theme.dim}>
        Select the providers you want to use — <Text color={theme.accent}>space</Text> to toggle,{" "}
        <Text color={theme.accent}>enter</Text> to continue.
      </Text>
      <Box flexDirection="column" marginTop={1}>
        {PROVIDER_LIST.map((p, i) => {
          const on = selected.has(p.name);
          const active = i === cursor;
          return (
            <Text key={p.name} color={active ? theme.accent : undefined}>
              {active ? "❯ " : "  "}
              {on ? "◉" : "○"} {p.label.padEnd(16)}
              <Text color={theme.dim}> {p.requiresKey ? `key: ${p.keyHint}` : p.keyHint}</Text>
            </Text>
          );
        })}
      </Box>
      {selected.size === 0 && (
        <Text color={theme.dim}>{"\n"}Select at least one provider to continue.</Text>
      )}
    </Box>
  );
}

// Step 2 — walk the chosen providers one at a time, collecting a masked API key (or a
// base URL for keyless/local providers). Empty key = skip that provider's credential.
function KeyStep({
  providers,
  onDone,
}: {
  providers: ProviderMeta[];
  onDone: (creds: Partial<Record<ProviderName, ProviderConfig>>) => void;
}) {
  const [index, setIndex] = useState(0);
  const [value, setValue] = useState("");
  const [creds, setCreds] = useState<Partial<Record<ProviderName, ProviderConfig>>>({});
  const meta = providers[index];

  function submit(raw: string) {
    const v = raw.trim();
    const entry: ProviderConfig = meta.requiresKey
      ? v
        ? { apiKey: v }
        : {}
      : { baseURL: v || meta.baseURLDefault };
    const nextCreds = { ...creds, [meta.name]: entry };
    setCreds(nextCreds);
    setValue("");
    if (index + 1 < providers.length) setIndex(index + 1);
    else onDone(nextCreds);
  }

  return (
    <Box flexDirection="column">
      <Text color={theme.dim}>
        Step {index + 1} of {providers.length} —{" "}
        <Text color={theme.accent}>{meta.label}</Text>
      </Text>
      <Text color={theme.dim}>
        {meta.requiresKey
          ? `Paste your API key (${meta.keyHint}). Enter to skip.`
          : `Base URL for Ollama. Enter to use the default.`}
      </Text>
      <Box marginTop={1} borderStyle="round" borderColor={theme.accent} paddingX={1}>
        <Text color={theme.accent}>{"> "}</Text>
        <TextInput
          value={value}
          onChange={setValue}
          onSubmit={submit}
          mask={meta.requiresKey ? "*" : undefined}
          placeholder={meta.requiresKey ? "sk-…" : meta.baseURLDefault}
        />
      </Box>
    </Box>
  );
}

export function Onboarding({
  initialSelected = [],
  onComplete,
}: {
  initialSelected?: ProviderName[];
  onComplete: (result: OnboardingResult) => void;
}) {
  const [chosen, setChosen] = useState<ProviderMeta[] | null>(null);

  return (
    <Box flexDirection="column" paddingX={1} paddingTop={1}>
      <Text bold color={theme.accent}>
        {WELCOME} Welcome to Privateer — let's set up your providers
      </Text>
      <Text color={theme.dim}>Bring your own keys. They're saved to ~/.privateer/config.json.</Text>
      <Box marginTop={1}>
        {chosen === null ? (
          <SelectStep initial={new Set(initialSelected)} onConfirm={setChosen} />
        ) : (
          <KeyStep
            providers={chosen}
            onDone={(creds) =>
              onComplete({ providers: creds, defaultModel: chosen[0].defaultModel })
            }
          />
        )}
      </Box>
    </Box>
  );
}
