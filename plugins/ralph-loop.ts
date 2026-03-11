import type { Plugin, PluginInput } from "@opencode-ai/plugin"
import type { Message, Part } from "@opencode-ai/sdk"

// ─── Module-level Logger ────────────────────────────────────────────────────
// Set during plugin init; before that, logs are silently dropped.
let _log: (msg: string) => void = () => {}

// ─── Types ───────────────────────────────────────────────────────────────────

interface RalphLoopConfig {
  maxIterations: number
  completionTag: string
  verificationTag: string
  cooldownMs: number
  dedupWindowMs: number
  idleConfirmationDelayMs: number
  strategy: "continue" | "reset"
}

interface RalphDiagnostics {
  attemptedIdleContinuation: boolean
  idleTimerScheduled: boolean
  idleTimerFired: boolean
  donePromiseDetected: boolean
}

interface RalphState {
  active: boolean
  taskId: string | null         // The work task ID (never modified by Ralph)
  ralphTaskId: string | null    // The Ralph Loop tracking task ID (state stored here)
  sessionId: string | null
  iteration: number
  maxIterations: number
  strategy: "continue" | "reset"
  phase: "plan" | "monolithic" | "verification" | "idle" | "cancelled"
  lastEventTimestamp: number
  hasSubtasks: boolean
  pendingDelegations: number
  inFlight: boolean
  consecutiveFailures: number
  lastFailureAt: number
  lastEventType?: string
  lastPhaseTransition?: string
  diagnostics?: RalphDiagnostics
}

interface IdleGuardState {
  recentSyntheticIdles: Map<string, number>
  recentRealIdles: Map<string, number>
  pendingTimers: Map<string, Timer>
  activityDetected: Map<string, boolean>
}

interface SubtaskInfo {
  id: string
  title: string
  description: string
  status: string
  priority: string
}

interface PlanAnalysis {
  hasSubtasks: boolean
  totalSubtasks: number
  readySubtasks: SubtaskInfo[]
  blockedSubtasks: SubtaskInfo[]
  completedSubtasks: SubtaskInfo[]
}

// ─── Constants ───────────────────────────────────────────────────────────────

const RALPH_DEFAULTS: RalphLoopConfig = {
  maxIterations: 100,
  completionTag: "<promise>DONE</promise>",
  verificationTag: "<promise>VERIFIED</promise>",
  cooldownMs: 2000,
  dedupWindowMs: 500,
  idleConfirmationDelayMs: 1500,
  strategy: "continue",
}

const MAX_CONSECUTIVE_FAILURES = 5
const CONTINUATION_COOLDOWN_MS = 5_000
const FAILURE_RESET_WINDOW_MS = 5 * 60_000
const RALPH_TAG_PREFIX = "ralph-loop"
const RALPH_TASK_TITLE_PREFIX = "[RALPH]"

// ─── State Singletons ───────────────────────────────────────────────────────

function createDefaultDiagnostics(): RalphDiagnostics {
  return {
    attemptedIdleContinuation: false,
    idleTimerScheduled: false,
    idleTimerFired: false,
    donePromiseDetected: false,
  }
}

function createDefaultState(): RalphState {
  return {
    active: false,
    taskId: null,
    ralphTaskId: null,
    sessionId: null,
    iteration: 0,
    maxIterations: RALPH_DEFAULTS.maxIterations,
    strategy: RALPH_DEFAULTS.strategy,
    phase: "idle",
    lastEventTimestamp: 0,
    hasSubtasks: false,
    pendingDelegations: 0,
    inFlight: false,
    consecutiveFailures: 0,
    lastFailureAt: 0,
    diagnostics: createDefaultDiagnostics(),
  }
}

let state: RalphState = createDefaultState()

const idleGuard: IdleGuardState = {
  recentSyntheticIdles: new Map(),
  recentRealIdles: new Map(),
  pendingTimers: new Map(),
  activityDetected: new Map(),
}

function getState(): RalphState {
  return state
}

/** Ensure diagnostics object exists on state, return it. */
function ensureDiagnostics(s: RalphState): RalphDiagnostics {
  if (!s.diagnostics) s.diagnostics = createDefaultDiagnostics()
  return s.diagnostics
}

/** Fire-and-forget sync of current state to vault0 (for diagnostics). */
function syncDiagnostics(s: RalphState): void {
  const targetId = s.ralphTaskId
  if (!targetId) return
  syncStateTovault0(targetId, s).catch(() => {})
}

function getIdleGuard(): IdleGuardState {
  return idleGuard
}

function resetState(): void {
  state = createDefaultState()
}

function isActive(): boolean {
  return state.active
}

function isOwnSession(sessionId: string): boolean {
  return state.active && state.sessionId === sessionId
}

// ─── vault0 CLI Exec Helper ─────────────────────────────────────────────────

async function vault0Exec(args: string[]): Promise<any> {
  if (typeof Bun !== 'undefined') {
    const proc = Bun.spawn(["vault0", ...args, "--format", "json"], {
      stdout: "pipe",
      stderr: "pipe",
    })
    const output = await new Response(proc.stdout).text()
    const exitCode = await proc.exited
    if (exitCode !== 0) {
      const stderr = await new Response(proc.stderr).text()
      throw new Error(
        `vault0 ${args.join(" ")} failed (exit ${exitCode}): ${stderr}`
      )
    }
    return JSON.parse(output)
  } else {
    const { execFileSync } = require('node:child_process');
    const output = execFileSync("vault0", [...args, "--format", "json"], { encoding: 'utf-8' });
    return JSON.parse(output);
  }
}

// ─── Utility Types ───────────────────────────────────────────────────────────

type OpencodeClient = PluginInput["client"]

// ─── Completion Promise Detector ───────────────────────────────────────────

interface DetectionResult {
  found: boolean
  messageId?: string
}

/**
 * Scans the most recent assistant message in a session for a completion tag.
 * Only inspects the latest assistant message — older messages are ignored.
 *
 * Edge cases handled:
 * - Empty sessions (no messages) → { found: false }
 * - Tags in user messages → ignored (only assistant messages scanned)
 * - Multiple text parts → all scanned via concatenation
 */
async function detectCompletionPromise(
  client: OpencodeClient,
  sessionId: string,
  tag: string
): Promise<DetectionResult> {
  const result = await client.session.messages({
    path: { id: sessionId },
  })

  if (!result.data || result.data.length === 0) {
    return { found: false }
  }

  const messages = result.data as Array<{ info: Message; parts: Part[] }>

  // Walk backwards to find the most recent assistant message
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]
    if (msg.info.role !== "assistant") continue

    // Concatenate all text parts and check for the tag
    const allText = msg.parts
      .filter((p): p is Extract<Part, { type: "text" }> => p.type === "text")
      .map((p) => p.text ?? "")
      .join("")

    if (allText.includes(tag)) {
      return { found: true, messageId: msg.info.id }
    }

    // Only check the most recent assistant message
    break
  }

  return { found: false }
}

