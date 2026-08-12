# INTERVIEW_PREP.md

*This is a living document. After each phase, a new dated entry is added with plain-English reasoning I can say out loud in an interview. No code blocks — just reasoning.*

---

## Phase 1 Entry — 2026-08-12

### What Was Built and Why

We built the scaffolding and the Skill management layer — think of it as the "definition" side of the platform. Before the agent can do anything intelligent, someone needs to define *what* the agent is allowed to do: which tools it can call, what the input and output should look like, and what instructions guide it. That's what a Skill is.

In this phase I set up the backend with Express and Mongoose, defined the Skill data model, and built CRUD endpoints with a publish flow. I also built a React frontend — nothing polished yet, just functional pages so the system is end-to-end usable from day one.

### The 2–3 Trickiest Design Decisions

**1. Why compile the JSON Schema rather than just checking if it's valid JSON?**
The requirement is that `inputSchema` and `outputSchema` must be valid JSON Schemas, not just valid JSON. Those are different things. `{"type": "badtype"}` is valid JSON but an invalid JSON Schema. I used AJV's `compile()` method, which actually processes the schema as a validator. If AJV can compile it, the schema is structurally sound. The alternative was AJV's `validateSchema()` which checks against the meta-schema — but `compile()` is stricter because it also catches schemas with bad `$ref` targets that pass meta-schema checks.

**2. Why is the tool registry hardcoded and not in the database?**
The problem statement says the tool surface is bounded on purpose — depth of correctness matters more than breadth. If tools were in the database, a user could add a new tool without going through a code review, which breaks the audit trail. Keeping it as a constant in code means adding a tool requires a deliberate code change. It's also simpler to reason about in interviews: "the system has exactly four tools and I can prove it by looking at one file."

**3. Why does publishing a skill NOT overwrite the old document?**
When a published skill needs to change, you create a new draft, edit it, and publish that draft as a new Skill document with `version + 1` and `previousVersionId` pointing at the old one. The old published document stays untouched in the database. This means execution history can always look up "what did version 2 of this skill look like" without any historical data being lost. If we overwrote the document, every execution record referencing the old version would effectively lose its schema definition.

### One Known Weak Point

The approval-required actions on a skill — right now `approvalRequiredActions` is just an array on the skill definition. There's no server enforcement that the entries in `approvalRequiredActions` are actually write tools — I check that they're in `allowedTools`, but theoretically someone could put `calculator` (a read-only tool) in `approvalRequiredActions`. That's harmless but slightly inconsistent. Phase 3 will handle the actual approval gate logic, which will only pause for genuinely write tools anyway.

### Why X Over Y

**Why Express over Fastify or Hapi?** Express has the broadest ecosystem and most interviewers will be familiar with it. For a 2-day build being judged by someone who needs to read the code quickly, familiarity matters more than performance.

**Why Vite over Create React App?** CRA is deprecated. Vite is the current standard for new React projects — faster dev server, native ESM, actively maintained.

**Why React Router over a file-based router?** The frontend is simple enough that a file-based router (like Next.js) would add overhead without benefit. React Router v6 is straightforward and already widely understood.

---

<!-- Phase 2 entry will be added after Phase 2 is verified. -->

---

## Phase 2 Entry — 2026-08-12

### What Was Built and Why

Phase 2 adds the actual tool implementations and the permission enforcement layer. Before this phase, the system could define skills but couldn't actually *do* anything with them. Now there are four real callable tools, a permission gate that runs before every tool call, and a read-only test-run endpoint where you can try a skill against sample input.

The four tools are: `calculator` (safe arithmetic), `docSearch` (keyword search over seeded product docs), `recordLookup` (structured record lookup by ID, type, or field), and `taskCreator` (the only write tool — creates a MockTask record). The test-run endpoint uses a keyword-based placeholder to decide which tool(s) to call — this is explicitly temporary and Phase 3 replaces it with real Gemini planning.

### The 2–3 Trickiest Design Decisions

**1. Why use mathjs for the calculator instead of eval()?**
`eval()` executes arbitrary JavaScript. If any part of the input ever reaches `eval()`, you have a remote code execution vulnerability. mathjs has its own expression parser that only understands mathematical operations — it can't import modules, read files, or access process. We also add a regex pre-check before even calling mathjs, so obviously non-math strings (like SQL injection attempts) are rejected at the gate. Defense in depth on a tool that, by design, evaluates expressions.

**2. Why is assertToolAllowed a standalone function rather than middleware?**
We need to call it from different contexts: inside the test-run endpoint, inside the execution loop (Phase 3), and potentially from other future routes. Express middleware runs per-request, but tool calls happen mid-request after we've already identified the skill. Making it a plain function that takes (skill, toolName, isApproved) means it can be called from anywhere without being coupled to the HTTP layer. The `isApproved` flag defaults to `false` — Phase 3 will explicitly pass `true` after the user approves a step.

