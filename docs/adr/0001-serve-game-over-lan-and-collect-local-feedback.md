# ADR 0001: Serve game over LAN and collect local feedback

- Status: Accepted
- Date: 2026-01-25

## Context

Photo Jumper is currently a single-file static web game (one `index.html`).

We want:
- People on the same local network (mobile/tablet/desktop) to access the game over HTTP.
- A feedback mechanism that works without internet access (LAN/offline).
- Feedback to be text-only for now, with a simple category for device type.

Constraints:
- Keep the project low-friction (no build pipeline required).
- Avoid third-party services (Google Forms, GitHub Issues) so it works offline.
- Keep data local to the host machine.

## Decision

We will:

1. Add a small Node.js + Express server to serve the static game and expose a same-origin feedback endpoint.
   - Static content served from the project root.
   - Feedback endpoint: `POST /api/feedback`.

2. Store feedback as append-only JSONL files with daily rotation:
   - Directory: `feedback/`
   - File per day: `feedback/YYYY-MM-DD.jsonl`

3. Keep the feedback payload minimal:
   - `message` (string, required, max 2000 chars)
   - `deviceType` (enum: `desktop | tablet | mobile | unknown`)
   - Server augments with timestamp + user-agent and (for basic auditing) source IP.

4. Add basic LAN safety controls:
   - Only accept requests from private IP ranges / localhost.
   - Rate limit feedback submissions per IP.
   - Optional shared token: if `FEEDBACK_TOKEN` is set on the server, clients must send `X-Feedback-Token`.

5. Add lightweight UI affordances in the game:
   - A “Feedback” button opens a modal to submit feedback.
   - A “Share link” hint shows the current URL and provides a Copy button.

## Consequences

### Positive

- Works offline on a local network; no external dependencies for feedback collection.
- Same-origin API avoids CORS complexity.
- JSONL is simple to append and easy to inspect/parse.
- Token is optional: frictionless by default, but can be enabled when needed.

### Negative / Trade-offs

- Requires Node.js + npm to run the LAN server.
- JSONL logs can grow over time; rotation helps but needs periodic cleanup/archiving.
- The private-IP allowlist is a pragmatic control, not a full security boundary.

## Alternatives considered

- GitHub Issues link: very low effort, but requires internet + accounts.
- Google/Microsoft Forms: easy UX, but requires internet and third-party storage.
- Python Flask endpoint: feasible, but adds a Python dependency chain and setup.
- No feedback endpoint (just instructions): misses the request for an in-game mechanism.

## Implementation notes

- Server entry point: `server.js`
- Node package metadata: `package.json`
- UI changes live in `index.html`
- Local artifacts are excluded via `.gitignore` (`node_modules/`, `feedback/`).
