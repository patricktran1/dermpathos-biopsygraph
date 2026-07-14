import { createFileRoute } from "@tanstack/react-router";
import { AgentRequestSchema, EVENT_TOOL_NAMES, type AgentTraceEntry, type EhrToolResult } from "@/lib/event-stack/contracts";
import { createEhrAdapter } from "@/lib/event-stack/openemr";

const WRITE_TOOLS = new Set<string>([
  EVENT_TOOL_NAMES.createTask,
  EVENT_TOOL_NAMES.draftPatientCommunication,
  EVENT_TOOL_NAMES.createServiceRequest,
]);

const tools = [
  {
    name: EVENT_TOOL_NAMES.searchEvidence,
    description:
      "Search the connected EHR for existing tasks, patient communications, service requests, appointments, and completed procedure evidence before proposing action.",
    strict: true,
    input_schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        obligationType: { type: "string" },
      },
      required: ["obligationType"],
    },
  },
  {
    name: EVENT_TOOL_NAMES.createTask,
    description:
      "Create an accountable clinic task. This is a write action and must remain blocked until the user explicitly approves it.",
    strict: true,
    input_schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        title: { type: "string" },
        priority: { type: "string", enum: ["routine", "urgent", "asap", "stat"] },
        description: { type: "string" },
      },
      required: ["title", "priority", "description"],
    },
  },
  {
    name: EVENT_TOOL_NAMES.draftPatientCommunication,
    description:
      "Create a clinician-reviewable patient communication draft. Never send a message autonomously.",
    strict: true,
    input_schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        subject: { type: "string" },
        body: { type: "string" },
      },
      required: ["subject", "body"],
    },
  },
  {
    name: EVENT_TOOL_NAMES.createServiceRequest,
    description:
      "Create a draft treatment or referral request using the verified diagnosis and site. This is a write action requiring approval.",
    strict: true,
    input_schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        service: { type: "string" },
        reason: { type: "string" },
        bodySite: { type: "string" },
      },
      required: ["service", "reason"],
    },
  },
  {
    name: EVENT_TOOL_NAMES.verifyClosure,
    description:
      "Reconcile EHR evidence against explicit closure requirements. This is read-only and cannot itself mark a case closed.",
    strict: true,
    input_schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        requiredEvidence: {
          type: "array",
          items: { type: "string" },
          minItems: 1,
          maxItems: 8,
        },
      },
      required: ["requiredEvidence"],
    },
  },
] as const;

type ToolUseBlock = {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
};

type TextBlock = { type: "text"; text: string };
type ClaudeBlock = ToolUseBlock | TextBlock | Record<string, unknown>;

function blockedWrite(tool: string): EhrToolResult {
  return {
    ok: false,
    tool,
    mode: "mock",
    writeAttempted: false,
    approvalRequired: true,
    blockedReason: "Explicit user approval is required before this EHR write can execute.",
    summary: "Write action proposed but not executed.",
  };
}