/**
 * Detects `<promise>DONE</promise>` in the latest assistant message.
 */
async function detectDonePromise(
  client: OpencodeClient,
  sessionId: string
): Promise<DetectionResult> {
  return detectCompletionPromise(client, sessionId, RALPH_DEFAULTS.completionTag)
}

/**
 * Detects `<promise>VERIFIED</promise>` in the latest assistant message.
 */
async function detectVerifiedPromise(
  client: OpencodeClient,
  sessionId: string
): Promise<DetectionResult> {
  return detectCompletionPromise(
    client,
    sessionId,
    RALPH_DEFAULTS.verificationTag
  )
}

// Export for testing

// ─── vault0 CLI Convenience Wrappers ────────────────────────────────────────

async function vault0TaskView(id: string): Promise<any> {
  return vault0Exec(["task", "view", id])
}

async function vault0TaskMove(
  id: string,
  status: string,
): Promise<void> {
  await vault0Exec(["task", "move", id, "--status", status])
}

async function vault0TaskUpdate(
  id: string,
  opts: { description?: string; solution?: string; tags?: string },
): Promise<void> {
  const args = ["task", "edit", id]
  if (opts.description) args.push("--description", opts.description)
  if (opts.solution) args.push("--solution", opts.solution)
  if (opts.tags) args.push("--tags", opts.tags)
  await vault0Exec(args)
}

async function vault0TaskList(filters: {
  status?: string
  search?: string
  tag?: string
}): Promise<any[]> {
  const args = ["task", "list"]
  if (filters.status) args.push("--status", filters.status)
  if (filters.search) args.push("--search", filters.search)
  if (filters.tag) args.push("--tags", filters.tag)
  return vault0Exec(args)
}

async function vault0TaskSubtasks(
  id: string,
  ready?: boolean,
): Promise<any[]> {
  const args = ["task", "subtasks", id]
  if (ready) args.push("--ready")
  return vault0Exec(args)
}

async function vault0TaskCreate(opts: {
  title: string
  description: string
  tags?: string
  status?: string
}): Promise<{ id: string }> {
  const args = ["task", "add", "--title", opts.title, "--description", opts.description]
  if (opts.tags) args.push("--tags", opts.tags)
  if (opts.status) args.push("--status", opts.status)
  return vault0Exec(args)
}

// ─── State Parser & Serializer ──────────────────────────────────────────────

const STATE_BLOCK_RE = /<!--\s*RALPH_STATE\n([\s\S]*?)-->/

/**
 * Extract Ralph state from an HTML comment block in a task description.
 * Returns Partial<RalphState> — tolerant of missing fields.
 */
function parseRalphState(
  description: string,
): Partial<RalphState> {
  const match = description.match(STATE_BLOCK_RE)
  if (!match) return {}

  const result: Record<string, unknown> = {}
  const diag: Record<string, boolean> = {}
  for (const line of match[1].split("\n")) {
    const idx = line.indexOf(":")
    if (idx === -1) continue
    const key = line.slice(0, idx).trim()
    const raw = line.slice(idx + 1).trim()
    if (!key || !raw) continue

    // Parse diag.* keys into diagnostics object
    if (key.startsWith("diag.")) {
      diag[key.slice(5)] = raw === "true"
      continue
    }

    if (raw === "true") result[key] = true
    else if (raw === "false") result[key] = false
    else if (raw === "null") result[key] = null
    else if (/^\d+$/.test(raw)) result[key] = Number.parseInt(raw, 10)
    else result[key] = raw
  }
  if (Object.keys(diag).length > 0) {
    result.diagnostics = diag as unknown as RalphDiagnostics
  }
  return result as Partial<RalphState>
}

/**
 * Serialize Ralph state into an HTML comment block.
 */
function serializeRalphState(stateToSerialize: Partial<RalphState>): string {
  const lines: string[] = ["<!-- RALPH_STATE"]
  const orderedKeys: (keyof RalphState)[] = [
    "iteration",
    "maxIterations",
    "strategy",
    "phase",
    "hasSubtasks",
    "sessionId",
    "taskId",
    "ralphTaskId",
    "active",
    "inFlight",
    "consecutiveFailures",
    "lastFailureAt",
    "lastEventTimestamp",
    "pendingDelegations",
    "lastEventType",
    "lastPhaseTransition",
  ]
  for (const key of orderedKeys) {
    if (key in stateToSerialize && stateToSerialize[key] !== undefined) {
      lines.push(`${key}: ${stateToSerialize[key]}`)
    }
  }
  // Serialize diagnostics as individual prefixed keys
  if (stateToSerialize.diagnostics) {
    const d = stateToSerialize.diagnostics
    lines.push(`diag.attemptedIdleContinuation: ${d.attemptedIdleContinuation}`)
    lines.push(`diag.idleTimerScheduled: ${d.idleTimerScheduled}`)
    lines.push(`diag.idleTimerFired: ${d.idleTimerFired}`)
    lines.push(`diag.donePromiseDetected: ${d.donePromiseDetected}`)
  }
  lines.push("-->")
  return lines.join("\n")
}

/**
 * Append an iteration entry to the iteration history section.
 */
function appendIterationLog(
  description: string,
  iteration: number,
  phase: string,
  summary: string,
): string {
  const header = "## Iteration History"
  const entry = `### Iteration ${iteration} (${phase})\n- ${summary}`

  if (description.includes(header)) {
    return `${description}\n${entry}`
  }
  return `${description}\n\n${header}\n${entry}`
}

/**
 * Create an initial description with Ralph state block prepended.
 */
function buildInitialDescription(
  originalDescription: string,
  config: RalphLoopConfig,
): string {
  const initialState: Partial<RalphState> = {
    iteration: 0,
    maxIterations: config.maxIterations,
    strategy: config.strategy,
    phase: "idle",
    hasSubtasks: false,
    sessionId: null,
    active: true,
    inFlight: false,
    consecutiveFailures: 0,
  }
  return `${serializeRalphState(initialState)}\n\n${originalDescription}`
}

/**
 * Update the state block in a description while preserving the rest.
 */
function updateDescriptionState(
  description: string,
  updates: Partial<RalphState>,
): string {
  const existing = parseRalphState(description)
  const merged = { ...existing, ...updates }
  const newBlock = serializeRalphState(merged)

  if (STATE_BLOCK_RE.test(description)) {
    return description.replace(STATE_BLOCK_RE, newBlock)
  }
  return `${newBlock}\n\n${description}`
}

