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

