import { tool } from "@opencode-ai/plugin"

export default tool({
  description:
    "Report progress during task execution. Updates the TUI title in real-time.",
  args: {
    message: tool.schema.string().describe("Progress message to display"),
  },
  async execute(args, context) {
    context.metadata({ title: args.message })
    return `✓ ${args.message}`
  },
})
