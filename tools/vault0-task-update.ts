import { tool } from "@opencode-ai/plugin"
import { runVault0 } from "../lib/vault0-utils"

export default tool({
  description:
    "Update a task's fields or status in vault0. " +
    "Combines task edit, move, and complete into one tool. " +
    "Use status to move a task through workflow stages, and other fields to edit metadata. " +
    "At least one optional field must be provided.",
  args: {
    id: tool.schema
      .string()
      .describe("Task ID (full ULID or unique suffix match)"),
    title: tool.schema
      .string()
      .optional()
      .describe("New task title"),
    description: tool.schema
      .string()
      .optional()
      .describe("New task description"),
    priority: tool.schema
      .enum(["critical", "high", "normal", "low"])
      .optional()
      .describe("New priority level"),
    status: tool.schema
      .enum(["backlog", "todo", "in_progress", "in_review", "done", "cancelled"])
      .optional()
      .describe("New status (triggers task move; 'done' uses task complete shorthand)"),
    tags: tool.schema
      .string()
      .optional()
      .describe("New tags (comma-separated, replaces all existing tags)"),
  },
  async execute(args, context): Promise<string> {
    const hasStatus = !!args.status
    const hasOtherFields = !!(args.title || args.description || args.priority || args.tags)

    if (!hasStatus && !hasOtherFields) {
      return JSON.stringify({ error: "No fields to update" })
    }

    context.metadata({
      title: hasStatus
        ? `Updating task ${args.id} → ${args.status}`
        : `Editing task ${args.id}`,
    })

    let statusResult: ReturnType<typeof runVault0> | undefined
    let editResult: ReturnType<typeof runVault0> | undefined

    // Step 1: Move/Complete if status is provided
    // Always use `task complete` for done status to ensure complete semantics
    // (e.g., timestamps, hooks) are honored, then edit other fields separately.
    if (hasStatus && args.status) {
      if (args.status === "done") {
        statusResult = runVault0(["task", "complete", args.id], context)
      } else {
        statusResult = runVault0(["task", "move", args.id, "--status", args.status], context)
      }
      if (!statusResult.success) {
        return JSON.stringify({ error: statusResult.error })
      }
    }

    // Step 2: Edit if other fields are provided
    if (hasOtherFields) {
      const editArgs = ["task", "edit", args.id]
      if (args.title) editArgs.push("--title", args.title)
      if (args.description) editArgs.push("--description", args.description)
      if (args.priority) editArgs.push("--priority", args.priority)
      if (args.tags) editArgs.push("--tags", args.tags)

      editResult = runVault0(editArgs, context)
      if (!editResult.success) {
        // If status was already changed successfully, report partial success
        if (statusResult?.success) {
          return JSON.stringify({
            partial: true,
            statusUpdate: { success: true, status: args.status },
            fieldEdit: { success: false, error: editResult.error },
          })
        }
        return JSON.stringify({ error: editResult.error })
      }
    }

    // Return the last successful result's data
    const finalData = editResult?.data ?? statusResult?.data
    return JSON.stringify(finalData)
  },
})
