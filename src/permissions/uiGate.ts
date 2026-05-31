import type { PermissionMode } from "../config/schema.ts";
import type { PermissionGate, PermissionRequest, PermissionDecision } from "./gate.ts";
import { decideAuto } from "./mode.ts";

// What the interactive prompt can return. "always" means allow now and remember:
// for bash, add the command to the session allowlist; for edits, switch to acceptEdits.
export type AskOutcome = "allow" | "deny" | "always";
export type Asker = (req: PermissionRequest) => Promise<AskOutcome>;

export interface ModeGateDeps {
  getMode: () => PermissionMode;
  setMode: (mode: PermissionMode) => void;
  allowlist: string[]; // session-scoped, mutated in place on "always"
  ask: Asker;
}

// The permission gate used by the live TUI. It first applies the mode/allowlist
// policy; only when that yields "ask" does it surface an interactive prompt, and it
// applies "always" outcomes so subsequent similar actions don't re-prompt.
export class ModeGate implements PermissionGate {
  constructor(private readonly deps: ModeGateDeps) {}

  async request(req: PermissionRequest): Promise<PermissionDecision> {
    const auto = decideAuto(req, this.deps.getMode(), this.deps.allowlist);
    if (auto !== "ask") return auto;

    const outcome = await this.deps.ask(req);
    if (outcome === "deny") return "deny";
    if (outcome === "always") {
      if (req.kind === "bash") {
        if (!this.deps.allowlist.includes(req.detail)) this.deps.allowlist.push(req.detail);
      } else {
        this.deps.setMode("acceptEdits");
      }
    }
    return "allow";
  }
}
