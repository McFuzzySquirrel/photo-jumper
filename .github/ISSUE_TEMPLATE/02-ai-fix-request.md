---
name: "🤖 AI Fix / Gameplay Improvement"
about: "Issue for AI or Copilot to fix gameplay, generation, or fairness problems"
title: "[AI] "
labels: ["needs-triage", "ai-fix", "gameplay", "generation", "fairness", "collision", "difficulty", "debug"]
assignees: []
---

# 🤖 AI Fix – Photo Jumper

This issue is intended for **AI-assisted development** (Copilot / custom agent).
Treat this as a **design brief**, not just a bug report.

---

## 🧩 Problem Statement

Describe **what feels wrong** from a player or gameplay perspective.

Examples:
- A platform looks jumpable but isn’t
- The level becomes unwinnable
- Difficulty spikes due to photo noise
- Collision does not match visuals
- Platforms feel unreliable or unfair

> What is broken, unclear, unfair, or frustrating?

---

## 🎯 Desired Outcome

Describe **what “good” looks like** after this issue is fixed.

> How should the player experience change?

---

## 🧠 Constraints (Non-Negotiable)

The solution **must** respect the following:

- Gameplay quality overrides image accuracy
- Jump physics must remain unchanged unless explicitly stated
- Platforms must be fair, predictable, and solid
- Visuals must match collision geometry exactly
- The game must remain web-based and performant

---

## 📐 Gameplay Rules to Respect

Confirm applicable limits (edit if they differ in code):

- Max horizontal jump: **120px**
- Max vertical jump height: **90px**
- Player hitbox: **16px × 24px**
- Landing tolerance: **4px** vertical snap

Platform generation constraints:

- Min platform width: **40px**
- Min platform thickness: **12px**
- Snap near-horizontal tolerance: **8°**
- Merge collinear tolerance: **6px**

If detected geometry violates these rules, it **must be adjusted or discarded**.

---

## 📷 Photo → Platform Context (if applicable)

- [ ] Issue caused by shadows / lighting
- [ ] Issue caused by perspective distortion
- [ ] Issue caused by noisy / short line detection
- [ ] Issue caused by platform thickness
- [ ] Issue caused by platform spacing
- [ ] Other (describe below)

Additional notes about the photo input:

---

## 🛠 Technical Expectations

How the agent should approach this fix:

- Prefer normalization and filtering over new features
- Avoid adding new libraries unless clearly justified
- Expose tunable values instead of hardcoding numbers
- Add optional debug overlays if it improves clarity
- Keep logic readable and learner-friendly

---

## 🧪 Acceptance Criteria

This issue is complete **only if all are true**:

- [ ] The level remains winnable
- [ ] Platforms feel solid and predictable
- [ ] Player deaths are explainable and fair
- [ ] No accidental precision jumps introduced
- [ ] Visuals and collisions are aligned
- [ ] Performance is not degraded

---

## 📎 References

Add anything that helps explain the issue:

- Screenshots:
- Videos:
- Code files:
- Related issues or PRs:

---

## 🧭 Guiding Principle

> **If image accuracy and gameplay quality conflict, gameplay quality wins.**

A visually accurate but unfair level is considered a failed outcome.

---

## ✅ Recommended Labels to Create

To get the most value out of this template, create these labels in GitHub:

- ai-fix
- gameplay
- generation
- fairness
- collision
- difficulty
- debug
