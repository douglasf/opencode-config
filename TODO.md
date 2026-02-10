# TODO

## Pending

- [ ] **TODO-001** — Allow agents to use `sleep` intentionally across both security modes
  - **Why it matters**: Agents sometimes need a deliberate pause — waiting for a server to boot, a port to open, or a CI artifact to propagate — before continuing. Without an allowed `sleep`, they either poll in a tight loop (wasting tokens) or skip the wait and hit a race condition.
  - **Context**:
    - `opencode.jsonc` (strict mode) already allows `sleep*` under wolf's bash permissions (line 25).
    - `opencode-yolo.jsonc` has an exhaustive "Common utilities" section but does **not** include `sleep*`. An agent running under YOLO mode will be prompted or denied when it tries to sleep.
    - `sleep` is a harmless, read-nothing, write-nothing command — there is no security reason to gate it behind `ask`.
  - **Next steps**:
    1. Add `"sleep*": "allow"` to the "Common utilities" block in `opencode-yolo.jsonc` (around line 288, alongside `cat*`, `head*`, etc.).
    2. Verify both configs parse cleanly (`cat opencode.jsonc | jq . && cat opencode-yolo.jsonc | jq .` or equivalent JSONC validator).
    3. Optionally document in the agent files (e.g., `wolf.md`) that `sleep N` is an approved pattern for waiting on external processes.

## Completed
