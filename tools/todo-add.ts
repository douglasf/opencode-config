import { tool } from "@opencode-ai/plugin"
import { readFileSync, writeFileSync, existsSync } from "fs"
import { join } from "path"

// --- Types ---

interface TodoStructure {
  pendingStart: number
  completedStart: number
  subsections: {
    name: string
    start: number
    end: number
  }[]
  totalLines: number
}

interface AddResult {
  success: boolean
  id?: string
  line?: number
  section?: string
  subsection?: string | null
  entry?: string
  error?: string
}

// --- Helpers ---

function parseTodoStructure(lines: string[]): TodoStructure {
  let pendingStart = -1
  let completedStart = -1
  const subsections: TodoStructure["subsections"] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (line === "## Pending") pendingStart = i
    else if (line === "## Completed") completedStart = i
    else if (
      line.startsWith("### ") &&
      pendingStart !== -1 &&
      (completedStart === -1 || i < completedStart)
    ) {
      subsections.push({
        name: line.replace("### ", ""),
        start: i,
        end: i,
      })
    }
  }

  // Calculate subsection ends (last non-empty line before next ### or ##)
  for (let s = 0; s < subsections.length; s++) {
    const nextBoundary =
      s + 1 < subsections.length
        ? subsections[s + 1].start
        : completedStart !== -1
          ? completedStart
          : lines.length

    let lastContentLine = subsections[s].start
    for (let i = subsections[s].start + 1; i < nextBoundary; i++) {
      if (lines[i].trim().startsWith("- [")) {
        lastContentLine = i
      }
    }
    subsections[s].end = lastContentLine
  }

  return { pendingStart, completedStart, subsections, totalLines: lines.length }
}

function generateNextId(lines: string[]): string {
  let maxNum = 0
  const idPattern = /\*\*([A-Z]+)(\d+):/
  for (const line of lines) {
    const match = line.match(idPattern)
    if (match) {
      const num = Number.parseInt(match[2], 10)
      if (num > maxNum) maxNum = num
    }
  }
  return `F${maxNum + 1}`
}

function findInsertionPoint(
  structure: TodoStructure,
  section: string,
  priority: string,
  lines: string[]
): { line: number; subsection: string | null } {
  if (section === "Completed") {
    if (structure.completedStart === -1) {
      return { line: structure.totalLines, subsection: null }
    }
    let insertAt = structure.completedStart + 1
    for (let i = structure.completedStart + 1; i < lines.length; i++) {
      if (lines[i].trim().startsWith("- [")) insertAt = i + 1
      if (lines[i].trim().startsWith("## ") && i > structure.completedStart)
        break
    }
    return { line: insertAt, subsection: null }
  }

  // Pending section — map priority to subsection name
  const subsectionMap: Record<string, string> = {
    critical: "Critical Fixes",
    important: "Important Fixes",
    normal: "Important Fixes",
  }
  const targetName = subsectionMap[priority] || "Important Fixes"
  const target = structure.subsections.find((s) => s.name === targetName)

  if (target) {
    return { line: target.end + 1, subsection: target.name }
  }

  // No matching subsection — insert before ## Completed
  if (structure.completedStart !== -1) {
    return { line: structure.completedStart, subsection: null }
  }

  // Fallback — end of file
  return { line: structure.totalLines, subsection: null }
}

// --- Tool definition ---

export default tool({
  description:
    "Add a new entry to TODO.md with proper formatting. " +
    "Handles section placement, ID generation, and format validation. " +
    "Use this to add TODO items — it ensures consistent formatting.",
  args: {
    title: tool.schema
      .string()
      .describe(
        "Entry title, concise and descriptive (e.g., 'Fix auth token refresh')"
      ),
    section: tool.schema
      .enum(["Pending", "Completed"])
      .describe("Target section in TODO.md"),
    priority: tool.schema
      .enum(["critical", "important", "normal"])
      .describe(
        "Priority level — determines subsection placement under Pending. " +
          "'critical' → Critical Fixes, 'important'/'normal' → Important Fixes"
      ),
    details: tool.schema
      .string()
      .optional()
      .describe("Description text placed after the em-dash separator"),
    id: tool.schema
      .string()
      .optional()
      .describe(
        "Entry ID prefix (e.g., 'F8'). Auto-generated from highest existing ID if omitted."
      ),
  },
  async execute(args, context): Promise<string> {
    const todoPath = join(context.directory, "TODO.md")

    if (!existsSync(todoPath)) {
      return JSON.stringify({
        success: false,
        error: `TODO.md not found at ${todoPath}`,
      } satisfies AddResult)
    }

    context.metadata({ title: `Adding TODO: ${args.title}` })

    const content = readFileSync(todoPath, "utf-8")
    const lines = content.split("\n")
    const structure = parseTodoStructure(lines)

    if (structure.pendingStart === -1) {
      return JSON.stringify({
        success: false,
        error: "TODO.md missing '## Pending' section",
      } satisfies AddResult)
    }

    const entryId = args.id || generateNextId(lines)
    const checkbox = args.section === "Completed" ? "[x]" : "[ ]"
    const description = args.details ? ` — ${args.details}` : ""
    const entry = `- ${checkbox} **${entryId}: ${args.title}**${description}`

    const { line: insertAt, subsection } = findInsertionPoint(
      structure,
      args.section,
      args.priority,
      lines
    )

    // Insert with blank line before if previous line has content
    const needsBlankBefore =
      insertAt > 0 && lines[insertAt - 1]?.trim() !== ""
    const toInsert = needsBlankBefore ? ["", entry] : [entry]
    lines.splice(insertAt, 0, ...toInsert)

    writeFileSync(todoPath, lines.join("\n"))

    return JSON.stringify({
      success: true,
      id: entryId,
      line: insertAt + (needsBlankBefore ? 2 : 1),
      section: args.section,
      subsection: subsection,
      entry: entry,
    } satisfies AddResult)
  },
})
