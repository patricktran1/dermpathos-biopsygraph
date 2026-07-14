import { z } from "zod";

export const LinkedEvidenceSchema = z.object({
  id: z.string(),
  label: z.string(),
  quote: z.string(),
  sourceType: z.enum(["transcript", "note", "pathology", "ehr", "other"]),
});

export const EncounterInputSchema = z.object({
  encounterId: z.string().min(1),
  patientId: z.string().min(1),
  patientName: z.string().min(1),
  source: z.enum(["abridge", "synthetic", "other"]).default("abridge"),
  transcript: z.string().optional(),
  clinicalSummary: z.string().min(1),
  assessmentPlan: z.string().optional(),
  pathologyResult: z.string().optional(),
  bodySite: z.string().optional(),
  linkedEvidence: z.array(LinkedEvidenceSchema).default([]),
  occurredAt: z.string().optional(),
});

export type EncounterInput = z.infer<typeof EncounterInputSchema>;
export type LinkedEvidence = z.infer<typeof LinkedEvidenceSchema>;

export const AgentRequestSchema = z.object({
  encounter: EncounterInputSchema,
  approvedActionIds: z.array(z.string()).default([]),
  forceMockEhr: z.boolean().default(false),
});

export type AgentRequest = z.infer<typeof AgentRequestSchema>;

export type EhrMode = "openemr_fhir" | "mock";

export interface EhrToolResult {
  ok: boolean;
  tool: string;
  mode: EhrMode;
  writeAttempted: boolean;
  approvalRequired: boolean;
  blockedReason?: string;
  resourceType?: string;
  resourceId?: string;
  summary: string;
  evidence?: Array<{ label: string; value: string; source: string }>;
  raw?: unknown;
}

export interface AgentTraceEntry {
  id: string;
  tool: string;
  input: Record<string, unknown>;
  result: EhrToolResult;
}

export interface AgentRunResult {
  success: boolean;
  agentMode: "claude_tool_use" | "deterministic_fallback";
  ehrMode: EhrMode;
  model: string | null;
  configurationMessage: string | null;
  finalSummary: string;
  trace: AgentTraceEntry[];
  proposedActions: string[];
  unresolvedQuestions: string[];
}

export interface EhrAdapter {
  mode: EhrMode;
  searchEvidence(input: {
    patientId: string;
    encounterId: string;
    obligationType: string;
  }): Promise<EhrToolResult>;
  createTask(input: {
    patientId: string;
    encounterId: string;
    title: string;
    priority: "routine" | "urgent" | "asap" | "stat";
    description: string;
  }): Promise<EhrToolResult>;
  draftPatientCommunication(input: {
    patientId: string;
    encounterId: string;
    subject: string;
    body: string;
  }): Promise<EhrToolResult>;
  createServiceRequest(input: {
    patientId: string;
    encounterId: string;
    service: string;
    reason: string;
    bodySite?: string;
  }): Promise<EhrToolResult>;
  verifyClosure(input: {
    patientId: string;
    encounterId: string;
    requiredEvidence: string[];
  }): Promise<EhrToolResult>;
}

export const EVENT_TOOL_NAMES = {
  searchEvidence: "ehr_search_evidence",
  createTask: "ehr_create_task",
  draftPatientCommunication: "ehr_draft_patient_communication",
  createServiceRequest: "ehr_create_service_request",
  verifyClosure: "ehr_verify_closure",
} as const;

export type EventToolName = (typeof EVENT_TOOL_NAMES)[keyof typeof EVENT_TOOL_NAMES];
