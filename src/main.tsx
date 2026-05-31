import React from "react";
import { render } from "ink";
import { Command } from "commander";
import { App } from "./components/App.tsx";
import { NAME, VERSION, DESCRIPTION } from "./version.ts";
import { loadConfig } from "./config/load.ts";
import { createSession } from "./session.ts";
import { loadLatest } from "./memory/store.ts";

interface CliOptions {
  print?: boolean;
  model?: string;
  cwd?: string;
  dangerouslySkipPermissions?: boolean;
  continue?: boolean;
}

const DEFAULT_MODEL = "anthropic:claude-opus-4-8";

async function main() {
  const program = new Command();

  program
    .name(NAME)
    .description(DESCRIPTION)
    .version(VERSION, "-v, --version")
    .argument("[prompt...]", "prompt to send (with -p, runs headless)")
    .option("-p, --print", "print mode: run headless and write the answer to stdout")
    .option("-m, --model <provider:model>", "model to use, e.g. openrouter:anthropic/claude-opus-4.8")
    .option("-C, --cwd <dir>", "working directory")
    .option("--dangerously-skip-permissions", "auto-approve all tool actions (bypass mode)")
    .option("-c, --continue", "resume the most recent session in this directory")
    .action(async (promptParts: string[], options: CliOptions) => {
      try {
        if (options.cwd) process.chdir(options.cwd);
        const config = loadConfig();
        if (options.dangerouslySkipPermissions) config.permissionMode = "bypass";
        const resume = options.continue ? loadLatest(process.cwd()) : null;
        const modelSpec = options.model ?? resume?.modelSpec ?? config.defaultModel ?? DEFAULT_MODEL;

        if (options.print) {
          await runPrint(modelSpec, promptParts.join(" ").trim());
          return;
        }

        // Interactive TUI.
        const { waitUntilExit } = render(
          <App model={modelSpec} config={config} cwd={process.cwd()} resume={resume} />,
        );
        await waitUntilExit();
      } catch (err) {
        // Configuration/resolution errors are expected and user-facing — print them
        // cleanly without a stack trace.
        process.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
        process.exitCode = 1;
      }
    });

  await program.parseAsync(process.argv);
}

// Headless one-shot: stream the answer to stdout, surfacing tool activity on stderr.
async function runPrint(modelSpec: string, prompt: string) {
  if (!prompt) {
    process.stderr.write("No prompt provided.\n");
    process.exitCode = 1;
    return;
  }
  const session = createSession({ config: loadConfig(), modelSpec, cwd: process.cwd() });
  for await (const ev of session.engine.send(prompt)) {
    switch (ev.type) {
      case "text":
        process.stdout.write(ev.text);
        break;
      case "tool-call":
        process.stderr.write(`\n· ${ev.name} ${JSON.stringify(ev.input)}\n`);
        break;
      case "tool-error":
        process.stderr.write(`\n! ${ev.name}: ${ev.error}\n`);
        break;
      case "error":
        process.stderr.write(`\nError: ${ev.error}\n`);
        process.exitCode = 1;
        break;
      case "finish":
        process.stdout.write(
          `\n\n[${modelSpec} · ${ev.usage.totalTokens} tokens · ${ev.finishReason}]\n`,
        );
        break;
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
