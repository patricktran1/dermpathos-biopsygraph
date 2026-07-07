/**
 * Client-safe Butterbase helpers.
 * The frontend never talks to Butterbase directly and never sees the API key.
 * All Butterbase traffic goes through internal server routes under
 * /api/butterbase/*. The secret BUTTERBASE_API_KEY lives only on the server.
 */

import type { CaseAssessment, FollowUpTask, PathologyCase } from "./types";

export const BUTTERBASE_PUBLIC_INFO = {
  apiUrl: "https://api.butterbase.ai",
  appId: "app_tqn6q2qpfjxd",
} as const;

export function newId(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID();
    }
  } catch {
    /* ignore */
  }
  return `id_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function s(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.join(", ");
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export function buildCasePayload(
  c: PathologyCase,
  assessment: CaseAssessment,
  caseId: string,
): Record<string, string> {
  return {
    id: caseId,
    case_id: caseId,
    patient_name: s(c.patientName),
    age: s(c.age),
    biopsy_date: s(c.biopsyDate),
    biopsy_site: s(c.bodySite),
    body_site: s(c.bodySite),
    biopsy_type: s(c.biopsyType),
    pathology_result: s(c.pathologyResult),
    pathology_result_text: s(c.pathologyResult),
    diagnosis: s(c.diagnosis),
    margins: s(c.margins),
    patient_notified: s(c.patientNotified),
    treatment_scheduled: s(c.treatmentScheduled),
    responsible_physician: s(c.physician),
    priority: s(assessment.priority),
    risk_level: s(assessment.priority),
    required_action: s(assessment.requiredAction),
    recommended_follow_up: s(assessment.requiredAction),
    status: "pathology_result_received",
  };
}

export function buildTaskPayload(
  c: PathologyCase,
  assessment: CaseAssessment,
  caseId: string,
): Record<string, string> {
  return {
    id: `task_${caseId}`,
    task_id: `task_${caseId}`,
    case_id: caseId,
    patient_name: s(c.patientName),
    task_type: s(assessment.taskTitle).toLowerCase().replace(/\s+/g, "_"),
    task_title: s(assessment.taskTitle),
    priority: s(assessment.priority),
    assigned_to: s(c.physician),
    due_timing: s(assessment.dueTiming),
    status: "Open",
    reason: s(assessment.taskReason),
  };
}

// ---------------------------------------------------------------------------
// Internal API calls (relative endpoints only — never contact butterbase.ai)
// ---------------------------------------------------------------------------

export interface BackendTestResult {
  success: boolean;
  message: string;
  status?: number;
  body?: unknown;
}

export async function testBackend(): Promise<BackendTestResult> {
  try {
    const res = await fetch("/api/butterbase/test", { method: "POST" });
    return (await res.json()) as BackendTestResult;
  } catch (err) {
    return {
      success: false,
      message: `Network error calling /api/butterbase/test: ${
        err instanceof Error ? err.message : String(err)
      }`,
    };
  }
}

export interface RocketRideStatus {
  agent_completed: boolean;
  webhook_triggered?: boolean;
  status?: "completed" | "triggered" | "failed" | "pending_configuration" | "missing_configuration" | "timeout_nonblocking" | "complete";
  http_status?: number | null;
  requested_at?: string;
  agent?: string;
  risk_summary?: string;
  recommended_next_action?: string;
  safety_status?: string;
  handoff?: string;
  message?: string;
  error?: string;
  response?: unknown;
  raw_response?: string;
}

export interface SubmitBackendResult {
  success: boolean;
  partial_success?: boolean;
  workflow_complete?: boolean;
  core_safety_net_complete?: boolean;
  message: string;
  caseKey?: string;
  taskKey?: string;
  case_id?: string;
  failed_step?: string;
  status?: number;
  body?: unknown;
  biopsy_cases?: unknown;
  follow_up_tasks?: unknown;
  butterbase?: {
    biopsy_case_saved: boolean;
    follow_up_task_saved: boolean;
  };
  neo4j?: {
    graph_synced: boolean;
    verified?: boolean;
    graph?: unknown;
    verify_results?: unknown[];
    error?: string;
  };
  biopsygraph?: {
    graph_synced: boolean;
    verified?: boolean;
    graph?: unknown;
    verify_results?: unknown[];
    error?: string;
  };
  rocketride?: RocketRideStatus;
  daytona?: {
    status: "configured" | "not_configured";
    message: string;
  };
}

export async function submitSarah(): Promise<SubmitBackendResult> {
  try {
    const res = await fetch("/api/butterbase/submit-sarah", { method: "POST" });
    return (await res.json()) as SubmitBackendResult;
  } catch (err) {
    return {
      success: false,
      message: `Network error calling /api/butterbase/submit-sarah: ${
        err instanceof Error ? err.message : String(err)
      }`,
    };
  }
}

export async function verifySarah(): Promise<SubmitBackendResult> {
  try {
    const res = await fetch("/api/butterbase/verify-sarah");
    return (await res.json()) as SubmitBackendResult;
  } catch (err) {
    return {
      success: false,
      message: `Network error calling /api/butterbase/verify-sarah: ${
        err instanceof Error ? err.message : String(err)
      }`,
    };
  }
}

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

export function buildCaseKey(patientName: string): string {
  const n = patientName.trim().toLowerCase();
  if (n === "sarah miller") return "demo_sarah_miller_001";
  return `case_${normalizeName(patientName || "unknown")}_${Date.now()}`;
}

export interface CombinedSubmitInput {
  caseKey: string;
  patient_name: string;
  age: string;
  biopsy_date: string;
  body_site: string;
  biopsy_type: string;
  pathology_result_text: string;
  diagnosis: string;
  margins: string;
  responsible_physician: string;
  priority: string;
  required_action: string;
}

export async function submitCaseCombined(
  input: CombinedSubmitInput,
): Promise<SubmitBackendResult> {
  try {
    const res = await fetch("/api/cases/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const raw = (await res.json()) as SubmitBackendResult;
    console.log("[cases/submit] response", raw);
    return raw;
  } catch (err) {
    return {
      success: false,
      message: `Network error calling /api/cases/submit: ${
        err instanceof Error ? err.message : String(err)
      }`,
    };
  }
}

// Legacy — kept for /api/butterbase/submit-case callers.
export async function submitCase(
  c: PathologyCase,
  assessment: CaseAssessment,
): Promise<SubmitBackendResult> {
  const caseId = c.id && c.id.trim() !== "" ? c.id : newId();
  const payload = {
    case: buildCasePayload(c, assessment, caseId),
    task: buildTaskPayload(c, assessment, caseId),
  };
  try {
    const res = await fetch("/api/butterbase/submit-case", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return (await res.json()) as SubmitBackendResult;
  } catch (err) {
    return {
      success: false,
      message: `Network error calling /api/butterbase/submit-case: ${
        err instanceof Error ? err.message : String(err)
      }`,
    };
  }
}

// Legacy signature kept so older callers still compile. Now a no-op stub —
// the browser never has (or checks) the Butterbase API key. Real API-key
// presence is validated server-side by /api/butterbase/*.
export function hasButterbaseApiKey(): boolean {
  return true;
}

// Row helpers retained for any legacy import paths.
export function caseToRow(
  c: PathologyCase,
  assessment?: CaseAssessment,
): Record<string, string> {
  const id = c.id && c.id.trim() !== "" ? c.id : newId();
  return buildCasePayload(
    c,
    assessment ?? {
      priority: "Routine",
      requiredAction: "",
      taskTitle: "",
      taskReason: "",
      dueTiming: "",
      flags: [],
      graphPath: [],
      isMalignant: false,
    },
    id,
  );
}

export function taskToRow(
  caseId: string,
  task: FollowUpTask,
): Record<string, string> {
  return {
    task_id: newId(),
    case_id: caseId,
    patient_name: "",
    task_type: s(task.title).toLowerCase().replace(/\s+/g, "_"),
    task_title: s(task.title),
    priority: s(task.priority),
    assigned_to: s(task.physician),
    due_timing: s(task.dueTiming),
    status: s(task.status),
    reason: s(task.reason),
  };
}
