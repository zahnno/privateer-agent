import React from "react";
import { Box, Text } from "ink";
import { basename } from "node:path";
import type { PermissionMode } from "../config/schema.ts";

const MODE_COLOR: Record<PermissionMode, string> = {
  default: "yellow",
  acceptEdits: "green",
  bypass: "red",
  plan: "blue",
};

export function StatusBar(props: {
  modelSpec: string;
  cwd: string;
  totalTokens: number;
  mode: PermissionMode;
}) {
  return (
    <Box marginTop={1} gap={1}>
      <Text backgroundColor="cyan" color="black">
        {" "}
        ⚓ privateer{" "}
      </Text>
      <Text color="green">{props.modelSpec}</Text>
      <Text dimColor>· {basename(props.cwd) || props.cwd}</Text>
      <Text color={MODE_COLOR[props.mode]}>· {props.mode}</Text>
      <Text dimColor>· {props.totalTokens} tok</Text>
    </Box>
  );
}
