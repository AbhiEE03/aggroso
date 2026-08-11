# AGENT_USAGE.md

## Tools Used

- **Antigravity Claude** — primary implementation agent across all phases

## Work Delegated to Agents

### Phase 1 — 2026-08-12

**Summary of what was built:**
Antigravity Claude scaffolded the full repo structure:
- `/server` — Express + Mongoose + AJV + Morgan, Skill model, 5 endpoints (POST, GET list, GET one, PUT, POST publish), centralized error middleware, tool registry constants, JSON Schema validator, Jest tests for validator pure functions
- `/client` — Vite + React + React Router, 3 pages (SkillList, SkillForm, SkillDetail), Axios API module, dark theme CSS with design tokens
- Root docs: `README.md`, `AGENT_USAGE.md`, `INTERVIEW_PREP.md` skeletons

**Representative prompt used:**
See `Aggroso_PROJECT_PLAN.md` Phase 1 → "Prompt for Antigravity Claude" section.

**Abhishek's verification notes:**
<!-- Fill in manually after you verify each item in the "What YOU must personally verify" list -->

## Notable Agent Mistakes / Rejected Suggestions

TODO — fill in as build progresses.

## Verification Process

TODO — describe your personal verification workflow after Phase 5.
