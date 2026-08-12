# Dynamic User-Defined Skills Agent Platform — Build Plan

**Candidate:** Abhishek Kumar
**Stack:** Node.js + Express + MongoDB (Mongoose) · React (Vite) · Gemini API (agent runtime) · Vercel (frontend) + Render (backend)
**Timeline:** 2 days, 5 phases
**Coding agent:** Antigravity-integrated Claude does the implementation; Abhishek reviews, understands, and approves every diff before commit.

---

## 0. How to use this document

Each phase below has five parts:

1. **Goal** — what "done" looks like for that phase
2. **Build tasks** — what Antigravity Claude will implement
3. **Prompt for Antigravity Claude** — paste this in, adjust the `[bracketed]` bits
4. **What YOU must personally verify** — don't move to the next phase until you can explain these out loud, unprompted
5. **Commits** — real, incremental, honest. Commit after each verified chunk, not one giant commit at the end.

Every phase ends with the same standing instruction to Antigravity Claude: update `INTERVIEW_PREP.md`. That file is your second brain for the interview — keep it growing daily, don't leave it for the end.

---

## 1. Data model (decide once, reference everywhere)

```js
// Skill
{
  _id, name, purpose,
  inputSchema: {},      // JSON Schema
  outputSchema: {},      // JSON Schema
  instructions: String,   // system prompt fragment for this skill
  examples: [{ input, output }],
  allowedTools: [String], // subset of ['calculator','docSearch','recordLookup','taskCreator']
  approvalRequiredActions: [String], // e.g. ['taskCreator']
  maxSteps: Number,
  status: 'draft' | 'published',
  version: Number,
  previousVersionId: ObjectId | null,
  createdAt, updatedAt
}

// ExecutionRun
{
  _id, skillId, skillVersion, input,
  status: 'planning' | 'awaiting_approval' | 'running' | 'completed' | 'failed' | 'cancelled',
  plan: [String],                     // model's stated step plan
  steps: [{
    stepNumber, tool, toolInput, toolOutput,
    requiresApproval: Boolean,
    approvalStatus: 'n/a' | 'pending' | 'approved' | 'rejected',
    approvedBy, approvedAt,
    status: 'pending' | 'success' | 'failed' | 'retried' | 'skipped',
    error, retryCount,
    idempotencyKey                    // hash of (skillId, executionId, stepNumber, toolInput)
  }],
  finalOutput,
  error,
  createdAt, completedAt
}

// AuditLog (append-only)
{ _id, executionId, actorType: 'system'|'user', action, detail, timestamp }
```

Idempotency: before executing a write-tool step, check `idempotencyKey` hasn't already succeeded for this execution. This is the mechanism that satisfies "prevent duplicate execution of an approved write action."

---

## 2. Tool registry (bounded, hardcoded — not user-extensible)

| Tool | Type | Notes |
|---|---|---|
| `calculator` | read-only | safe eval of arithmetic expressions only |
| `docSearch` | read-only | keyword search over a small seeded doc set (JSON/array is fine) |
| `recordLookup` | read-only | lookup against a small seeded "structured records" collection |
| `taskCreator` | **write** | creates a mock task record — this is the one that needs approval |

Keep the tool surface small on purpose. Depth of correctness (permissions, approval, idempotency, history) matters more than tool count for scoring.

---

## Day 1

### Phase 1 — Scaffolding, Skill schema, validation, draft/publish

**Goal:** A running Express + MongoDB backend and a React shell, with full CRUD for Skills including JSON-Schema validation of `inputSchema`/`outputSchema`, and draft→published versioning logic.

**Build tasks**
- Repo scaffold: `/server` (Express, Mongoose, dotenv, basic error-handling middleware, request logging), `/client` (Vite + React)
- `Skill` model + Mongoose schema
- POST `/skills` (create draft), PUT `/skills/:id` (edit while draft only), POST `/skills/:id/publish` (freezes it, bumps version, locks edits)
- Validation: reject a skill definition whose `inputSchema`/`outputSchema` isn't valid JSON Schema (use `ajv`), and reject if `allowedTools` references a tool not in the registry
- Basic skill list/detail UI in React (no styling polish yet)
- `.env.example`, `README.md` skeleton, `AGENT_USAGE.md` skeleton, `INTERVIEW_PREP.md` created

