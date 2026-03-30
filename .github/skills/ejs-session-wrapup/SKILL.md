---
name: ejs-session-wrapup
description: Initialize and manage EJS artifacts throughout session lifecycle (Session Journey initialization, continuous updates, and finalization; ADR only when significant)
---

# Engineering Journey System — Session Journey Management Skill

## Purpose
Automate Session Journey management throughout the entire session lifecycle.

This skill handles three phases:
1. **Session Initialization** - create initial Session Journey artifact at session start
2. **Continuous Updates** - update Session Journey throughout the session as work progresses
3. **Session Finalization** - finalize Session Journey and optionally create ADR at session end

This skill integrates with GitHub Copilot or compatible AI coding agents.

## Triggers

### Session Start Triggers
Activate session initialization when the user signals session start with any of these phrases:

- "Let's start"
- "Begin"
- "Start working on [task/issue]"
- "Initialize session"
- "Create session journey"

Also treat these as session-start signals when beginning new work:
- Starting work on a GitHub issue
- Beginning a new feature or bug fix
- "Let's work on..."

### Session End Triggers
Activate session finalization when the user signals session end with any of these phrases:

- "Generate ADR for this session"
- "Wrap up this session"
- "End session"
- "Finalize journey"

Also treat these as session-end signals:

- "I'm done"
- "Ship it"
- "Commit this"
- "Commit and push"
- "Push this"

## Actions on Session Start

### 1. Switch to Session Initialization Mode
- Prepare to create the initial Session Journey artifact
- Establish session context

### 2. Generate Session ID
- Format: `ejs-session-YYYY-MM-DD-<seq>`
- Ensure uniqueness per day

### 3. Create Initial Session Journey
- Use `ejs-docs/journey/_templates/journey-template.md` as base
- Populate initial metadata:
- session_id
- author
- date
- repo
- branch
- agents_involved
- decision_detected: false (initial state)
- Fill in initial sections:
- **Problem/Intent** - capture the goal or task being addressed
- **Interaction Summary** - create structure for continuous updates
- Leave other sections ready for incremental updates during the session
- Write to: `ejs-docs/journey/YYYY/<session-id>.md`

### 4. Inform User
- Confirm Session Journey created
- Remind that journey will be updated throughout session
- State session ID for reference

## Actions During Session (Continuous Updates)

As the session progresses, continuously update the Session Journey with:

### Update Interaction Summary
- Add new human prompts and agent responses
- Record outcomes and decisions made
- Keep format: `- Human: <prompt> → Agent: <response> → Outcome: <result>`

### Update Experiments Section
- Record what was tried
- Document what happened
- Note what evidence emerged

### Update Iteration Log
- Document pivots and refinements
- Explain why changes were made

### Update Decisions Made
- Capture decisions with rationale and impact
- Assess if decision meets ADR criteria

### Update Key Learnings
- Record insights as they emerge (technical, prompting, tooling)

### Trigger ADR Creation If Needed
- If a significant decision occurs mid-session, note it in the journey
- Prepare ADR metadata for later creation if decision rubric is met

## Actions on Session End (Finalization)

### 1. Switch to Journey Finalization Mode
- Stop suggesting new code or expanding scope
- Focus on completing the Session Journey

### 2. Finalize Session Journey
- Review and complete all sections:
- Ensure Interaction Summary is complete and coherent
- Complete Agent Collaboration Summary
- Complete Agent Influence section
- Finalize Experiments/Evidence
- Complete Iteration Log
- Finalize Decisions Made
- Complete Key Learnings
- Fill in "If Repeating This Work"
- Complete Future Agent Guidance
- Populate all `## MACHINE EXTRACTS` sections:
- INTERACTION_EXTRACT
- DECISIONS_EXTRACT
- LEARNING_EXTRACT
- AGENT_GUIDANCE_EXTRACT
- Update `decision_detected` field based on ADR criteria
- Save final version to `ejs-docs/journey/YYYY/<session-id>.md`

### 3. Decision Detection (ADR Gate)
Create an ADR only if at least one applies:
- System boundary changed (service/datastore/topology/major dependency)
- Public contract changed (API/schema/config/capability)
- Security/privacy/compliance posture changed
- Credible alternatives weighed with meaningful trade-offs
- Long-lived or hard-to-reverse consequences
- Process/workflow change affecting future work

If none apply: set `decision_detected: false` in the Session Journey and do not create an ADR.

### 4. Draft ADR (Only If Needed)
- Use `ejs-docs/adr/0000-adr-template.md` as base
- Create a numbered ADR at: `ejs-docs/adr/NNNN-<kebab-title>.md`
- Requirements:
- include `session_id`
- include a link back to the Session Journey file (relative link)
- record considered options + rationale + consequences
- keep it decision-focused; details live in the Session Journey
- Update Session Journey `adr_links` field with new ADR path

## Notes for Agents

### Throughout Session
- Keep Session Journey up-to-date as work progresses
- Don't wait until the end to capture important context
- Update incrementally to preserve accurate history
- Treat the journey as a living document during the session

### At Session End
- Treat session content as frozen once end-session is triggered
- Ensure **all decisions and learning points are explicit**
- Do not overwrite previous Session Journeys or ADRs with the same session ID
- Links between ADR and Session Journey should be relative

## Benefits of Incremental Capture

Capturing the journey throughout the session (vs. reconstructing at the end):
- **Better context preservation** - details captured when fresh
- **More accurate collaboration trail** - prompts and responses recorded as they occur
- **Reduced end-of-session burden** - most work already done
- **Higher quality documentation** - real-time vs. retrospective capture
- **Better for multi-step/multi-agent sessions** - preserves full collaboration history

## Reminder: skills don't auto-run on git events

Skills are loaded by prompt relevance (based on this file's description and your request).
For "fire on commit/push" enforcement/reminders, use the git hooks in this repo.