/**
 * Read current description via vault0 CLI, update state block & iteration log,
 * write back via vault0 CLI.
 */
async function syncStateTovault0(
  taskId: string,
  stateToSync: Partial<RalphState>,
  iterationSummary?: string,
): Promise<void> {
  const task = await vault0TaskView(taskId)
  let desc = updateDescriptionState(task.description, stateToSync)
  if (iterationSummary && stateToSync.iteration != null && stateToSync.phase) {
    desc = appendIterationLog(
      desc,
      stateToSync.iteration,
      stateToSync.phase,
      iterationSummary,
    )
  }
  await vault0TaskUpdate(taskId, { description: desc })
}

/**
 * Scan vault0 for tasks tagged ralph-loop that have active (non-idle, non-cancelled) state.
 * Returns the Ralph tracking task ID and the work task ID parsed from its state.
 */
async function findOrphanedRalphTask(): Promise<{
  ralphTaskId: string
  workTaskId: string | null
  state: Partial<RalphState>
} | null> {
  const tasks = await vault0TaskList({ tag: RALPH_TAG_PREFIX })
  for (const task of tasks) {
    const parsed = parseRalphState(task.description ?? "")
    if (
      parsed.phase &&
      parsed.phase !== "idle" &&
      parsed.phase !== "cancelled"
    ) {
      return {
        ralphTaskId: task.id,
        workTaskId: (parsed.taskId as string) ?? null,
        state: parsed,
      }
    }
  }
  return null
}

// ─── Plan Analyzer ──────────────────────────────────────────────────────────

function toSubtaskInfo(raw: any): SubtaskInfo {
  return {
    id: raw.id ?? "",
    title: raw.title ?? "",
    description: raw.description ?? "",
    status: raw.status ?? "unknown",
    priority: raw.priority ?? "normal",
  }
}

const COMPLETED_STATUSES = new Set(["done", "cancelled"])

/**
 * Analyze a vault0 task's subtask structure via CLI.
 * Determines which subtasks are ready, blocked, or completed.
 *
 * Edge cases:
 * - No subtasks → hasSubtasks: false, empty arrays
 * - All complete → readySubtasks empty, hasSubtasks true
 * - Circular deps → vault0 --ready handles safely; if it returns nothing
 *   but non-completed subtasks exist, they land in blocked
 */
async function analyzePlan(taskId: string): Promise<PlanAnalysis> {
  const [allRaw, readyRaw] = await Promise.all([
    vault0TaskSubtasks(taskId),
    vault0TaskSubtasks(taskId, true),
  ])

  const all = Array.isArray(allRaw) ? allRaw : []
  const ready = Array.isArray(readyRaw) ? readyRaw : []

  const readyIds = new Set(ready.map((t: any) => t.id))

  const completed = all.filter((t: any) => COMPLETED_STATUSES.has(t.status))
  const blocked = all.filter(
    (t: any) => !COMPLETED_STATUSES.has(t.status) && !readyIds.has(t.id),
  )

  return {
    hasSubtasks: all.length > 0,
    totalSubtasks: all.length,
    readySubtasks: ready.map(toSubtaskInfo),
    blockedSubtasks: blocked.map(toSubtaskInfo),
    completedSubtasks: completed.map(toSubtaskInfo),
  }
}

/**
 * Convenience wrapper — returns only the ready (actionable) subtasks.
 */
async function getReadySubtasks(taskId: string): Promise<SubtaskInfo[]> {
  const analysis = await analyzePlan(taskId)
  return analysis.readySubtasks
}

// ─── Continuation Prompt Builder ────────────────────────────────────────────

/**
 * Build prompt for iteration 1 when the task has ready subtasks.
 * Instructs the agent to delegate each subtask to Jim in parallel.
 */
function buildInitialPlanPrompt(
  taskDescription: string,
  readySubtasks: SubtaskInfo[],
): string {
  const subtaskList = readySubtasks
    .map((s) => `- **${s.id}**: ${s.title}`)
    .join("\n")

  return [
    "## Task",
    taskDescription,
    "",
    "## Iteration 1 — Plan Phase",
    `This task has ${readySubtasks.length} ready subtask(s). Delegate each to Jim in parallel using the Task tool:`,
    "",
    subtaskList,
    "",
    "For each subtask, call:",
    "```",
    'Task(subagent_type="jim", prompt="Implement vault0 task <ID>. Read the task with vault0_task-view first, then implement. Record your solution with vault0_task-update when done.")',
    "```",
    "",
    "After all delegations complete, summarize the combined results.",
    `When all subtasks are implemented, emit \`${RALPH_DEFAULTS.completionTag}\` to signal completion.`,
  ].join("\n")
}

/**
 * Build prompt for iteration 1 when the task has no subtasks (monolithic).
 */
function buildInitialMonolithicPrompt(
  taskDescription: string,
): string {
  return [
    "## Task",
    taskDescription,
    "",
    "## Iteration 1 — Implementation",
    "Implement this task end-to-end. Read relevant files, make changes, and verify your work compiles/passes tests.",
    "",
    `When the implementation is complete, emit \`${RALPH_DEFAULTS.completionTag}\` to signal you are done.`,
    "If more work remains, describe what's left and stop — the loop will continue.",
  ].join("\n")
}

/**
 * Build prompt for transitioning from plan phase (iteration 1) to monolithic phase (iteration 2+).
 */
function buildTransitionPrompt(
  iteration1Summary: string,
  taskDescription: string,
): string {
  return [
    "## Task",
    taskDescription,
    "",
    "## Transition — Plan → Monolithic Phase",
    "Iteration 1 (plan phase) is complete. Here is what was accomplished:",
    "",
    iteration1Summary,
    "",
    "Now review the entire implementation holistically. Check for:",
    "- Cross-component integration issues",
    "- Missing error handling or edge cases",
    "- Consistency across all changes",
    "- Compilation and test correctness",
    "",
    `Fix any issues found. When everything is production-ready, emit \`${RALPH_DEFAULTS.completionTag}\`.`,
  ].join("\n")
}

/**
 * Build prompt for iterations 2+ (monolithic continuation).
 */
function buildContinuationPrompt(
  iteration: number,
  taskDescription: string,
  priorWorkSummary: string,
): string {
  return [
    "## Task",
    taskDescription,
    "",
    `## Iteration ${iteration} — Continue`,
    "Prior work summary:",
    priorWorkSummary,
    "",
    "Continue refining the implementation. Address any remaining issues, improve quality, and verify correctness.",
    "",
    `When the task is fully complete, emit \`${RALPH_DEFAULTS.completionTag}\`.`,
    `If issues remain, describe progress and stop — the loop will continue with iteration ${iteration + 1}.`,
  ].join("\n")
}

