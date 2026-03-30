---
name: ejs-session-init
description: >
  Enhance a hook-scaffolded EJS session journey file with semantic content
  (problem/intent, agents involved) and confirm initialization.
---

# EJS Session Initialization

Use this skill when a session is starting — for example when the user says
"initialize session", "start session", "create session journey", or begins
work on a new task, feature, or bug fix.

> **Note:** Copilot hooks (`scripts/hooks/session-start.sh`) automatically
> create the journey file scaffold and sync the EJS database at session start.
> This skill enhances the scaffold with semantic content that hooks cannot provide.

## Steps

1. **Locate the journey file**
   - A hook-created scaffold should already exist at `ejs-docs/journey/YYYY/ejs-session-YYYY-MM-DD-<seq>.md`
   - If the scaffold is missing (e.g., hooks not yet on default branch), create one from `ejs-docs/journey/_templates/journey-template.md`

2. **Populate semantic metadata**
   Fill in the fields that hooks cannot determine:
   - `author` — the human user (if known)
   - `agents_involved` — list the active agents (e.g., `[copilot]`)

3. **Capture initial Problem / Intent**
   - Write the user's stated goal or task description into the **Problem / Intent** section.

4. **Confirm initialization**
   - Inform the user: `"Session initialized: ejs-session-YYYY-MM-DD-<seq>"`

## Contextual References

- Session Journey template: `ejs-docs/journey/_templates/journey-template.md`
- ADR template: `ejs-docs/adr/0000-adr-template.md`
- Lifecycle patterns: `ejs-docs/session-lifecycle-patterns.md`
- Database tool: `scripts/adr-db.py`
- Hook that creates scaffold: `scripts/hooks/session-start.sh`

## Key Principle

Initialize early, capture context while it's fresh. Hooks guarantee the
structural scaffold; this skill adds the semantic meaning that only an
LLM can provide.