async function executeTool(
  name: string,
  input: Record<string, unknown>,
  context: {
    patientId: string;
    encounterId: string;
    approvedActionIds: string[];
    forceMockEhr: boolean;
  },
): Promise<EhrToolResult> {
  const adapter = createEhrAdapter(context.forceMockEhr);
  const approved =
    context.approvedActionIds.includes("*") || context.approvedActionIds.includes(name);
  if (WRITE_TOOLS.has(name) && !approved) {
    return { ...blockedWrite(name), mode: adapter.mode };
  }

  switch (name) {
    case EVENT_TOOL_NAMES.searchEvidence:
      return adapter.searchEvidence({
        patientId: context.patientId,
        encounterId: context.encounterId,
        obligationType: String(input.obligationType ?? "clinical-follow-up"),
      });
    case EVENT_TOOL_NAMES.createTask:
      return adapter.createTask({
        patientId: context.patientId,
        encounterId: context.encounterId,
        title: String(input.title ?? "Clinical follow-up"),
        priority: ["routine", "urgent", "asap", "stat"].includes(String(input.priority))
          ? (String(input.priority) as "routine" | "urgent" | "asap" | "stat")
          : "urgent",
        description: String(input.description ?? "Review and close the clinical obligation."),
      });
    case EVENT_TOOL_NAMES.draftPatientCommunication:
      return adapter.draftPatientCommunication({
        patientId: context.patientId,
        encounterId: context.encounterId,
        subject: String(input.subject ?? "Important result follow-up"),
        body: String(input.body ?? "Please contact the clinic to discuss your result."),
      });
    case EVENT_TOOL_NAMES.createServiceRequest:
      return adapter.createServiceRequest({
        patientId: context.patientId,
        encounterId: context.encounterId,
        service: String(input.service ?? "Definitive treatment planning"),
        reason: String(input.reason ?? "Clinically significant result requires follow-up."),
        bodySite: typeof input.bodySite === "string" ? input.bodySite : undefined,
      });
    case EVENT_TOOL_NAMES.verifyClosure:
      return adapter.verifyClosure({
        patientId: context.patientId,
        encounterId: context.encounterId,
        requiredEvidence: Array.isArray(input.requiredEvidence)
          ? input.requiredEvidence.map(String)
          : ["Patient notified", "Definitive care completed"],
      });
    default:
      return {
        ok: false,
        tool: name,
        mode: adapter.mode,
        writeAttempted: false,
        approvalRequired: false,
        blockedReason: "Unknown tool requested.",
        summary: `Unknown tool: ${name}`,
      };
  }
}

async function runDeterministicFallback(
  request: ReturnType<typeof AgentRequestSchema.parse>,
  reason: string,
) {
  const encounter = request.encounter;
  const context = {
    patientId: encounter.patientId,
    encounterId: encounter.encounterId,
    approvedActionIds: request.approvedActionIds,
    forceMockEhr: request.forceMockEhr,
  };
  const planned = [
    {
      name: EVENT_TOOL_NAMES.searchEvidence,
      input: { obligationType: "malignant pathology follow-up" },
    },
    {
      name: EVENT_TOOL_NAMES.createTask,
      input: {
        title: "Urgent malignant pathology follow-up",
        priority: "stat",
        description:
          "Review the pathology result, contact the patient, and coordinate definitive treatment.",
      },
    },
    {
      name: EVENT_TOOL_NAMES.draftPatientCommunication,
      input: {
        subject: "Please contact the clinic about your pathology result",
        body:
          "Your clinician has reviewed an important pathology result and would like to speak with you promptly. Please contact the clinic today.",
      },
    },
    {
      name: EVENT_TOOL_NAMES.createServiceRequest,
      input: {
        service: "Definitive excision planning",
        reason: encounter.pathologyResult ?? encounter.clinicalSummary,
        bodySite: encounter.bodySite,
      },
    },
    {
      name: EVENT_TOOL_NAMES.verifyClosure,
      input: {
        requiredEvidence: [
          "Clinician review documented",
          "Patient notification documented",
          "Definitive treatment scheduled",
          "Definitive treatment completed",
        ],
      },
    },
  ];

  const trace: AgentTraceEntry[] = [];
  for (const [index, call] of planned.entries()) {
    const result = await executeTool(call.name, call.input, context);
    trace.push({ id: `fallback-${index + 1}`, tool: call.name, input: call.input, result });
  }
  const blocked = trace.filter((entry) => entry.result.blockedReason).length;
  return {
    success: true,
    agentMode: "deterministic_fallback" as const,
    ehrMode: createEhrAdapter(request.forceMockEhr).mode,
    model: null,
    configurationMessage: reason,
    finalSummary:
      blocked > 0
        ? `The agent found an unresolved malignant pathology obligation and proposed ${blocked} protected EHR write actions. They remain blocked until explicit approval. Closure is not verified.`
        : "Approved actions were prepared through the EHR adapter. Closure remains open until completed treatment evidence appears in the EHR.",
    trace,
    proposedActions: planned.map((call) => call.name),
    unresolvedQuestions: [
      "Has the patient been reached?",
      "Has definitive treatment been scheduled?",
      "Is there completed procedure evidence?",
    ],
  };
}