/**
 * Build prompt for Dwight verification phase.
 */
function buildVerificationPrompt(
  taskDescription: string,
  workSummary: string,
): string {
  return [
    "## Verification Required",
    "Delegate to Dwight to verify this implementation before moving to user review.",
    "",
    'Task(subagent_type="dwight", prompt="Review the implementation for this task.',
    "Check all files modified, test coverage, and cross-component integration.",
    "",
    "Task description:",
    taskDescription,
    "",
    "Work completed:",
    workSummary,
    "",
    `If the implementation is complete and production-ready, respond with \`${RALPH_DEFAULTS.verificationTag}\`.`,
    'If issues need fixing, describe them clearly WITHOUT the VERIFIED tag.")',
  ].join("\n")
}

/**
 * Build prompt for user-initiated cancellation.
 */
function buildCancelPrompt(): string {
  return "Ralph loop cancelled by user. The task has been moved to in_review for manual validation. No further autonomous iterations will run."
}

/**
 * Build prompt for when max iterations are reached.
 */
function buildMaxIterationsPrompt(iteration: number): string {
  return `Maximum iterations (${iteration}) reached. Moving to Dwight verification phase. The implementation will be reviewed as-is.`
}

// ─── Dwight Verification Handler ────────────────────────────────────────────

/**
 * Trigger Dwight verification after agent emits DONE.
 * - Reads task context via vault0 CLI
 * - Builds verification prompt via buildVerificationPrompt()
 * - Injects prompt into session via client.session.promptAsync()
 * - Updates state to "verification" phase via syncStateTovault0()
 */
async function triggerVerification(
  client: OpencodeClient,
  loopState: RalphState,
): Promise<void> {
  _log(`RALPH_LOOP: triggerVerification for taskId=${loopState.taskId}`)
  if (!loopState.taskId || !loopState.sessionId) {
    throw new Error("triggerVerification: taskId and sessionId are required")
  }

  // Read WORK task context (not Ralph task) for verification prompt
  const task = await vault0TaskView(loopState.taskId)

  // Build work summary from iteration history
  const workSummary = `Completed ${loopState.iteration} iteration(s). Phase: ${loopState.phase}. Strategy: ${loopState.strategy}.`

  // Build Dwight verification prompt
  const verificationPrompt = buildVerificationPrompt(
    task.description ?? "",
    workSummary,
  )

  // Inject verification prompt into the session
  await client.session.promptAsync({
    path: { id: loopState.sessionId },
    body: {
      parts: [{ type: "text", text: verificationPrompt }],
    },
  })

  // Update state to "verification" phase — sync to RALPH task
  loopState.phase = "verification"
  if (loopState.ralphTaskId) {
    await syncStateTovault0(loopState.ralphTaskId, loopState, "Triggered Dwight verification")
  }
}

/**
 * Check the verification result after Dwight responds.
 * Returns 'verified' if <promise>VERIFIED</promise> found, 'pending' otherwise.
 */
async function handleVerificationResult(
  client: OpencodeClient,
  sessionId: string,
  _loopState: RalphState,
): Promise<"verified" | "pending"> {
  const verified = await detectVerifiedPromise(client, sessionId)

  if (verified.found) {
    return "verified"
  }

  return "pending"
}

/**
 * Move task to in_review after Dwight verification passes.
 * - Moves task via vault0 CLI
 * - Updates solution notes via vault0 CLI
 * - Syncs state back to vault0
 */
async function moveTaskToReview(
  loopState: RalphState,
): Promise<void> {
  if (!loopState.taskId) {
    throw new Error("moveTaskToReview: taskId is required")
  }

  // Move WORK task to in_review
  await vault0TaskMove(loopState.taskId, "in_review")

  // Update work task solution notes (but NOT its description)
  await vault0TaskUpdate(loopState.taskId, {
    solution: `Ralph loop completed. ${loopState.iteration} iterations. Dwight verification: PASSED.`,
  })

  // Update RALPH tracking task solution (but do NOT move it to done — user decides)
  if (loopState.ralphTaskId) {
    await vault0TaskUpdate(loopState.ralphTaskId, {
      solution: `Loop completed. ${loopState.iteration} iterations. Work task ${loopState.taskId} moved to in_review.`,
    })
    loopState.phase = "idle"
    loopState.active = false
    await syncStateTovault0(loopState.ralphTaskId, loopState)
  } else {
    loopState.phase = "idle"
    loopState.active = false
  }
}

// ─── Command Argument Parser ────────────────────────────────────────────────

function parseRalphArgs(args: string): {
  taskIdOrDescription: string
  strategy: "continue" | "reset"
} {
  let strategy: "continue" | "reset" = RALPH_DEFAULTS.strategy
  let rest = args

  // Extract --strategy flag
  const strategyMatch = rest.match(/--strategy\s+(continue|reset)/)
  if (strategyMatch) {
    strategy = strategyMatch[1] as "continue" | "reset"
    rest = rest.replace(strategyMatch[0], "").trim()
  }

  return {
    taskIdOrDescription: rest.trim(),
    strategy,
  }
}

// ─── /ralph Command Handler ─────────────────────────────────────────────────

