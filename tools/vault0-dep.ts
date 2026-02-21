import { tool } from "@opencode-ai/plugin"
import { runVault0 } from "../lib/vault0-utils"

export default tool({
  description:
    "Manage task dependencies in vault0 — add, remove, or list dependency relationships. " +
    "dep add <A> --on <B> means 'task A depends on task B' (B must complete before A). " +
    "Used by the Architect to establish ordering between subtasks. " +
    "Cycle detection is handled by vault0 automatically.",
  args: {
    action: tool.schema
      .enum(["add", "remove", "list"])
      .describe("Operation: add a dependency, remove one, or list all for a task"),
    id: tool.schema
      .string()
      .describe("Task ID (full ULID or unique suffix match)"),
    on: tool.schema
      .string()
      .optional()
      .describe(
        "Dependency target task ID — required for add/remove, ignored for list. " +
          "For add: 'id' will depend on 'on' (on must complete first)."
      ),
  },
  async execute(args, context): Promise<string> {
    // Validate: 'on' is required for add/remove
    if ((args.action === "add" || args.action === "remove") && !args.on) {
      return JSON.stringify({
        error: `'on' parameter is required for action '${args.action}'`,
      })
    }

    context.metadata({
      title:
        args.action === "list"
          ? `Listing deps for ${args.id}`
          : `Dep ${args.action}: ${args.id} → ${args.on}`,
    })

    // Route based on action
    let cliArgs: string[]
    if (args.action === "add") {
      cliArgs = ["task", "dep", "add", args.id, "--on", args.on as string]
    } else if (args.action === "remove") {
      // vault0 CLI uses "rm" (not "remove") — confirmed via `vault0 task dep --help`
      cliArgs = ["task", "dep", "rm", args.id, "--on", args.on as string]
    } else {
      cliArgs = ["task", "dep", "list", args.id]
    }

    const result = runVault0(cliArgs, context)
    if (!result.success) {
      return JSON.stringify({ error: result.error })
    }
    return JSON.stringify(result.data)
  },
})
