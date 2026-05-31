import React from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import type { ToolEntry } from "./types.ts";

// A one-line summary of a tool's input, picking the most relevant field per tool.
function summarizeInput(name: string, input: unknown): string {
  const o = (input ?? {}) as Record<string, unknown>;
  switch (name) {
    case "read":
    case "write":
    case "edit":
      return String(o.path ?? "");
    case "bash":
      return String(o.command ?? "");
    case "glob":
      return String(o.pattern ?? "");
    case "grep":
      return String(o.pattern ?? "") + (o.glob ? ` (${o.glob})` : "");
    default:
      try {
        return JSON.stringify(o);
      } catch {
        return "";
      }
  }
}

const STATUS_ICON = { running: "", done: "✓", error: "✗" } as const;
const STATUS_COLOR = { running: "cyan", done: "green", error: "red" } as const;

// Show the first few lines of tool output so the transcript stays compact.
function previewOutput(text: string, maxLines = 6): { lines: string[]; more: number } {
  const all = text.replace(/\n+$/, "").split("\n");
  return { lines: all.slice(0, maxLines), more: Math.max(0, all.length - maxLines) };
}

export function ToolCallView({ entry }: { entry: ToolEntry }) {
  const summary = summarizeInput(entry.name, entry.input);
  const body = entry.status === "error" ? entry.error ?? "" : entry.output ?? "";
  const { lines, more } = previewOutput(body);

  return (
    <Box flexDirection="column" marginTop={1}>
      <Box gap={1}>
        {entry.status === "running" ? (
          <Text color="cyan">
            <Spinner type="dots" />
          </Text>
        ) : (
          <Text color={STATUS_COLOR[entry.status]}>{STATUS_ICON[entry.status]}</Text>
        )}
        <Text bold color="magenta">
          {entry.name}
        </Text>
        <Text dimColor>{summary}</Text>
      </Box>
      {entry.status !== "running" && body.trim() !== "" && (
        <Box flexDirection="column" marginLeft={2}>
          {lines.map((l, i) => (
            <Text key={i} color={entry.status === "error" ? "red" : undefined} dimColor={entry.status !== "error"}>
              {l}
            </Text>
          ))}
          {more > 0 && <Text dimColor>… (+{more} more lines)</Text>}
        </Box>
      )}
    </Box>
  );
}