async function handleRalphStart(
  client: OpencodeClient,
  sessionId: string,
  args: string,
  loopState: RalphState,
): Promise<void> {
  const { taskIdOrDescription, strategy } = parseRalphArgs(args)

  if (loopState.active) {
    await client.tui.showToast({
      body: { message: "Ralph loop already active", variant: "warning" },
    })
    return
  }

  const isExistingTask = /^01[A-Z0-9]{24}/.test(taskIdOrDescription)

  if (isExistingTask) {
    try {
      const task = await vault0TaskView(taskIdOrDescription)
      loopState.taskId = task.id

      // Check if there's an orphaned Ralph tracking task for this work task
      // (pre-populated by crash recovery)
      if (loopState.ralphTaskId) {
        // Resuming from crash recovery — state already loaded
        _log(`RALPH_LOOP: Resuming orphaned Ralph task ${loopState.ralphTaskId}`)
      }

      await vault0TaskMove(task.id, "in_progress")
    } catch (_e) {
      await client.tui.showToast({
        body: {
          message: `Task not found: ${taskIdOrDescription}`,
          variant: "error",
        },
      })
      return
    }
  } else {
    // New task — will be created via the initial prompt
    loopState.taskId = null
  }

  // Initialize state
  loopState.active = true
  loopState.sessionId = sessionId
  loopState.iteration = loopState.iteration || 0
  loopState.strategy = strategy
  loopState.phase = loopState.phase === "idle" ? "idle" : loopState.phase
  loopState.inFlight = false
  loopState.consecutiveFailures = 0
  loopState.diagnostics = createDefaultDiagnostics()

  // Analyze plan structure for existing tasks
  if (loopState.taskId) {
    const analysis = await analyzePlan(loopState.taskId)
    loopState.hasSubtasks = analysis.hasSubtasks
  }

  // Create a NEW Ralph Loop tracking task (if not resuming from crash recovery)
  if (!loopState.ralphTaskId && loopState.taskId) {
    const workTask = await vault0TaskView(loopState.taskId)
    const workTitle = workTask.title ?? "unknown"
    const workTags = workTask.tags ? `${RALPH_TAG_PREFIX},${workTask.tags}` : RALPH_TAG_PREFIX

    const initialState: Partial<RalphState> = {
      iteration: 0,
      maxIterations: RALPH_DEFAULTS.maxIterations,
      strategy,
      phase: "idle",
      hasSubtasks: loopState.hasSubtasks,
      sessionId,
      taskId: loopState.taskId,  // Store work task ID in Ralph state for recovery
      ralphTaskId: null,         // Will be set after creation
      active: true,
      inFlight: false,
      consecutiveFailures: 0,
    }
    const description = `${serializeRalphState(initialState)}\n\nRalph Loop tracking task for work task: ${loopState.taskId}\nWork task title: ${workTitle}`

    const created = await vault0TaskCreate({
      title: `${RALPH_TASK_TITLE_PREFIX} Loop for ${workTitle}`,
      description,
      tags: workTags,
      status: "in_progress",
    })
    loopState.ralphTaskId = created.id
    _log(`RALPH_LOOP: Created Ralph tracking task ${created.id}`)

    // Update the ralph task description with its own ID
    await syncStateTovault0(created.id, { ...initialState, ralphTaskId: created.id })
  }

  await client.tui.showToast({
    body: {
      message: `Ralph loop started (${strategy} strategy)${loopState.ralphTaskId ? ` tracking: ${loopState.ralphTaskId}` : ''}`,
      variant: "info",
    },
  })
}

// ─── /ralph-cancel Command Handler ──────────────────────────────────────────

async function handleRalphCancel(
  client: OpencodeClient,
  _sessionId: string,
  loopState: RalphState,
): Promise<void> {
  if (!loopState.active) {
    await client.tui.showToast({
      body: { message: "No active Ralph loop to cancel", variant: "warning" },
    })
    return
  }

  // Move work task to in_review
  if (loopState.taskId) {
    await vault0TaskMove(loopState.taskId, "in_review")
  }

  // Update Ralph tracking task (do NOT move to done — user decides)
  if (loopState.ralphTaskId) {
    await vault0TaskUpdate(loopState.ralphTaskId, {
      solution: `Ralph loop cancelled by user at iteration ${loopState.iteration}.`,
    })
    await syncStateTovault0(loopState.ralphTaskId, {
      ...loopState,
      phase: "cancelled" as const,
      active: false,
    })
  }

  loopState.phase = "cancelled"
  loopState.active = false
  resetState()

  await client.tui.showToast({
    body: {
      message: "Ralph loop cancelled. Work task moved to in_review.",
      variant: "info",
    },
  })
}

// ─── Event Handler & Loop Orchestration ─────────────────────────────────────

/**
 * Core event handler — applies 6 guard levels before scheduling idle continuation.
 * Handles session.idle (real) and session.status (synthetic idle) events.
 *
 * Guard chain (from oh-my-openagent pattern):
 *   L1: Synthetic idle deduplication (500ms window)
 *   L2: Session ownership filter
 *   L3: Cooldown/debounce (2000ms)
 *   L4: In-flight guard
 *   L5: Circuit breaker (5 failures → stop, exponential backoff)
 *   L6: Idle confirmation delay (1500ms + activity cancellation)
 */
async function handleEvent(
  client: OpencodeClient,
  event: { type: string; properties: Record<string, unknown> },
  loopState: RalphState,
  guards: IdleGuardState,
): Promise<void> {
  let sessionID: string | undefined

  // === GUARD LEVEL 1: Synthetic idle deduplication (500ms) ===
  // OpenCode can emit both session.status{type:"idle"} AND session.idle
  // Track both in maps, drop duplicates within 500ms window
  if (event.type === "session.idle") {
    sessionID = event.properties.sessionID as string
    const syntheticTime = guards.recentSyntheticIdles.get(sessionID)
    if (
      syntheticTime &&
      Date.now() - syntheticTime < RALPH_DEFAULTS.dedupWindowMs
    ) {
      guards.recentSyntheticIdles.delete(sessionID)
      return // Already handled via synthetic idle
    }
    guards.recentRealIdles.set(sessionID, Date.now())
  }

  // Normalize session.status → synthetic idle
  if (event.type === "session.status") {
    const props = event.properties as Record<string, unknown>
    if ((props?.status as Record<string, unknown>)?.type === "idle") {
      sessionID = props.sessionID as string
      const realTime = guards.recentRealIdles.get(sessionID)
      if (
        realTime &&
        Date.now() - realTime < RALPH_DEFAULTS.dedupWindowMs
      ) {
        return // Real idle already handled
      }
      guards.recentSyntheticIdles.set(sessionID, Date.now())
      // Fall through to process as idle
    } else {
      return // Not an idle status event
    }
  }

  if (!sessionID) return

  // === GUARD LEVEL 2: Session ownership filter ===
  if (!loopState.active || loopState.sessionId !== sessionID) {
    return
  }

  // === GUARD LEVEL 3: Cooldown/debounce (2000ms) ===
  const now = Date.now()
  if (now - loopState.lastEventTimestamp < RALPH_DEFAULTS.cooldownMs) {
    return
  }

  // === GUARD LEVEL 4: In-flight guard ===
  if (loopState.inFlight) {
    return
  }

  // === GUARD LEVEL 5: Circuit breaker ===
  if (loopState.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
    _log(`RALPH_LOOP: Circuit breaker triggered after ${MAX_CONSECUTIVE_FAILURES} failures`)
    // Stop loop, move work task to in_review with error note
    if (loopState.taskId) {
      await vault0TaskMove(loopState.taskId, "in_review")
    }
    if (loopState.ralphTaskId) {
      await vault0TaskUpdate(loopState.ralphTaskId, {
        solution: `Ralph loop stopped: circuit breaker triggered after ${MAX_CONSECUTIVE_FAILURES} consecutive failures`,
      })
    }
    resetState()
    return
  }
  // Exponential backoff on retries
  if (loopState.consecutiveFailures > 0) {
    const backoff =
      CONTINUATION_COOLDOWN_MS *
      2 ** (loopState.consecutiveFailures - 1)
    if (now - loopState.lastFailureAt < backoff) return
  }
  // Reset failures after success window (5 min without failure)
  if (
    loopState.consecutiveFailures > 0 &&
    now - loopState.lastFailureAt > FAILURE_RESET_WINDOW_MS
  ) {
    loopState.consecutiveFailures = 0
  }

  // === GUARD LEVEL 6: Idle confirmation delay (1500ms) ===
  // Schedule the actual work after a delay, cancel if activity detected
  scheduleIdleContinuation(client, sessionID, loopState, guards)
  loopState.lastEventType = event.type === "session.idle" ? "session.idle" : "session.status_idle"
  ensureDiagnostics(loopState).idleTimerScheduled = true
  syncDiagnostics(loopState)
}

