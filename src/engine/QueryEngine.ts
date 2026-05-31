import { streamText, stepCountIs, type ModelMessage, type ToolSet, type LanguageModel } from "ai";
import { type EngineEvent, type UsageTotals, emptyUsage, addUsage } from "./events.ts";

export interface QueryEngineOptions {
  model: LanguageModel;
  system: string;
  tools: ToolSet;
  maxSteps: number;
}

// The agent loop. Each `send` streams one user turn through the model, letting the
// AI SDK run the multi-step tool loop internally (executing our tools' execute()),
// while we translate the raw stream into normalized EngineEvents and accumulate usage.
// History persists on the instance so follow-up turns keep context.
export class QueryEngine {
  readonly messages: ModelMessage[] = [];
  usage: UsageTotals = emptyUsage();

  constructor(private readonly opts: QueryEngineOptions) {}

  async *send(userText: string): AsyncGenerator<EngineEvent, void, void> {
    this.messages.push({ role: "user", content: userText });

    let result;
    try {
      result = streamText({
        model: this.opts.model,
        system: this.opts.system,
        messages: this.messages,
        tools: this.opts.tools,
        stopWhen: stepCountIs(this.opts.maxSteps),
      });
    } catch (err) {
      yield { type: "error", error: errMsg(err) };
      return;
    }

    try {
      for await (const part of result.fullStream) {
        switch (part.type) {
          case "text-delta":
            if (part.text) yield { type: "text", text: part.text };
            break;
          case "reasoning-delta":
            if (part.text) yield { type: "reasoning", text: part.text };
            break;
          case "tool-call":
            yield { type: "tool-call", id: part.toolCallId, name: part.toolName, input: part.input };
            break;
          case "tool-result":
            yield {
              type: "tool-result",
              id: part.toolCallId,
              name: part.toolName,
              output: (part as { output: unknown }).output,
            };
            break;
          case "tool-error":
            yield {
              type: "tool-error",
              id: part.toolCallId,
              name: part.toolName,
              error: errMsg((part as { error: unknown }).error),
            };
            break;
          case "finish-step":
            yield { type: "step-finish" };
            break;
          case "error":
            yield { type: "error", error: errMsg(part.error) };
            break;
        }
      }
    } catch (err) {
      yield { type: "error", error: errMsg(err) };
      return;
    }

    // Persist the model's response (assistant + tool messages) for the next turn.
    const response = await result.response;
    this.messages.push(...response.messages);

    const turnUsage = await result.totalUsage;
    const usage: UsageTotals = {
      inputTokens: turnUsage.inputTokens ?? 0,
      outputTokens: turnUsage.outputTokens ?? 0,
      totalTokens: turnUsage.totalTokens ?? 0,
    };
    this.usage = addUsage(this.usage, usage);

    yield { type: "finish", usage, finishReason: await result.finishReason };
  }
}

function errMsg(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}
