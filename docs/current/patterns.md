# Patterns

**Counterparts:** [`patterns.html`](patterns.html) · [`patterns.json`](patterns.json)

- **Section:** Patterns
- **Audience:** Document reviewers, Frontend developers, Contributors
- **Use when:** Completing or changing an end-to-end user workflow.
- **Status:** Current
- **Last reviewed:** 2026-07-13

## Purpose

Describe the end-to-end workflows that the public product currently supports.

## On this page

- [Primary workflows](#primary-workflows)
- [Recovery behavior](#recovery-behavior)
- [Verification](#verification)

## Primary workflows

1. Open a document, choose an annotation tool, make changes, save or export scoped annotations, then export the revised document.
2. Use find/replace previews before committing changes and retain a recoverable export for consequential edits.

## Recovery behavior

Show actionable errors, preserve safe user input where possible, and explain the next recovery action. For destructive or irreversible actions, require confirmation and document the available undo or export path.

## Verification

- Exercise a happy path, an empty state, a validation error, and a recovery path.
- Confirm instructions match visible labels and current API/UI behavior.

## Related guides

- [Start here](start-here.md)
- [Architecture](architecture.md)
- [Quality](quality.md)
