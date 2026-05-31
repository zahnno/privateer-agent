import React from "react";
import { Box, Text } from "ink";
import { VERSION } from "../version.ts";

// Anchor-with-a-padlock-on-top motif rendered in ASCII — the Privateer mark.
// (Padlock shackle + body with keyhole, then the anchor shank, stock, and arms.)
const ANCHOR = [
  "    _____    ",
  "   /     \\   ",
  "  | .---. |  ",
  "  | | o | |  ",
  "  | '---' |  ",
  "  '---+---'  ",
  "  ----+----  ",
  "   \\  |  /   ",
  "    \\_|_/    ",
  "    '-.-'    ",
];

export function Banner({ model }: { model: string }) {
  return (
    <Box flexDirection="row" gap={2} marginBottom={1}>
      <Box flexDirection="column">
        {ANCHOR.map((line, i) => (
          <Text key={i} color="cyan">
            {line}
          </Text>
        ))}
      </Box>
      <Box flexDirection="column" justifyContent="center">
        <Text bold color="cyan">
          PRIVATEER
        </Text>
        <Text dimColor>v{VERSION} · bring your own model</Text>
        <Text> </Text>
        <Text>
          model <Text color="green">{model}</Text>
        </Text>
        <Text dimColor>type a prompt · /help for commands</Text>
      </Box>
    </Box>
  );
}