**Prompt for Antigravity Claude**
```
We're building "Dynamic User-Defined Skills Agent Platform" — Node.js/Express/MongoDB backend,
React (Vite) frontend, deployed later to Render + Vercel.

Scaffold the repo with /server and /client folders. In /server, set up Express with Mongoose,
dotenv config, a centralized error-handling middleware, and morgan-style request logging.

Implement a Skill model with this schema: [paste schema from section 1].

Build these endpoints:
- POST /api/skills — create a new skill as status "draft". Validate inputSchema and outputSchema
  as valid JSON Schema using ajv; reject with 400 and a clear message if invalid. Validate that
  every entry in allowedTools exists in a hardcoded TOOL_REGISTRY = ['calculator','docSearch',
  'recordLookup','taskCreator']; reject unknown tools.
- GET /api/skills, GET /api/skills/:id
- PUT /api/skills/:id — only allowed if status is "draft"; return 409 if published.
- POST /api/skills/:id/publish — sets status to "published", locks further edits, sets version=1
  if it's the first publish, or increments if this is a republish of an edited draft that
  references a previousVersionId.

Write basic Jest tests for the validation logic (bad JSON Schema, unknown tool, edit-after-publish
rejection).

In /client, scaffold a minimal React app with a skill list page and a create/edit skill form
(plain form fields, no styling polish needed yet — functionality first).

Also create these three files at repo root with the following skeletons:
1. README.md — sections: Overview, Architecture, Setup, Completed Scope, Intentionally Excluded
   Scope, Tests, Known Limitations, Deployment. Leave content as TODO placeholders for now except
   Setup, which should be accurate to what you just built.
2. AGENT_USAGE.md — sections: Tools Used, Representative Prompts, Work Delegated to Agents,
   Notable Agent Mistakes/Rejected Suggestions, Verification Process. Add today's entry: what you
   (Antigravity Claude) just built in this session, verbatim summary of this prompt, and leave a
   placeholder for me to add my own verification notes.
3. INTERVIEW_PREP.md — this is a living document I will use to prepare for a technical interview
   about this project. After EVERY phase of this build (I'll tell you when a phase is done), add
   a dated entry summarizing: (a) what was built and why, in plain conversational language I could
   say out loud, (b) the 2-3 trickiest design decisions and the reasoning behind them, (c) one
   thing that could be challenged or is a known weak point, (d) plain-English answers to "why did
   you choose X over Y" for any non-obvious choice made this phase. Write for someone explaining
   this in an interview, not for a code reviewer — no code blocks, just reasoning in plain English.
   Update it now with today's Phase 1 entry.

Do not implement the agent execution engine yet — that's Phase 3. Stop after skill CRUD +
validation + publish flow works end to end.
```

**What YOU must personally verify before committing**
- Can you explain, without looking at code, why `PUT` is blocked once a skill is published (this is the same "block illegal state transitions" pattern from TrustFlow — say that out loud to yourself)
- Open the ajv validation code and confirm you understand what makes a JSON Schema "invalid" — try breaking it manually in the running app
- Confirm the Mongoose schema actually matches section 1 of this doc, and that you'd have designed the fields the same way
- Run the Jest tests yourself, read what each one asserts

**Commits (today)**
1. `chore: scaffold server + client, base Express/Mongoose setup`
2. `feat: Skill model + CRUD endpoints with JSON Schema and tool-registry validation`
3. `feat: draft/publish versioning flow + basic skill list/form UI`

---

### Phase 2 — Tool registry + permission enforcement + read-only test-run

**Goal:** The four tools exist as real callable functions. A skill can be "test run" against sample input in a mode that only exercises read-only tools, and the system refuses to call any tool not in that skill's `allowedTools`.