**3. Why does taskCreator throw an error rather than just returning { output: null, error: "needs approval" }?**
An error object is the right abstraction here because the execution loop (Phase 3) needs to *distinguish* this case from a normal tool failure. If it returned a normal `{ output, error }` response, the loop would have to inspect the error string to figure out what happened — fragile. An `ApprovalRequiredError` instance lets Phase 3 use `instanceof ApprovalRequiredError` for a clean, type-safe branch. Similarly, `UnauthorizedToolError` is a distinct class so the loop can tell "this is a security violation, stop the run" vs "this tool needs approval, pause and ask the user."

### One Known Weak Point

The keyword-based tool selector in Phase 2 is genuinely dumb — it matches substrings in the instruction text. If the instructions say "do NOT search documents," it would still call `docSearch`. This is explicitly a placeholder and is documented as such in both the code and the API response. Phase 3 makes this completely irrelevant by replacing it with Gemini planning.

### Why X Over Y

**Why seeded hardcoded data for docSearch and recordLookup?** The project spec says the tool surface is bounded on purpose. Real search would require a vector database or Elasticsearch setup, which adds complexity without demonstrating the key concepts (permissions, approval, idempotency). Seeded arrays let us demonstrate the tool working correctly while keeping the infrastructure minimal. An interviewer asking "why not real search?" gets the answer: "the interesting parts of this system are the permission layer and execution control, not the search backend — we used a stub to keep focus."



---

## Phase 3 Entry — 2026-08-12

### What Was Built and Why

Phase 3 is the core engine of the project. It replaces the keyword-based placeholder with real Gemini-driven planning, introduces an async execution loop that actually runs the plan, and implements a pause-and-resume approval gate for write operations.

The system now creates an `ExecutionRun` record the moment execution begins. It calls Gemini (`gemini-3.6-flash`) to generate a structured JSON plan (an array of `{tool, toolInput, reasoning}`). The execution engine then loops through the plan. If it hits a read-only tool, it executes it. If it hits a write tool (like `taskCreator`), it pauses, sets the run status to `awaiting_approval`, and returns early. The user reviews the pending step in the UI, clicks "Approve", and the engine resumes execution from that exact step.

We also built `ExecutionView.jsx` — a live-updating trace UI that polls the backend until the run reaches a terminal state.

### The 2–3 Trickiest Design Decisions

**1. Why use responseMimeType="application/json" for planning?**
We need Gemini to act as a structured planner. If we just ask for text, we have to parse out code blocks or use a second LLM call to extract the JSON. By setting `responseMimeType: 'application/json'` and heavily tuning the system prompt to show exactly what tools are available and what inputs they take, we get deterministic, machine-readable steps. We fall back to a retry just in case, but it's much more stable than parsing markdown prose.

**2. Why embed the steps in the ExecutionRun document instead of using separate collections?**
Atomic updates and fast reads. The entire state of a run (its plan, which steps are done, the outputs, the current status) is in one document. When the UI polls for updates, we do a single `findById()`. When we pause for approval, we update the embedded array and `run.status` in one atomic `save()`.

**3. How does idempotency work on resume?**
When the plan is generated, we pre-compute a deterministic `idempotencyKey` for every write step (`hash(executionId + stepNumber + toolInput)`). We pass this key to the tool. The `MockTask` model uses it as a unique sparse index. If the system crashes right after `taskCreator` succeeds but before the engine can mark the step as "success", the user might try to approve/run it again. The database will reject the duplicate key, the engine sees the error, and we prevent duplicate tasks from being created.

### One Known Weak Point

The polling UI in `ExecutionView.jsx`. It polls every 2.5 seconds while the run is non-terminal. In a real-world high-traffic app, you'd want to use Server-Sent Events (SSE) or WebSockets to push updates from the execution engine directly to the client. We used polling here because it's vastly simpler to implement and debug for a take-home project, and the volume is exactly 1 user.

### Why X Over Y

**Why `gemini-3.6-flash` instead of a Pro model?**
For this specific task — reading a prompt and outputting a short JSON array — Flash is the perfect fit. It's incredibly fast, natively supports JSON output, and has "thinking" capabilities for reasoning. Pro would be slower without any noticeable improvement in the rigid JSON structure we require. Speed matters when the user is staring at a "Planning..." spinner.

---

## Phase 4 Entry — 2026-08-12

### What Was Built and Why

Phase 4 introduces version history, diff comparison, and audit logs. In a dynamic agent platform, it's not enough to know what a skill does *right now*—you have to know what it did *last Tuesday* when a critical execution ran. 

We added backend endpoints to traverse a skill's `previousVersionId` chain and compute structured JSON differences between two versions. On the frontend, the Skill Detail page now displays a Version History timeline, allowing users to explicitly execute older versions of a skill and view a side-by-side comparison of what changed between them. We also exposed the paginated execution history and a detailed Audit Log viewer for transparency.

### The 2–3 Trickiest Design Decisions