async function runClaudeToolLoop(
  request: ReturnType<typeof AgentRequestSchema.parse>,
  apiKey: string,
  model: string,
) {
  const encounter = request.encounter;
  const context = {
    patientId: encounter.patientId,
    encounterId: encounter.encounterId,
    approvedActionIds: request.approvedActionIds,
    forceMockEhr: request.forceMockEhr,
  };
  const messages: Array<Record<string, unknown>> = [
    {
      role: "user",
      content: `Evaluate and advance this clinical obligation. Always search the EHR before proposing actions. Do not diagnose, change treatment, send patient communication, or close the case autonomously. When evidence conflicts, stop and request human review.\n\nEncounter intelligence:\n${JSON.stringify(encounter, null, 2)}`,
    },
  ];
  const trace: AgentTraceEntry[] = [];
  let finalSummary = "The agent completed its EHR tool-use cycle.";

  for (let turn = 0; turn < 4; turn += 1) {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 1400,
        temperature: 0,
        system:
          "You are the bounded workflow agent inside Closed Care Loop. Use EHR tools to inspect evidence and propose the minimum safe action. EHR writes require explicit application approval. A task, message, or appointment is not proof of completed care. Final closure requires verified outcome evidence.",
        tools,
        tool_choice: { type: "auto", disable_parallel_tool_use: true },
        messages,
      }),
    });
    const raw = (await response.json().catch(() => null)) as
      | { content?: ClaudeBlock[]; stop_reason?: string; error?: { message?: string } }
      | null;
    if (!response.ok) {
      throw new Error(raw?.error?.message ?? `Anthropic API returned ${response.status}.`);
    }

    const content = raw?.content ?? [];
    const text = content
      .filter((block): block is TextBlock => block.type === "text" && typeof block.text === "string")
      .map((block) => block.text)
      .join("\n")
      .trim();
    if (text) finalSummary = text;

    const toolCalls = content.filter(
      (block): block is ToolUseBlock =>
        block.type === "tool_use" &&
        typeof block.id === "string" &&
        typeof block.name === "string" &&
        Boolean(block.input) &&
        typeof block.input === "object",
    );
    messages.push({ role: "assistant", content });
    if (toolCalls.length === 0) break;

    const toolResults = [];
    for (const call of toolCalls) {
      const result = await executeTool(call.name, call.input, context);
      trace.push({ id: call.id, tool: call.name, input: call.input, result });
      toolResults.push({
        type: "tool_result",
        tool_use_id: call.id,
        is_error: !result.ok,
        content: JSON.stringify({
          ok: result.ok,
          mode: result.mode,
          summary: result.summary,
          blockedReason: result.blockedReason,
          resourceType: result.resourceType,
          resourceId: result.resourceId,
          evidence: result.evidence,
        }),
      });
    }
    messages.push({ role: "user", content: toolResults });
  }

  return {
    success: true,
    agentMode: "claude_tool_use" as const,
    ehrMode: createEhrAdapter(request.forceMockEhr).mode,
    model,
    configurationMessage: null,
    finalSummary,
    trace,
    proposedActions: Array.from(new Set(trace.map((entry) => entry.tool))),
    unresolvedQuestions: trace.some((entry) => entry.result.blockedReason)
      ? ["Which proposed EHR write actions should the clinician approve?"]
      : [],
  };
}

export const Route = createFileRoute("/api/agent/orchestrate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const parsed = AgentRequestSchema.safeParse(
          await request.json().catch(() => null),
        );
        if (!parsed.success) {
          return Response.json(
            {
              success: false,
              message: "Invalid encounter orchestration payload.",
              issues: parsed.error.flatten(),
            },
            { status: 400 },
          );
        }

        const apiKey = process.env.ANTHROPIC_API_KEY;
        const model = process.env.ANTHROPIC_MODEL;
        if (!apiKey || !model) {
          return Response.json(
            await runDeterministicFallback(
              parsed.data,
              "Anthropic credentials are not configured. The identical approval-gated EHR tool path ran in deterministic fallback mode.",
            ),
          );
        }

        try {
          return Response.json(await runClaudeToolLoop(parsed.data, apiKey, model));
        } catch (error) {
          return Response.json(
            await runDeterministicFallback(
              parsed.data,
              error instanceof Error
                ? `Claude tool-use failed: ${error.message}`
                : "Claude tool-use failed; deterministic fallback executed.",
            ),
          );
        }
      },
    },
  },
});
