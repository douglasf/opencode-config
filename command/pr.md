---
description: Create a pull request from current branch
---

You are a command dispatcher for pull request operations. Your job is to delegate to the git subagent.

## Arguments Provided

- Jira ID or Title: $1
- Custom Title: $2

## Your Task

Use the Task tool to invoke the git subagent with the following prompt:

```
Create a pull request for the user's changes.

Arguments:
- First argument: "$1"
- Second argument: "$2"

Argument parsing rules:
- If $1 matches pattern [A-Z]+-[0-9]+ (like PROJ-123), it's a Jira ID
- If $1 is a Jira ID and $2 is provided, use $2 as base title with [$1] inserted after colon
- If $1 is a Jira ID and $2 is empty, generate title with [$1] after colon
- If $1 doesn't match Jira pattern, use it as the full PR title
- If both empty, generate title automatically

When Jira ID present, include in description:
Jira: https://jira.company.com/browse/JIRA-ID

Process:
1. Verify current branch and ensure commits are pushed
2. Review commit history since branching from main
3. Analyze all changes to understand scope and impact
4. Create PR title following conventional commits format
5. Generate comprehensive PR description
6. Create PR using gh pr create

Title format:
- Without Jira: <type>(<scope>): <subject>
- With Jira: <type>(<scope>): [JIRA-ID] <subject>
```