**1. Why is the "diff" logic computed on the backend instead of the frontend?**
We could have just sent both versions to the client and let React compute the diff. However, keeping it on the backend ensures the comparison logic is strictly bound to the data model. If we ever add a new field to the schema, we update the backend diff logic and all clients (API users, frontend) automatically get the correct diff structure. It also reduces payload size for large schemas since we only send the fields that actually changed (alongside the base documents).

**2. How do we execute an older version?**
Because every version is its own immutable `Skill` document in the database, the execution engine (`/api/skills/:id/execute`) inherently supports executing historical versions! The frontend simply calls the execute endpoint with the historical version's `_id`. The execution engine looks up the document, sees the old instructions and old `allowedTools`, and obeys them perfectly. No special "historical execution" logic was needed.

**3. Why walk the `previousVersionId` chain on the server for history, instead of just querying by `name`?**
Users might rename a skill in a draft. If we grouped versions by `name`, a renamed skill would suddenly break its history. The linked list approach (`previousVersionId`) guarantees we are looking at the exact cryptographic lineage of that specific skill, regardless of what cosmetic fields changed along the way.

### One Known Weak Point

The `GET /:id/versions` endpoint walks the linked list backwards using a while loop that performs `findById` on each step. For a skill with 5 versions, that's 5 sequential database queries. In a massive scale app, this would be an N+1 query problem. A better approach for production would be a recursive graph query (like `$graphLookup` in MongoDB) or storing a `lineageId` on all versions to fetch them in one query. But for < 50 versions, the sequential fetch is trivial and much simpler to implement.

### Why X Over Y

**Why not use a standard JSON Patch format for diffs?** JSON Patch (RFC 6902) returns operations like `[{ op: "replace", path: "/instructions", value: "new" }]`. While powerful for programmatic patching, it's terrible for UI rendering. Our custom diff object `{"field": {"old": x, "new": y}}` is specifically designed to be trivially mappable in a React component for a side-by-side view.

---

## Phase 5 Entry — 2026-08-12

### What Was Built and Why

Phase 5 focused on hardening the application for production. While the happy paths worked great, we needed to ensure the system gracefully handled edge cases, produced observable logs, and had polished UI states.

We introduced a lightweight structured JSON logger that replaced scattered `console.log` statements, ensuring every API request and critical agent workflow event (like a tool failing or a plan generating) logs in a consistent `{"timestamp", "level", "message", "meta"}` format. We also added UI loading states for the initial fetching of skills and gracefully handled Gemini API timeouts using `Promise.race`. Finally, we locked down skill deletions to prevent users from accidentally deleting skills that have execution history, which would otherwise corrupt the audit trail.

### The 2–3 Trickiest Design Decisions

**1. Why use a custom logger instead of Winston or Pino?**
For a take-home assignment, adding heavy logging dependencies can bloat the setup. A custom 15-line structured logger wrapper around `console.log` provides 90% of the value (searchable JSON format in Datadog/CloudWatch) with zero external dependencies, demonstrating an understanding of production observability without over-engineering.

**2. Why handle Gemini API timeouts manually?**
Sometimes LLM APIs hang indefinitely rather than throwing a clean 502/504 error. By wrapping the `model.generateContent(prompt)` call in a `Promise.race` with a 30-second timeout, we guarantee that the execution engine never gets stuck in the `planning` state forever. It cleanly fails the run, logs the timeout, and lets the user retry.

**3. Why block deleting skills with history instead of cascading the deletion?**
In an agent platform, the execution trace is an audit log. If a user deletes "Customer Support Skill V1", and the system cascades that deletion to all ExecutionRuns that used V1, we lose the historical record of *what the agent did and why*. Blocking the deletion of the Skill preserves the cryptographic integrity of the audit log.

### Likely Interview Questions & Answers

**Q: How does your idempotency mechanism actually work?**
A: When Gemini generates the plan, the backend assigns a deterministic hash to any write-tool step based on `hash(executionId + stepNumber + toolInput)`. This is passed to the tool as `idempotencyKey` and used as a unique index in the database. If the engine crashes after the tool writes to the DB but before marking the step as "success", a resumed execution will attempt to write the exact same record with the exact same key. The database throws a duplicate key error, which the tool catches and handles gracefully, preventing double-writes.

**Q: Why single-agent Gemini Flash instead of a multi-agent system?**
A: The problem constraints explicitly requested a rigid, schema-bound execution flow with human approval gates. Multi-agent systems excel at open-ended, ambiguous tasks (e.g. "research this company and write a report") but are overly complex and non-deterministic for structured data processing. Gemini Flash is extremely fast, supports forced JSON output, and handles the planning perfectly in a single call.

**Q: What is the biggest known limitation of this architecture?**
A: The frontend uses simple HTTP polling every 2.5 seconds to refresh the execution trace. While acceptable for a prototype, this would overwhelm the database and network in a high-traffic production app. I would replace this with Server-Sent Events (SSE) or WebSockets to push status updates from the execution engine directly to the client.
