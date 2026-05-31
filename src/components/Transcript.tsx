import React from "react";
import { Box, Text } from "ink";
import type { Entry } from "./types.ts";
import { ToolCallView } from "./ToolCallView.tsx";

export function EntryView({ entry }: { entry: Entry }) {
  switch (entry.kind) {
    case "user":
      return (
        <Box marginTop={1}>
          <Text color="blue">{"› "}</Text>
          <Text>{entry.text}</Text>
        </Box>
      );
    case "assistant":
      return (
        <Box marginTop={1}>
          <Text>{entry.text}</Text>
        </Box>
      );
    case "tool":
      return <ToolCallView entry={entry} />;
    case "notice":
      return (
        <Box marginTop={1} flexDirection="column">
          {entry.text.split("\n").map((l, i) => (
            <Text key={i} color={entry.tone === "error" ? "red" : "cyan"} dimColor={entry.tone !== "error"}>
              {l}
            </Text>
          ))}
        </Box>
      );
  }
}

// Render a list of finalized entries (used inside Ink's <Static> for the committed
// transcript) — kept as a plain map so the same EntryView powers live rendering too.
export function Transcript({ entries }: { entries: Entry[] }) {
  return (
    <Box flexDirection="column">
      {entries.map((e, i) => (
        <EntryView key={i} entry={e} />
      ))}
    </Box>
  );
}
