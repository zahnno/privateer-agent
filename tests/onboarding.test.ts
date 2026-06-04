import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { render } from "ink-testing-library";
import { Onboarding, type OnboardingResult } from "../src/components/Onboarding.tsx";

const tick = () => new Promise((r) => setTimeout(r, 80));
const ENTER = "\r";

test("Onboarding lists all providers and collects a masked key", async () => {
  let result: OnboardingResult | null = null;
  const { stdin, lastFrame, unmount } = render(
    React.createElement(Onboarding, { onComplete: (r: OnboardingResult) => (result = r) }),
  );
  await tick();

  // Select step shows every supported provider.
  const frame = lastFrame() ?? "";
  for (const label of ["Anthropic", "OpenAI", "OpenRouter", "Ollama"]) {
    assert.match(frame, new RegExp(label));
  }

  // The cursor starts on the first provider (OpenRouter, per KNOWN_PROVIDERS order).
  // Toggle it on (space) and confirm (enter) — no navigation, so the test is robust
  // to input timing under load.
  stdin.write(" ");
  await tick();
  stdin.write(ENTER);
  await tick();

  // Now on the key step — type a key and submit.
  stdin.write("sk-test-123");
  await tick();
  stdin.write(ENTER);
  await tick();

  assert.ok(result, "onComplete should have been called");
  assert.equal(result!.providers.openrouter?.apiKey, "sk-test-123");
  assert.equal(result!.defaultModel, "openrouter:anthropic/claude-opus-4.8");
  unmount();
});

test("Onboarding masks the key input", async () => {
  const { stdin, lastFrame, unmount } = render(
    React.createElement(Onboarding, { onComplete: () => {} }),
  );
  await tick();
  stdin.write(" "); // select first provider
  await tick();
  stdin.write(ENTER); // confirm → key step
  await tick();
  stdin.write("secret");
  await tick();
  const frame = lastFrame() ?? "";
  assert.doesNotMatch(frame, /secret/, "raw key must not be visible");
  assert.match(frame, /\*{6}/, "key should render as asterisks");
  unmount();
});
