const { GoogleGenerativeAI } = require('@google/generative-ai');

const PLANNING_MODEL = 'gemini-2.5-flash';

let genAI;
const getClient = () => {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY environment variable is not set');
    genAI = new GoogleGenerativeAI(apiKey);
  }
  return genAI;
};

/**
 * TOOL_DESCRIPTIONS — what we tell the model about each tool.
 * These are injected into the planning prompt so the model knows
 * what inputs each tool expects.
 */
const TOOL_DESCRIPTIONS = {
  calculator: {
    purpose: 'Evaluate arithmetic expressions safely.',
    inputFormat: '{ "expression": "2 + 3 * 4" }',
    outputFormat: '{ "result": number, "expression": string }',
  },
  docSearch: {
    purpose: 'Search a product/QA document knowledge base by keyword.',
    inputFormat: '{ "query": "password reset", "limit": 3 }',
    outputFormat: '{ "results": [{ "id", "title", "body", "relevanceScore" }], "totalFound": number }',
  },
  recordLookup: {
    purpose: 'Look up structured records (customers, tasks, invoices) by ID, type, or field value.',
    inputFormat: '{ "id": "cust-001" } OR { "type": "customer" } OR { "field": "status", "value": "active" }',
    outputFormat: '{ "records": [...], "totalFound": number }',
  },
  taskCreator: {
    purpose: 'Create a new task record. WRITE ACTION — requires human approval before execution.',
    inputFormat: '{ "title": "Review Q3 invoices", "assignee": "user@example.com", "priority": "high", "dueDate": "2026-08-30" }',
    outputFormat: '{ "task": { "_id", "title", "status", ... }, "message": string }',
  },
};

/**
 * buildPlanningPrompt — constructs the system prompt for the Gemini planning call.
 *
 * Design: we ask for ONLY JSON (no prose) to make parsing reliable.
 * The model sees: skill instructions, examples, available tools with their schemas, and user input.
 * It returns a JSON array of steps capped at maxSteps.
 *
 * Why structured JSON and not free text?
 * Free text plans require another LLM call to extract actions. JSON plans can be
 * parsed deterministically — no ambiguity about what tool to call or what to pass it.
 */
const buildPlanningPrompt = (skill, userInput) => {
  const toolDocs = skill.allowedTools
    .map((toolName) => {
      const desc = TOOL_DESCRIPTIONS[toolName];
      if (!desc) return `- ${toolName}: (no description available)`;
      return [
        `- ${toolName}:`,
        `    Purpose: ${desc.purpose}`,
        `    Input format: ${desc.inputFormat}`,
        `    Output format: ${desc.outputFormat}`,
        skill.approvalRequiredActions?.includes(toolName)
          ? '    ⚠️ REQUIRES HUMAN APPROVAL before execution.'
          : '',
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n\n');

  const examplesText =
    skill.examples && skill.examples.length > 0
      ? `\nExamples of expected behavior:\n${skill.examples
          .map(
            (ex, i) =>
              `Example ${i + 1}:\n  Input: ${JSON.stringify(ex.input)}\n  Output: ${JSON.stringify(ex.output)}`
          )
          .join('\n')}`
      : '';

  return `You are a planning agent. Given a skill definition and user input, produce a JSON execution plan.

SKILL NAME: ${skill.name}
SKILL INSTRUCTIONS: ${skill.instructions}
${examplesText}

AVAILABLE TOOLS:
${toolDocs}

USER INPUT: ${JSON.stringify(userInput)}

Produce a plan with AT MOST ${skill.maxSteps || 10} steps.

RESPOND WITH ONLY a valid JSON array. No prose, no markdown, no code fences. Just the raw JSON array.

Each element must have exactly these keys:
- "tool": one of [${skill.allowedTools.join(', ')}]
- "toolInput": the input object to pass to the tool (must match the tool's input format)
- "reasoning": a brief explanation of why this step is needed

Example response format:
[
  {"tool": "docSearch", "toolInput": {"query": "password reset"}, "reasoning": "Find relevant documentation about the user's query"},
  {"tool": "taskCreator", "toolInput": {"title": "Follow up with user"}, "reasoning": "Create a follow-up task based on the findings"}
]

IMPORTANT:
- Only use tools from the AVAILABLE TOOLS list
- Match toolInput exactly to each tool's input format
- Keep the plan focused and minimal — don't add unnecessary steps`;
};

/**
 * generatePlan — calls Gemini with the planning prompt and parses the response.
 *
 * Retries once if the model returns invalid JSON or an array with wrong shape.
 * After two failures, throws so the execution engine can fail the run gracefully.
 */
const generatePlan = async (skill, userInput) => {
  const client = getClient();
  const model = client.getGenerativeModel({
    model: PLANNING_MODEL,
    generationConfig: {
      temperature: 0.2,          // Low temp for deterministic, structured output
      responseMimeType: 'application/json', // Force JSON output mode
    },
  });

  const prompt = buildPlanningPrompt(skill, userInput);

  let lastError;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text().trim();

      // Strip markdown code fences if the model adds them despite the instruction
      const cleaned = text
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim();

      const parsed = JSON.parse(cleaned);

      if (!Array.isArray(parsed)) {
        throw new Error(`Plan must be a JSON array, got: ${typeof parsed}`);
      }

      // Validate each step shape
      const validSteps = parsed.filter((step) => {
        return (
          step &&
          typeof step.tool === 'string' &&
          step.toolInput !== undefined &&
          typeof step.reasoning === 'string'
        );
      });

      if (validSteps.length === 0 && parsed.length > 0) {
        throw new Error('No steps in plan have the required shape {tool, toolInput, reasoning}');
      }

      // Enforce maxSteps cap
      return validSteps.slice(0, skill.maxSteps || 10);
    } catch (err) {
      lastError = err;
      if (attempt < 2) {
        console.warn(`[Planner] Attempt ${attempt} failed: ${err.message}. Retrying…`);
      }
    }
  }

  throw new Error(`Planning failed after 2 attempts: ${lastError.message}`);
};

/**
 * synthesizeFinalOutput — second Gemini call to format the step results
 * according to the skill's outputSchema.
 */
const synthesizeFinalOutput = async (skill, userInput, stepResults) => {
  const client = getClient();
  const model = client.getGenerativeModel({
    model: PLANNING_MODEL,
    generationConfig: {
      temperature: 0.3,
      responseMimeType: 'application/json',
    },
  });

  const resultsText = stepResults
    .map(
      (s, i) =>
        `Step ${i + 1} (${s.tool}): ${s.status === 'success' ? JSON.stringify(s.toolOutput) : `FAILED: ${s.error}`}`
    )
    .join('\n');

  const prompt = `You are a synthesis agent. Given the results of tool calls, produce a final output that matches the skill's expected output schema.

SKILL: ${skill.name}
USER INPUT: ${JSON.stringify(userInput)}
OUTPUT SCHEMA: ${JSON.stringify(skill.outputSchema)}

TOOL RESULTS:
${resultsText}

Respond with ONLY a JSON object matching the output schema. No prose, no markdown.`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const cleaned = text
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();
    return JSON.parse(cleaned);
  } catch {
    // Fallback: return raw step results if synthesis fails
    return {
      synthesisError: 'Could not synthesize final output — returning raw step results',
      stepResults,
    };
  }
};

module.exports = { generatePlan, synthesizeFinalOutput };
