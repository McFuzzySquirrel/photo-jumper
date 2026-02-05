---
name: ejs-session-wrapup
description: Create end-of-session EJS artifacts (always one Session Journey; ADR only when significant)
---

# Engineering Journey System — Session Journey + ADR Skill

## Purpose
Automate end-of-session capture for developer + agent sessions.

At session end, this skill:
- always creates a single **Session Journey** artifact (collaboration + influence + iterations + experiments + learnings)
- only creates an ADR when a significant architecture/design decision occurred

This skill integrates with GitHub Copilot or compatible AI coding agents.

## Triggers

Activate when the user signals session end with any of these phrases:

- "Generate ADR for this session"
- "Wrap up this session"
- "End session"
- "Prepare journey artifacts"

Also treat these as session-end signals:

- "I'm done"
- "Ship it"
- "Commit this"
- "Commit and push"
- "Push this"
- "Create the Session Journey"

## Actions on Trigger

### 1. Switch Modes
- Stop suggesting new code or expanding scope
- Switch to **Journey Capture Mode**

### 2. Generate Session ID
- Format: `ejs-session-YYYY-MM-DD-<seq>`
- Ensure uniqueness per day

### 3. Create Session Journey (Always)
- Use `ejs-docs/journey/_templates/journey-template.md` as base
- Capture:
	- Problem/Intent
	- Interaction Summary (concise human↔agent prompt/response/outcome trail)
	- Collaboration summary (key prompts, suggestions, corrections)
	- **Agent Influence** (where the agent shaped direction; where the human overrode)
	- Experiments/evidence (what was tried, what happened)
	- Iteration log (pivots and why)
	- Key learnings
	- Decisions made (including rationale)
	- Future agent guidance

Also populate `## MACHINE EXTRACTS / INTERACTION_EXTRACT` with a compact prompt/response/outcome trail suitable for downstream parsing.
- Write to:
	`ejs-docs/journey/YYYY/<session-id>.md`

### 4. Decision Detection (ADR Gate)
Create an ADR only if at least one applies:
- System boundary changed (service/datastore/topology/major dependency)
- Public contract changed (API/schema/config/capability)
- Security/privacy/compliance posture changed
- Credible alternatives weighed with meaningful trade-offs
- Long-lived or hard-to-reverse consequences
- Process/workflow change affecting future work

If none apply: set `decision_detected: false` in the Session Journey and do not create an ADR.

### 5. Draft ADR (Only If Needed)
- Use `ejs-docs/adr/0000-adr-template.md` as base
- Create a numbered ADR at:
	`ejs-docs/adr/NNNN-<kebab-title>.md`
- Requirements:
	- include `session_id`
	- include a link back to the Session Journey file (relative link)
	- record considered options + rationale + consequences
	- keep it decision-focused; details live in the Session Journey

## Notes for Agents

- Treat session content as frozen once end-session is triggered
- Ensure **all decisions and learning points are explicit**
- Do not overwrite previous Session Journeys or ADRs with the same session ID
- Links between ADR and Session Journey should be relative

## Reminder: skills don’t auto-run on git events

Skills are loaded by prompt relevance (based on this file’s description and your request).
For "fire on commit/push" enforcement/reminders, use the git hooks in this repo.