**Build tasks**
- Implement the 4 tools as pure functions with a consistent interface: `(input) => { output, error }`
- `taskCreator` writes to a `MockTask` collection — implement it now, but don't allow it to be called without approval (approval flow comes in Phase 3; for now, block it entirely in test-run mode with a clear "requires approval — not available in read-only test run" message)
- Permission check layer: given a skill and a requested tool name, throw a typed `UnauthorizedToolError` if the tool isn't in `allowedTools`
- POST `/api/skills/:id/test` — accepts sample input, runs it through validation against `inputSchema`, and (for now) just executes any read-only tool calls the skill's `instructions` reference directly (hardcode a simple keyword-based "which tool to call" for this phase — real LLM planning comes in Phase 3, don't build the agent loop yet)
- Frontend: a "Test Skill" panel showing sample input, tool calls made, and results

**Prompt for Antigravity Claude**
```
Continuing the Skills Agent Platform. Implement the four sandboxed tools as pure functions in
/server/tools/:
- calculator(input): safely evaluate arithmetic expressions only (no eval() of arbitrary JS —
  use mathjs or a restricted parser). Reject anything that isn't a number/operator expression.
- docSearch(input): keyword search over a small seeded array of ~10 fake "QA/product docs"
  (title + body). Return matches with a naive relevance score.
- recordLookup(input): lookup against a small seeded array of ~10 fake structured records
  (e.g. mock customer/task records) by id or field match.
- taskCreator(input): writes a new document to a MockTask collection. This is a WRITE tool.

Build a permission layer: a function `assertToolAllowed(skill, toolName)` that throws
UnauthorizedToolError if toolName isn't in skill.allowedTools. Every tool call anywhere in the
system must go through this check first — no exceptions.

For taskCreator specifically: for now, make it throw a clear ApprovalRequiredError whenever it's
invoked outside of an explicitly-approved execution context (we'll wire up real approval in
Phase 3). Read-only tools (calculator, docSearch, recordLookup) can run freely if permitted.

Build POST /api/skills/:id/test — accepts { sampleInput }, validates it against the skill's
inputSchema, and does a SIMPLE keyword match against skill.instructions to decide which read-only
tool(s) to call (e.g. if instructions mention "calculate", call calculator). This is a stand-in —
tell me explicitly in your response that this is temporary and Phase 3 replaces it with real LLM
planning, so I don't mistake this for the final agent logic.

Add a "Test Skill" panel to the frontend showing: sample input entered, which tool(s) were called,
their inputs/outputs, and any errors (including ApprovalRequiredError for taskCreator, displayed
as "this action requires approval").

Write Jest tests: permission check blocks an unauthorized tool call; taskCreator blocks without
approval context; calculator rejects non-arithmetic input.

Update INTERVIEW_PREP.md with a Phase 2 entry per the format established in Phase 1.
```

**What YOU must personally verify**
- Read `assertToolAllowed` and trace one full call path from API request to tool execution — make sure YOU could add a 5th tool yourself without help
- Confirm you understand why the keyword-based tool selection here is a placeholder, and be ready to explain the real planning approach coming in Phase 3
- Test the permission check by manually trying to call a tool not in a skill's `allowedTools` via Postman/curl — confirm it's actually rejected server-side, not just hidden in the UI

**Commits (today)**
4. `feat: implement 4 sandboxed tools with permission-gated execution`
5. `feat: test-run endpoint (placeholder tool-selection) + test-run UI panel`

---

### Phase 3 — Real agent execution engine (LLM planning, approval gate, idempotency)

**Goal:** This is the heart of the project. Replace the keyword placeholder with real Gemini-driven planning: given a skill + input, the model proposes a step plan, calls only permitted tools, execution pauses for human approval before any write action, and the full trace (plan, tool calls, results, final output) is visible.

**Build tasks**
- `ExecutionRun` model (section 1)
- Gemini integration: a planning prompt that receives the skill's `instructions`, `examples`, `allowedTools` (with their input/output schemas), and the user's input; asks the model to return a structured plan (JSON: ordered list of `{tool, toolInput, reasoning}` steps) capped at `maxSteps`
- Execution loop: iterate the plan, before each step check `assertToolAllowed`; if the tool is in `approvalRequiredActions`, set the step to `awaiting_approval` and pause the whole run
- Approval endpoint: POST `/api/executions/:id/steps/:stepNumber/approve` and `/reject`
- Idempotency: generate `idempotencyKey` per write step; before executing, check no prior step with the same key succeeded in this execution
- Live trace UI: show plan → step-by-step tool calls → pending approval banner with approve/reject buttons → final output
- Structured logs (plan generated, each tool call, each approval decision) written to `AuditLog`

