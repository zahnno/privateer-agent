import type { ToolSet } from "ai";
import type { ToolContext } from "./context.ts";
import { readTool } from "./read.ts";
import { writeTool } from "./write.ts";
import { editTool } from "./edit.ts";
import { globTool } from "./glob.ts";
import { grepTool } from "./grep.ts";
import { bashTool } from "./bash.ts";

export type { ToolContext } from "./context.ts";

// Build the full toolset bound to a session context (cwd + permission gate).
export function createTools(ctx: ToolContext): ToolSet {
  return {
    read: readTool(ctx),
    write: writeTool(ctx),
    edit: editTool(ctx),
    glob: globTool(ctx),
    grep: grepTool(ctx),
    bash: bashTool(ctx),
  };
}