/**
 * Schedules idle continuation after a delay, cancelling if activity is detected.
 * Guard Level 6 implementation — prevents premature continuation during streaming.
 */
function scheduleIdleContinuation(
  client: OpencodeClient,
  sessionID: string,
  loopState: RalphState,
  guards: IdleGuardState,
): void {
  // Cancel any existing timer for this session
  const existing = guards.pendingTimers.get(sessionID)
  if (existing) clearTimeout(existing)

  guards.activityDetected.set(sessionID, false)

  const timer = setTimeout(async () => {
    guards.pendingTimers.delete(sessionID)
    loopState.lastEventType = "timer_tick"
    ensureDiagnostics(loopState).idleTimerFired = true
    syncDiagnostics(loopState)
    // Check if activity was detected during the delay
    if (guards.activityDetected.get(sessionID)) {
      loopState.lastEventType = "timer_expired_activity_detected"
      syncDiagnostics(loopState)
      return
    }
    // Execute the actual continuation logic
    await executeIdleContinuation(client, sessionID, loopState)
  }, RALPH_DEFAULTS.idleConfirmationDelayMs)

  guards.pendingTimers.set(sessionID, timer)
}

/**
 * Core continuation logic — executed after all 6 guards pass.
 * Checks for completion tags, handles phase transitions, injects continuation prompts.
 *
 * State transitions:
 *   idle → monolithic (iteration 1+)
 *   monolithic → verification (DONE detected or max iterations)
 *   verification → monolithic (Dwight rejected)
 *   verification → complete (VERIFIED → vault0 in_review)
 */
async function executeIdleContinuation(
  client: OpencodeClient,
  sessionId: string,
  loopState: RalphState,
): Promise<void> {
  loopState.lastEventTimestamp = Date.now()
  loopState.inFlight = true
  ensureDiagnostics(loopState).attemptedIdleContinuation = true
  syncDiagnostics(loopState)

  try {
    // 1. If in verification phase, check for VERIFIED FIRST (before DONE check)
    //    This prevents DONE re-detection during verification from re-triggering
    //    verification in an infinite loop.
    if (loopState.phase === "verification") {
      _log(`RALPH_LOOP: In verification phase, checking for VERIFIED tag`)
      const verified = await detectVerifiedPromise(client, sessionId)
      if (verified.found) {
        _log(`RALPH_LOOP: VERIFIED detected — moving task to review and stopping loop`)
        await moveTaskToReview(loopState)
        return
      }
      // Also check for DONE — if agent echoed DONE during verification,
      // ignore it (we're already past that stage)
      const doneEcho = await detectDonePromise(client, sessionId)
      if (doneEcho.found) {
        _log(`RALPH_LOOP: DONE detected during verification phase — ignoring (already in verification)`)
        // Don't re-trigger verification; just wait for Dwight's VERIFIED response
        loopState.consecutiveFailures = 0
        return
      }
      // Dwight rejected (no VERIFIED, no DONE echo) — fall back to monolithic
      _log(`RALPH_LOOP: Verification rejected by Dwight — reverting to monolithic phase`)
      loopState.phase = "monolithic"
      // Fall through to continuation logic below
    }

    // 2. Check for completion promise → check for remaining subtasks before verification
    const done = await detectDonePromise(client, sessionId)
    if (done.found) {
      _log(`RALPH_LOOP: DONE detected at iteration=${loopState.iteration}, phase=${loopState.phase}`)
      ensureDiagnostics(loopState).donePromiseDetected = true
      loopState.lastEventType = "done_promise_detected"
      syncDiagnostics(loopState)
      // If this task has subtasks, check if there are more ready ones to process
      if (loopState.taskId && loopState.hasSubtasks) {
        const ready = await getReadySubtasks(loopState.taskId)
        if (ready.length > 0) {
          // More subtasks are ready — continue iterating instead of verifying
          loopState.iteration++
          const task = await vault0TaskView(loopState.taskId)
          const prompt = buildInitialPlanPrompt(task.description ?? "", ready)

          await client.session.promptAsync({
            path: { id: sessionId },
            body: { parts: [{ type: "text", text: prompt }] },
          })

          if (loopState.ralphTaskId) {
            await syncStateTovault0(
              loopState.ralphTaskId,
              {
                iteration: loopState.iteration,
                phase: loopState.phase,
                sessionId: loopState.sessionId,
                active: loopState.active,
              },
              `Iteration ${loopState.iteration}: delegating ${ready.length} ready subtask(s)`,
            )
          }

          loopState.consecutiveFailures = 0
          return
        }
      }

      // No more ready subtasks (or monolithic task) → go to verification
      _log("RALPH_LOOP: Phase transition → verification")
      loopState.phase = "verification"
      loopState.lastPhaseTransition = `verification started @ ${new Date().toISOString()}`
      syncDiagnostics(loopState)
      await triggerVerification(client, loopState)
      return
    }

    // 3. Check iteration limit → go to verification if reached
    if (loopState.iteration >= loopState.maxIterations) {
      loopState.phase = "verification"
      await triggerVerification(client, loopState)
      return
    }

    // 4. If task has subtasks, check whether all are complete before continuing.
    //    If all subtasks are done but agent didn't emit DONE, trigger verification
    //    instead of blindly sending another continuation prompt.
    if (loopState.taskId && loopState.hasSubtasks) {
      const analysis = await analyzePlan(loopState.taskId)
      if (analysis.readySubtasks.length > 0) {
        // There are ready subtasks — delegate them
        loopState.iteration++
        const task = await vault0TaskView(loopState.taskId)
        const prompt = buildInitialPlanPrompt(task.description ?? "", analysis.readySubtasks)

        await client.session.promptAsync({
          path: { id: sessionId },
          body: { parts: [{ type: "text", text: prompt }] },
        })

        if (loopState.ralphTaskId) {
          await syncStateTovault0(
            loopState.ralphTaskId,
            {
              iteration: loopState.iteration,
              phase: loopState.phase,
              sessionId: loopState.sessionId,
              active: loopState.active,
            },
            `Iteration ${loopState.iteration}: delegating ${analysis.readySubtasks.length} ready subtask(s)`,
          )
        }

        loopState.consecutiveFailures = 0
        return
      }

      // No ready subtasks remain — check if all are completed
      const allDone = analysis.totalSubtasks > 0 &&
        analysis.completedSubtasks.length === analysis.totalSubtasks
      if (allDone) {
        // All subtasks complete but agent didn't emit DONE — trigger verification
        _log("RALPH_LOOP: All subtasks complete (no DONE tag) → verification")
        loopState.phase = "verification"
        loopState.lastPhaseTransition = `verification started (all subtasks done) @ ${new Date().toISOString()}`
        syncDiagnostics(loopState)
        await triggerVerification(client, loopState)
        return
      }

      // Some subtasks still blocked — continue with monolithic prompt to unblock
    }

    // 5. Increment iteration and inject continuation prompt
    const previousIteration = loopState.iteration
    loopState.iteration++
    
    // Safety check: if iteration somehow reset to 0 or went backwards, stop the loop
    if (loopState.iteration <= previousIteration && previousIteration > 0) {
      _log("RALPH_LOOP: SAFETY STOP — iteration went backwards, halting loop")
      loopState.active = false
      loopState.phase = "idle"
      if (loopState.ralphTaskId) {
        await syncStateTovault0(loopState.ralphTaskId, loopState, "SAFETY STOP: iteration regression detected")
      }
      return
    }
    
    _log(`RALPH_LOOP: Iteration ${loopState.iteration} of ${loopState.maxIterations}, phase=${loopState.phase}`)
    const prompt = buildContinuationPrompt(
      loopState.iteration,
      loopState.taskId ?? "unknown task",
      `Iteration ${loopState.iteration} of ${loopState.maxIterations}. Phase: ${loopState.phase}.`,
    )

    await client.session.promptAsync({
      path: { id: sessionId },
      body: { parts: [{ type: "text", text: prompt }] },
    })

    // 6. Sync state to Ralph tracking task via vault0 CLI
    if (loopState.ralphTaskId) {
      await syncStateTovault0(
        loopState.ralphTaskId,
        {
          iteration: loopState.iteration,
          phase: loopState.phase,
          sessionId: loopState.sessionId,
          active: loopState.active,
        },
        `Injected continuation prompt for iteration ${loopState.iteration}`,
      )
    }

    // Success — reset failure count
    loopState.consecutiveFailures = 0
  } catch (error) {
    loopState.consecutiveFailures++
    loopState.lastFailureAt = Date.now()
    _log(`RALPH_LOOP: executeIdleContinuation error: ${error}`)
    // Let circuit breaker handle on next idle
  } finally {
    loopState.inFlight = false
  }
}

