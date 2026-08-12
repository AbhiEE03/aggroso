# AGENT_USAGE.md

## Tools Used

- **Antigravity** — primary implementation agent across all phases (Phase 1 through Phase 5).

## Work Delegated to Agents

### Phase 1 — Scaffold and Skill Definition
Antigravity built the Express/Mongoose backend and React/Vite frontend. It defined the Skill schema, the CRUD API, and integrated AJV for JSON Schema validation. It implemented the `draft` → `published` state transition flow where published skills become immutable.

### Phase 2 — Tools & Permissions
Antigravity created the 4 specific tools (`calculator`, `docSearch`, `recordLookup`, `taskCreator`) and added the `assertToolAllowed` permission gate. It implemented a placeholder test-run feature to test tool execution and validation.

### Phase 3 — Execution Engine & Approval Gates
Antigravity integrated Gemini 3.6 Flash for structured JSON planning. It wrote the async execution loop that tracks steps inside the `ExecutionRun` document, implemented the "pause for approval" mechanic on write tools (`taskCreator`), and built the idempotency mechanism for safe resumes. It also created a polling-based `ExecutionView.jsx` trace UI.

### Phase 4 — Version History & Diffs
Antigravity built the backend logic to traverse a skill's `previousVersionId` lineage and compute field-level JSON diffs. It updated the frontend to display a version history timeline and a side-by-side diff UI, enabling historical re-runs.

### Phase 5 — Hardening
Antigravity audited all UI states (loading, empty, error), replaced scattered console logs with a custom JSON structured logger, handled Gemini API timeouts, and wrote the final documentation (README, AGENT_USAGE, INTERVIEW_PREP).

## Representative Prompts

Most of the work was guided by the detailed prompts contained in `Aggroso_PROJECT_PLAN.md`. Example of a specific intervention:
> "Execution failed: Planning failed after 2 attempts: [GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent: [404 Not Found] ... fix it"

> "also check 3.6"

## Notable Agent Mistakes / Rejected Suggestions

1. **Model Selection:** The original `PROJECT_PLAN` referenced `gemini-2.5-flash` which is no longer available/supported for new users. Antigravity initially failed during Phase 3 planning because of this. We had to manually prompt the agent to switch to `gemini-3.6-flash`.
2. **Editing Published Skills Test Failure:** In Phase 4, the agent wrote a Jest test that attempted to `PUT /api/skills/:id` on a published skill, failing because the Phase 1 rule correctly blocks edits to published skills. The agent had to self-correct and rewrite the test to properly `POST` a new draft using `previousVersionId` instead.

## Verification Process

Throughout the project, human verification was performed manually:
1. Reviewing the frontend UI locally after each phase completion to ensure state changes matched requirements.
2. Clicking through the full end-to-end flow: creating a draft skill, publishing it, modifying it (to create a V2), and executing the skill.
3. Explicitly attempting to "break" the approval gate by modifying the URL or trying to test-run a write tool.
4. Reviewing the generated `INTERVIEW_PREP.md` rationales after each phase to ensure the technical decisions were defensible for a live interview.