**Prompt for Antigravity Claude**
```
This is the core of the project. Replace the Phase 2 placeholder tool-selection with a real
agent execution engine using the Gemini API.

Implement ExecutionRun model: [paste schema from section 1].

Build POST /api/skills/:id/execute — accepts { input }. Steps:
1. Validate input against the skill's inputSchema.
2. Call Gemini with a planning prompt containing: the skill's instructions, its examples, the
   list of allowedTools with each tool's purpose/input format, and the user's input. Ask it to
   return ONLY a JSON array of steps: [{ tool, toolInput, reasoning }], capped at maxSteps items.
   Reject/retry once if the model returns something that doesn't parse as valid JSON matching
   this shape.
3. Persist the plan to a new ExecutionRun with status "planning" -> "running".
4. Execute steps in order. Before each: call assertToolAllowed. If the tool is in
   skill.approvalRequiredActions, set that step's approvalStatus to "pending", set the whole
   run's status to "awaiting_approval", and STOP the loop — do not proceed until approved.
5. For write-tool steps (currently just taskCreator), generate idempotencyKey = hash(executionId,
   stepNumber, JSON.stringify(toolInput)). Before executing, check no step in this execution
   already succeeded with this exact key — if so, skip execution and reuse the prior result
   (log this explicitly as a skipped-duplicate).
6. On tool failure: retry once automatically, then mark the step failed and stop the run with
   status "failed" if it was a required step. Log every attempt.
7. On completion, synthesize a final output from all step results (a second short Gemini call
   summarizing/ formatting the outputs according to the skill's outputSchema is fine) and set
   status "completed".

Build POST /api/executions/:id/steps/:stepNumber/approve and .../reject — approve resumes the
loop from that step; reject marks the run "failed" with reason, does not execute that step.

Build POST /api/executions/:id/cancel — stops a running/awaiting_approval execution.

Write every plan-generation, tool-call, approval decision, and error to the AuditLog collection.

Frontend: an execution view showing the plan as a checklist, each step's tool/input/output as
it completes, a clear "Approval Required" banner with Approve/Reject buttons when a run pauses,
and the final output once complete. Show run status prominently (planning/running/
awaiting_approval/completed/failed/cancelled).

Write Jest tests for: idempotency (calling the same write step twice doesn't duplicate),
approval-gate blocking a write tool without approval, max-steps enforcement, retry-then-fail
behavior on a forced tool failure.

Update INTERVIEW_PREP.md with a Phase 3 entry. This phase is the most likely to get hard
interview questions — make sure the entry covers: why the plan is generated as structured JSON
rather than free text, how idempotency is actually enforced (walk through the key derivation),
and what happens if Gemini returns a plan that references a disallowed tool (should be rejected
server-side even though the prompt already restricts allowedTools to the model — defense in depth).
```

**What YOU must personally verify — this is the phase to slow down on**
- Read the planning prompt Antigravity Claude wrote and rewrite at least one part of it yourself so it's genuinely yours
- Trace the approval-pause logic manually: force a run to hit `taskCreator`, confirm it actually stops and doesn't silently proceed
- Manually test idempotency: call approve twice on the same step (simulate a double-click) and confirm via the DB that only one `MockTask` was created
- Understand the "defense in depth" point above cold — an interviewer will likely ask "what if the model tries to call a tool it's not supposed to?" and your answer needs to be "server checks it regardless of what the model does," not "the prompt tells it not to"
- Deliberately break something (disconnect Gemini API key, kill mid-execution) and watch the failure/retry/audit-log path work

**Commits (today, end of day 1)**
6. `feat: ExecutionRun model + Gemini-driven planning`
7. `feat: step-by-step execution loop with approval gate and idempotent write handling`
8. `feat: execution trace UI + approve/reject/cancel controls`

