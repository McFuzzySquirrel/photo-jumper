# Decisions

A lightweight decision log so we can remember *what* we chose and *why*.

## Template

- **Date:** YYYY-MM-DD
- **Decision:** (what we decided)
- **Why:** (the reasoning / tradeoffs)
- **Notes:** (optional)

## Log

- **Date:** 2026-01-28
	- **Decision:** Create a `copilot.instructions` file that acts as the project “law” for agent-assisted changes.
	- **Why:** Make expectations explicit and persistent so gameplay-quality rules are consistently applied.
	- **Notes:** Captured in `learning/journey/notes/2026-01-28-research.md`.

- **Date:** 2026-01-28
	- **Decision:** Create a reusable Copilot Chat prompt to “enforce the law” (review changes against the rules).
	- **Why:** Reduce back-and-forth by having a consistent review/checklist mindset before or during implementation.
	- **Notes:** Follow-on idea: later add an automated “judge” for PRs.

