---
name: github
description: "Interact with GitHub using the `gh` CLI. Use `gh issue`, `gh pr`, `gh run`, and `gh api` for issues, PRs, CI runs, and advanced queries."
---

# GitHub Skill

Use the `gh` CLI to interact with GitHub. Always specify `--repo owner/repo` when not in a git directory, or use URLs directly.

## Prerequisites

This skill requires the `gh` CLI installed and authenticated.

**Install:**

| Platform | Command |
|----------|---------|
| macOS | `brew install gh` |
| Windows | `winget install GitHub.cli` |
| Linux | `sudo apt install gh` or `sudo dnf install gh` |

**Authenticate (one-time):**

```bash
gh auth login
```

**Verify:**

```bash
gh auth status
```

If `gh auth status` shows "not logged in", all commands below will fail.

## Pull Requests

Check CI status on a PR:
```bash
gh pr checks 55 --repo owner/repo
```

List recent workflow runs:
```bash
gh run list --repo owner/repo --limit 10
```

View a run and see which steps failed:
```bash
gh run view <run-id> --repo owner/repo
```

View logs for failed steps only:
```bash
gh run view <run-id> --repo owner/repo --log-failed
```

## Issues

List open issues:
```bash
gh issue list --repo owner/repo --limit 10
```

View a specific issue:
```bash
gh issue view 42 --repo owner/repo
```

Create an issue:
```bash
gh issue create --repo owner/repo --title "Bug title" --body "Description"
```

## API for Advanced Queries

The `gh api` command is useful for accessing data not available through other subcommands.

Get PR with specific fields:
```bash
gh api repos/owner/repo/pulls/55 --jq '.title, .state, .user.login'
```

## JSON Output

Most commands support `--json` for structured output.  You can use `--jq` to filter:

```bash
gh issue list --repo owner/repo --json number,title --jq '.[] | "\(.number): \(.title)"'
```

## Data Presentation

After running commands, clean and format the output before presenting to the user:

1. **Clean raw data** — Strip any HTML tags, escape sequences, or terminal formatting. The user should never see raw code or tags.
2. **Use plain Markdown only** — Present data using Markdown text, tables, or lists. Do not use LaTeX, MathML, KaTeX, or any math-mode formatting.
3. **Match the user's intent** — Choose the presentation style based on what was asked:
   - Single item query → brief text summary
   - List query → table
   - Analysis request → table with interpretation