/**
 * Handle activity events (message.part.updated, non-idle session.status).
 * Sets activityDetected flag and cancels pending idle timers for Guard Level 6.
 */
function handleActivityEvent(
  event: { type: string; properties: Record<string, unknown> },
  guards: IdleGuardState,
): void {
  if (
    event.type === "message.part.updated" ||
    (event.type === "session.status" &&
      (event.properties as Record<string, unknown>)?.status !== undefined &&
      ((event.properties as Record<string, Record<string, unknown>>)?.status)?.type !== "idle")
  ) {
    const sessionID = event.properties?.sessionID as string | undefined
    if (sessionID) {
      guards.activityDetected.set(sessionID, true)
      // Cancel pending timer
      const timer = guards.pendingTimers.get(sessionID)
      if (timer) {
        clearTimeout(timer)
        guards.pendingTimers.delete(sessionID)
      }
    }
  }
}

/**
 * Handle session error events — increment failure count for circuit breaker.
 */
async function handleSessionError(
  _client: OpencodeClient,
  properties: Record<string, unknown>,
  loopState: RalphState,
): Promise<void> {
  const sessionID = properties?.sessionID as string | undefined
  if (!sessionID || !loopState.active || loopState.sessionId !== sessionID)
    return
  loopState.consecutiveFailures++
  loopState.lastFailureAt = Date.now()
  _log(`RALPH_LOOP: Session error, failures=${loopState.consecutiveFailures}`)
}

/**
 * Handle session deleted events — stop loop if our session is deleted.
 * Moves task to in_review via vault0 CLI as graceful shutdown.
 */
async function handleSessionDeleted(
  _client: OpencodeClient,
  properties: Record<string, unknown>,
  loopState: RalphState,
): Promise<void> {
  const sessionID = properties?.sessionID as string | undefined
  if (!sessionID || !loopState.active || loopState.sessionId !== sessionID)
    return

  _log("RALPH_LOOP: Session deleted, stopping loop")
  if (loopState.taskId) {
    try {
      await vault0TaskMove(loopState.taskId, "in_review")
    } catch (_e) {
      // best effort
    }
  }
  if (loopState.ralphTaskId) {
    try {
      await vault0TaskUpdate(loopState.ralphTaskId, {
        solution: `Ralph loop stopped: session ${sessionID} was deleted`,
      })
      await syncStateTovault0(loopState.ralphTaskId, { ...loopState, phase: "cancelled" as const, active: false })
    } catch (_e) {
      // best effort
    }
  }
  resetState()
}

// ─── Plugin Export ──────────────────────────────────────────────────────────

/**
 * Build the initial prompt for a newly started Ralph loop.
 * Delegates to plan or monolithic prompt based on subtask analysis.
 */
async function buildInitialPrompt(
  client: OpencodeClient,
  loopState: RalphState,
): Promise<string> {
  if (loopState.taskId) {
    const task = await vault0TaskView(loopState.taskId)
    const description = task.description ?? ""

    if (loopState.hasSubtasks) {
      const ready = await getReadySubtasks(loopState.taskId)
      if (ready.length > 0) {
        loopState.phase = "plan"
        return buildInitialPlanPrompt(description, ready)
      }
    }

    loopState.phase = "monolithic"
    return buildInitialMonolithicPrompt(description)
  }

  // New task (no taskId yet) — monolithic by default
  loopState.phase = "monolithic"
  return buildInitialMonolithicPrompt("New task — details provided by user.")
}

