# Prompt Patterns

## Subagent Research Before Implementation
### Pattern
Dispatch a subagent to gather comprehensive context across multiple areas of a large file before starting implementation.
### When To Use
- When changes span CSS, HTML, and JS sections of a large single-file project
- When you need exact line numbers and current code structure before making edits
- When multiple unrelated areas of a file need modification simultaneously
### Example Prompt
"Research the following areas of index.html and return exact code snippets with line numbers: (1) mobile button CSS styles, (2) zoom control HTML, (3) jump physics in Player class, (4) keyboard event handlers, (5) canvas resize function. Return all findings so I can plan batch edits."
### Observed Outcome
Returned detailed findings with line numbers across 5+ areas, enabling all 16 replacements to be planned and executed in one batch call with zero failures.

## Iterative Plan Refinement with User
### Pattern
Present a structured plan, then refine through 2-3 rounds of user feedback before implementing.
### When To Use
- When the user's request has multiple components that interact
- When trade-offs exist (e.g., fixed zoom vs auto-fit)
- When the user may want to add requirements mid-planning
### Example Prompt
Present plan with numbered steps and specific values. Ask: "Does this match your intent? Any adjustments?" Iterate until user confirms all decisions.
### Observed Outcome
User refined from "50% zoom" to "auto-fit zoom", added variable-height jump requirement, and confirmed button ordering — all before any code was written. Zero rework needed.

## Delete-and-Recreate for Encoding Issues
### Pattern
When a file has encoding issues that prevent text replacement, delete the file and recreate it with clean content.
### When To Use
- When `replace_string_in_file` fails with "Could not find matching text" on content that visually looks correct
- When `hexdump` reveals non-ASCII bytes (e.g., `e2 80 9c` for curly quotes)
- When the file can be fully regenerated (you have or can produce the complete content)
### Example Prompt
"The replacement failed. Run `hexdump -C <file> | head -40` to check for Unicode characters. If found, I'll delete and recreate the file."
### Observed Outcome
Identified Unicode curly quotes via hexdump, deleted the file, recreated with clean ASCII — resolved immediately.

## EJS Docs Precedence Check
### Pattern
Before making decisions about the codebase, check EJS docs for the latest context.
### When To Use
- At the start of any new session working on this repository
- Before modifying game code, physics, or architecture
- When instruction files and EJS docs might conflict
### Example Prompt
"Check ejs-docs/adr/ for latest ADRs, ejs-docs/journey/ for recent session logs (newest first), and ejs-docs/agent-memory/ for learned patterns before proceeding."
### Observed Outcome
Added as a standing instruction in both copilot.instructions.md and photo-jumper-gameplay.prompt.md to ensure all future agents follow this pattern.