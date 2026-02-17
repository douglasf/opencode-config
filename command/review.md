---
description: Review changes in a GitHub PR by delegating to Vincent
---

Review the changes in a GitHub Pull Request by delegating the full analysis to Vincent, the deep codebase investigator.

## Arguments

- First argument: $1 (PR number - required)

## Process

1. **Delegate the entire review to Vincent** using a single `Task()` call. Vincent has read-only bash access to `gh pr view` and `gh pr diff`, so he can fetch all PR data and perform the analysis himself.

   ```
   Task(
     subagent_type: "vincent",
     description: "Review PR #$1",
     prompt: <see template below>
   )
   ```

2. **Task prompt template** — pass this to Vincent (substitute $1 for the PR number):

   ````
   Review GitHub Pull Request #$1. Follow these steps:

   1. Fetch PR metadata and existing feedback:
      ```
      gh pr view $1 --json baseRefName,headRefName,title,body,comments,reviews
      ```
      Note the PR title, body, author, and any existing review comments
      so you can avoid duplicating feedback that has already been given.

   2. Fetch the exact diff of only the PR changes:
      ```
      gh pr diff $1
      ```
      This returns ONLY the changes in the PR, not everything merged to the base branch.

   3. Analyze the diff thoroughly, focusing on:
      - **Correctness**: Logic errors, potential bugs, incorrect assumptions, off-by-one errors, race conditions
      - **Security**: Injection vulnerabilities, auth/authz gaps, sensitive data exposure, unsafe deserialization, missing input validation
      - **Performance**: Unnecessary allocations, N+1 queries, missing indexes, unbounded loops, large payload risks
      - **Style & readability**: Naming clarity, function length, dead code, inconsistent patterns, missing documentation for complex logic
      - **Error handling**: Uncaught exceptions, swallowed errors, missing fallbacks, unclear error messages
      - **Test coverage**: Whether new/changed behavior has corresponding tests, missing edge case tests, test quality

   4. Return your findings as a structured review organized into these sections:

      ## Critical Issues
      Problems that must be fixed before merging — bugs, security flaws, data loss risks.
      For each issue: file path, line number(s), description of the problem, and a suggested fix.

      ## Suggestions
      Improvements that would make the code better but are not blocking — refactors,
      performance wins, readability improvements.
      For each: file path, line number(s), what to change and why.

      ## Questions for the Author
      Things that are ambiguous or where the reviewer lacks context to judge —
      design decisions, business logic assumptions, intentional tradeoffs.

      ## Positive Observations
      Things done well — good patterns, thorough tests, clean abstractions.
      Reinforce good practices.

      If a section has no items, include it with "None." so the structure is consistent.

      At the top, include a one-paragraph summary of the overall PR: what it does,
      your general impression, and whether it looks ready to merge (with/without changes).

      IMPORTANT: Skip any feedback that duplicates existing PR comments or reviews
      you found in step 1. Note at the end if you skipped items for this reason.
   ````

3. **Present Vincent's review** to the user exactly as returned. Do not summarize or truncate — the structured format IS the final output.

## Important

- Do NOT use `git diff` against the local working directory
- Always use `gh pr diff $1` (via Vincent) to ensure you're reviewing exactly what's in the PR
- Skip feedback that duplicates existing PR comments/reviews
- This command does NOT require the branch to be checked out locally
- Vincent has read-only `gh` access — he can fetch all PR data without any local checkout
