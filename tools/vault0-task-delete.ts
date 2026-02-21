import { tool } from "@opencode-ai/plugin"
import { runVault0 } from "../lib/vault0-utils"

export default tool({
  description:
    "Archive (soft-delete) a vault0 task by ID. " +
    "Cascades to all subtasks — they are also archived. " +
    "The task remains in the database with archivedAt set and can be restored if needed. " +
    "Returns the archived task object.",
  args: {
    id: tool.schema
      .string()
      .describe("Task ID to archive (full ULID or unique suffix match)"),
  },
  async execute(args, context): Promise<string> {
    context.metadata({ title: `Deleting task: ${args.id}` })

    const cliArgs = ["task", "delete", args.id]

    const result = runVault0(cliArgs, context)
    if (!result.success) {
      return JSON.stringify({ error: result.error })
    }
    return JSON.stringify(result.data)
  },
})