export const RalphLoopPlugin: Plugin = async ({ client }) => {
  // Logging disabled — keep _log as silent no-op (set at module level)
  try {
  // Initialize in-memory state
  const loopState = createDefaultState()
  // Reassign module-level state reference so getState() returns this instance
  state = loopState

  const guards: IdleGuardState = {
    recentSyntheticIdles: new Map(),
    recentRealIdles: new Map(),
    pendingTimers: new Map(),
    activityDetected: new Map(),
  }

  // === CRASH RECOVERY (auto-resume) ===
  ;(async () => {
    try {
      const orphan = await findOrphanedRalphTask()
      if (orphan) {
        _log(`RALPH_LOOP: Found orphaned Ralph task ${orphan.ralphTaskId} at iteration ${orphan.state.iteration}`)
        loopState.ralphTaskId = orphan.ralphTaskId
        loopState.taskId = orphan.workTaskId
        loopState.iteration = orphan.state.iteration ?? 0
        loopState.phase = orphan.state.phase ?? "monolithic"
        loopState.hasSubtasks = orphan.state.hasSubtasks ?? false
        loopState.maxIterations =
          orphan.state.maxIterations ?? RALPH_DEFAULTS.maxIterations
        loopState.strategy =
          orphan.state.strategy ?? RALPH_DEFAULTS.strategy
        // Don't set active — old session is stale; user must /ralph <id> to resume
        await client.tui.showToast({
          body: {
            message: `Found orphaned Ralph task ${orphan.ralphTaskId} tracking work task ${orphan.workTaskId ?? 'unknown'} at iteration ${loopState.iteration}. Use /ralph ${orphan.workTaskId ?? orphan.ralphTaskId} to resume.`,
            variant: "info",
          },
        })
      }
    } catch (_e) {
      // Crash recovery is best-effort — don't crash the plugin
    }
  })()

  return {
    event: async ({ event }) => {
      const ev = event as { type: string; properties: Record<string, unknown> }

      // Activity tracking for idle confirmation delay (Guard Level 6)
      if (ev.type === "message.part.updated") {
        const sessionID = ev.properties?.sessionID as string | undefined
        if (sessionID) {
          guards.activityDetected.set(sessionID, true)
          const timer = guards.pendingTimers.get(sessionID)
          if (timer) {
            clearTimeout(timer)
            guards.pendingTimers.delete(sessionID)
          }
        }
      }

      // Idle events (real and synthetic) → guard chain
      if (ev.type === "session.idle" || ev.type === "session.status") {
        await handleEvent(client, ev, loopState, guards)
      }

      // Error/deletion handling
      if (ev.type === "session.error") {
        await handleSessionError(client, ev.properties, loopState)
      }
      if (ev.type === "session.deleted") {
        await handleSessionDeleted(client, ev.properties, loopState)
      }
    },

    "command.execute.before": async (input, output) => {
      if (input.command === "ralph") {
        _log(`RALPH_LOOP: /ralph command received, args=${input.arguments}`)
        await handleRalphStart(client, input.sessionID, input.arguments, loopState)
        if (loopState.active) {
          const prompt = await buildInitialPrompt(client, loopState)
          _log(`RALPH_LOOP: Loop started, phase=${loopState.phase}`)
          output.parts = [
            {
              type: "text",
              text: prompt,
            } as Part,
          ]
        }
        return
      }
      if (input.command === "ralph-cancel") {
        _log('RALPH_LOOP: /ralph-cancel command received')
        await handleRalphCancel(client, input.sessionID, loopState)
        return
      }
    },
  }
  } catch (e) {
    _log(`RALPH_LOOP: Plugin init error: ${e}`);
    throw e;
  }
}


// ─── Inline Test Assertions ─────────────────────────────────────────────────

function _runStateTests(): void {
  const assert = (cond: boolean, msg: string) => {
    if (!cond) throw new Error(`ASSERTION FAILED: ${msg}`)
  }

  // Round-trip test
  const testState: Partial<RalphState> = {
    iteration: 3,
    maxIterations: 100,
    strategy: "continue",
    phase: "monolithic",
    hasSubtasks: true,
    sessionId: "ses_abc123",
    active: true,
    inFlight: false,
    consecutiveFailures: 0,
  }

  const serialized = serializeRalphState(testState)
  const parsed = parseRalphState(serialized)

  assert(parsed.iteration === 3, "iteration round-trip")
  assert(parsed.maxIterations === 100, "maxIterations round-trip")
  assert(parsed.strategy === "continue", "strategy round-trip")
  assert(parsed.phase === "monolithic", "phase round-trip")
  assert(parsed.hasSubtasks === true, "hasSubtasks round-trip")
  assert(parsed.sessionId === "ses_abc123", "sessionId round-trip")
  assert(parsed.active === true, "active round-trip")
  assert(parsed.inFlight === false, "inFlight round-trip")
  assert(parsed.consecutiveFailures === 0, "consecutiveFailures round-trip")

  // Empty / no block
  assert(Object.keys(parseRalphState("")).length === 0, "empty description")
  assert(Object.keys(parseRalphState("Just text")).length === 0, "no block")

  // buildInitialDescription preserves original
  const initial = buildInitialDescription("Original task text", RALPH_DEFAULTS)
  assert(initial.includes("Original task text"), "preserves original")
  assert(initial.includes("<!-- RALPH_STATE"), "has state block")
  assert(parseRalphState(initial).iteration === 0, "initial iteration 0")

  // updateDescriptionState replaces block
  const updated = updateDescriptionState(initial, {
    iteration: 5,
    phase: "verification",
  })
  const up = parseRalphState(updated)
  assert(up.iteration === 5, "updated iteration")
  assert(up.phase === "verification", "updated phase")
  assert(updated.includes("Original task text"), "update preserves desc")

  // updateDescriptionState on plain text (no block)
  const noBlock = updateDescriptionState("plain text", { iteration: 1 })
  assert(noBlock.includes("<!-- RALPH_STATE"), "prepends block")
  assert(noBlock.includes("plain text"), "preserves plain text")

  // appendIterationLog
  let withLog = appendIterationLog(initial, 1, "plan", "Did stuff")
  assert(withLog.includes("## Iteration History"), "has history header")
  assert(withLog.includes("### Iteration 1 (plan)"), "has entry 1")
  withLog = appendIterationLog(withLog, 2, "monolithic", "More stuff")
  assert(withLog.includes("### Iteration 2 (monolithic)"), "has entry 2")
  assert(withLog.includes("### Iteration 1 (plan)"), "entry 1 preserved")

  _log('RALPH_LOOP: All state parser/serializer tests passed')
}

// Named export for opencode plugin loader (matches working plugin convention)
// Also keep default export for backwards compatibility