---

## Day 2

### Phase 4 — History, versioning, comparison, rerun

**Goal:** Every skill version, every execution, every approval, and every error is queryable. You can diff two versions of a skill and rerun an old version against new input.

**Build tasks**
- GET `/api/skills/:id/versions` — full version chain via `previousVersionId`
- GET `/api/skills/:id/versions/compare?from=&to=` — field-level diff (name/instructions/tools/schemas changed)
- POST `/api/skills/versions/:versionId/rerun` — execute a specific historical version, not just the latest
- GET `/api/executions?skillId=&status=` — execution history with filters
- GET `/api/executions/:id/audit-log` — full audit trail for one run
- Frontend: version history timeline, diff view, "rerun this version" button, execution history table with status filters, audit log viewer per execution

**Prompt for Antigravity Claude**
```
Building on the existing Skill/ExecutionRun models, implement version history and comparison.

When a draft is republished after edits, don't overwrite the old published version — create a
NEW Skill document with version = previous + 1 and previousVersionId pointing at the prior one.
[If Phase 1 didn't already do this, implement it now; if it did, just verify and extend it.]

Build:
- GET /api/skills/:id/versions — walk the previousVersionId chain, return all versions oldest
  to newest.
- GET /api/skills/versions/compare?from=<id>&to=<id> — return a field-level diff: which of
  name/purpose/instructions/inputSchema/outputSchema/allowedTools/approvalRequiredActions/
  maxSteps changed, with old and new values.
- POST /api/skills/versions/:versionId/execute — same execution engine as Phase 3, but pinned
  to that specific historical version's definition, not necessarily the latest published one.
- GET /api/executions?skillId=&status=&page= — paginated execution history with status filter.
- GET /api/executions/:id/audit-log — full ordered AuditLog entries for one execution.

Frontend additions: a version history timeline on the skill detail page, a diff view between any
two versions, a "rerun this version" action, and an execution history table (filterable by
status) with a link into each execution's full trace + audit log.

Write Jest tests: version chain integrity after 3 sequential edits/republishes, diff correctness
between two versions with a schema change, rerun executing against the OLD version's tool
permissions (not the current published version's).

Update INTERVIEW_PREP.md with a Phase 4 entry, including how the diff logic works and why rerun
targets a specific version rather than always the latest.
```

**What YOU must personally verify**
- Manually create 3 versions of one skill, republish twice, and confirm the version chain and diff view are actually correct — don't trust the tests alone, look at the data
- Confirm rerun of an old version genuinely uses that version's `allowedTools`, not the current published one (this is an easy place for a subtle bug, and a sharp interviewer will ask about it)

**Commits (tomorrow)**
9. `feat: version history chain + diff comparison`
10. `feat: rerun historical skill version + execution history/audit-log views`

---

### Phase 5 — Hardening, tests, logging polish, deployment, docs finalization

**Goal:** Deployed, working, documented, and defensible.

**Build tasks**
- Loading/empty/validation/success/failure states across all frontend views (skill list empty state, execution loading spinner, validation error surfaces, etc.)
- Structured backend logging (consistent log shape: timestamp, level, requestId, message) — doesn't need to be fancy, just consistent
- Fill in any remaining Jest tests for gaps found during your own manual review
- Deploy: MongoDB Atlas (free tier) → Render (backend) → Vercel (frontend); set env vars on both platforms including `GEMINI_API_KEY`
- Finalize `README.md` — architecture diagram (even a simple text/mermaid one), completed vs. intentionally-excluded scope (be honest: e.g. "only 4 tools by design, not extensible at runtime — see README for reasoning"), how to run tests, known limitations, deployment link
- Finalize `AGENT_USAGE.md` — real representative prompts (link back to this document if useful), at least one real agent mistake and how you caught/fixed it, your verification process described honestly
- Final pass on `INTERVIEW_PREP.md` — reconcile it against what actually got built vs. what was planned, since a few things likely shifted

