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