**Prompt for Antigravity Claude**
```
Final hardening pass on the Skills Agent Platform before deployment.

1. Audit every frontend view (skill list, skill form, test-run panel, execution trace, version
   history, execution history) and add explicit loading, empty, validation-error, success, and
   failure states wherever missing. List which views you changed.

2. Standardize backend logging: every request should log { timestamp, level, requestId, method,
   path, durationMs } on completion, and every agent-workflow event (plan generated, tool called,
   approval requested/given, step failed) should log through the same structured logger, not
   console.log scattered around.

3. Review the codebase for edge cases we haven't tested: what happens on a Gemini API timeout
   mid-execution, what happens if a skill is deleted while it has execution history, what happens
   if inputSchema validation passes but the actual input still breaks a tool. Add handling and
   tests for whichever of these are realistic gaps — tell me which ones you found and fixed.

4. Prepare for deployment: confirm .env.example is complete and accurate, add a render.yaml or
   equivalent if useful, confirm CORS is configured for the Vercel frontend origin, confirm
   MongoDB connection handles reconnection gracefully.

5. Write the full README.md: Overview, Architecture (with a simple mermaid diagram of
   Skill -> ExecutionRun -> Tool flow and the approval gate), Setup, Completed Scope,
   Intentionally Excluded Scope (be explicit and honest about what's out of scope and why —
   e.g. tool registry is fixed/not user-extensible by design, single-model planning rather than
   multi-agent, etc.), How to Run Tests, Known Limitations, Deployment link.

6. Do a final honest pass on AGENT_USAGE.md: list the actual tools used across this project,
   3-5 representative prompts actually used (pull from our real session history, not invented
   ones), at least one real mistake you (the agent) made this build and how it was caught and
   fixed, and describe the human verification process honestly.

7. Do a final INTERVIEW_PREP.md pass: go back through every phase entry and reconcile it against
   what was ACTUALLY built by the end (note anywhere the plan changed), then add a top-level
   "likely interview questions and how to answer them" section covering: architecture decisions,
   the approval/idempotency mechanism, testing approach, known limitations, and how AI tools were
   used and verified.

Report back a clear list of what changed in this pass so I can review each item individually
before I commit.
```

**What YOU must personally verify**
- Actually click through the deployed app end to end as a stranger would, including a failure path (bad input, a rejected approval, a cancelled run)
- Read the final README and AGENT_USAGE out loud once — if any sentence describes something you can't personally explain, flag it and either learn it or cut it
- Confirm the "intentionally excluded scope" section is genuinely true, not just face-saving language
- Read the full INTERVIEW_PREP.md top to bottom; this is your actual interview prep material now

**Commits (tomorrow)**
11. `fix: loading/empty/error states across frontend`
12. `feat: structured logging + edge-case handling`
13. `chore: deployment config (Render/Vercel/CORS/Mongo)`
14. `docs: finalize README, AGENT_USAGE, INTERVIEW_PREP`

---

## Submission checklist (map back to the email's exact requirements)

- [ ] Selected option stated: B (Hard, weight 2.0)
- [ ] Live app link (Vercel) — confirmed working when you send it, not just at some point earlier
- [ ] GitHub repo link — public or shared as required; problem statement text NOT reproduced verbatim in the repo per their instruction
- [ ] README.md complete
- [ ] AGENT_USAGE.md complete and honest
- [ ] .env.example present, no real secrets committed anywhere in history (check `git log -p` for accidental key commits, not just the current file state)
- [ ] Test credentials/sample input included in your reply email remarks if the reviewer needs to log in or needs specific sample data to exercise the agent flow
- [ ] Gemini API key funded/active at review time — the assignment states the AI functionality must be operational when reviewed, so don't let a free-tier key run out before then

## If time runs short

Cut in this order, and say so explicitly in README's "Intentionally Excluded Scope":
1. Version comparison diff view (keep version history list, drop the diff UI)
2. Rerun-of-old-version (keep current-version execution only)
3. Retry logic on tool failure (keep clear failure state, drop auto-retry)

Do not cut: approval gate before write actions, idempotency, or the execution trace visibility — these three are the parts the problem statement calls out most specifically, and a working medium-quality version of all of B beats a polished partial with a load-bearing piece missing.
