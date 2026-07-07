import { createFileRoute } from "@tanstack/react-router";

interface Input {
  caseKey?: string;
  patient_name?: string;
  age?: string;
  dob?: string;
  biopsy_date?: string;
  body_site?: string;
  biopsy_type?: string;
  pathology_result_text?: string;
  diagnosis?: string;
  margins?: string;
  responsible_physician?: string;
  priority?: string;
  required_action?: string;
  clinical_description?: string;
  clinical_concern?: string;
  clinic_note_excerpt?: string;
  clinical_photo_present?: boolean;
  pathology_image_present?: boolean;
  clinical_photo_label?: string;
  pathology_image_label?: string;
}

type JsonRecord = Record<string, unknown>;

function s(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  return String(v);
}

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function makeCaseKey(patientName: string): string {
  const n = patientName.trim().toLowerCase();
  if (n === "sarah miller") return "demo_sarah_miller_001";
  return `case_${normalizeName(patientName || "unknown")}_${Date.now()}`;
}

// ---------------------------------------------------------------------------
// Sponsor integration status helpers
// ---------------------------------------------------------------------------

type DaytonaStatus = {
  status: "configured" | "not_configured";
  message: string;
};

/**
 * Lightweight, env-only Daytona indicator for the main submit route.
 * Does NOT call Daytona. Only DAYTONA_API_KEY is required to be considered
 * "configured" here — richer Daytona vars are used only by the dev-only
 * /api/daytona/* routes.
 */
function daytonaStatus(): DaytonaStatus {
  if (process.env.DAYTONA_API_KEY && process.env.DAYTONA_API_KEY.trim() !== "") {
    return {
      status: "configured",
      message:
        "Daytona sandbox validation is configured for dev-only checks.",
    };
  }
  return {
    status: "not_configured",
    message: "Daytona sandbox validation is optional and not configured.",
  };
}

type GraphStatus = {
  graph_synced: boolean;
  verified: boolean;
  graph?: unknown;
  verify_results?: unknown[];
  error?: string;
};

/**
 * Wraps every submit response so the shape is consistent for the UI:
 *  - preserves existing `neo4j` field (existing UI reads this)
 *  - mirrors it as `biopsygraph` for sponsor/demo clarity
 *  - always attaches `daytona` env-status
 *  - always attaches `rocketride` (defaults to pending_configuration)
 */
function respond(payload: JsonRecord) {
  const neo4j =
    (payload.neo4j as GraphStatus | undefined) ??
    ({ graph_synced: false, verified: false } as GraphStatus);
  const out: JsonRecord = {
    ...payload,
    neo4j,
    biopsygraph: neo4j,
    daytona: daytonaStatus(),
  };
  if (!("rocketride" in out)) {
    out.rocketride = rocketridePendingConfig();
  }
  return Response.json(out);
}

async function postRow(
  apiUrl: string,
  appId: string,
  apiKey: string,
  table: string,
  payload: Record<string, string>,
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const url = `${apiUrl.replace(/\/+$/, "")}/v1/${appId}/${table}`;
  console.log(`[cases/submit] POST ${url}`, payload);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    /* ignore */
  }
  console.log(`[cases/submit] ${table} → ${res.status}`, body);
  return { ok: res.ok, status: res.status, body };
}

function neoRecordToObject(record: import("neo4j-driver").Record): JsonRecord {
  const obj: JsonRecord = {};
  for (const key of record.keys) obj[String(key)] = record.get(key);
  return obj;
}

function neo4jMissingResponse(caseKey: string, taskKey: string) {
  return respond({
    success: false,
    partial_success: true,
    message: "Case saved to Butterbase, but BiopsyGraph sync failed.",
    caseKey,
    taskKey,
    butterbase: {
      biopsy_case_saved: true,
      follow_up_task_saved: true,
    },
    neo4j: {
      graph_synced: false,
      verified: false,
      error: "Missing NEO4J_URI / NEO4J_USERNAME / NEO4J_PASSWORD.",
    },
    rocketride: rocketridePendingConfig(),
  });
}

type RocketRideStatus = {
  agent_completed: boolean;
  webhook_triggered: boolean;
  status: "completed" | "triggered" | "failed" | "pending_configuration" | "missing_configuration" | "timeout_nonblocking";
  nonblocking?: boolean;
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
  missing?: {
    ROCKETRIDE_WEBHOOK_URL: boolean;
    ROCKETRIDE_AUTH_KEY: boolean;
  };
  // Debug fields (safe to expose; no secrets)
  rocketride_http_status?: number;
  rocketride_response_body?: string;
  rocketride_response_json?: unknown;
  rocketride_error_message?: string;
  rocketride_request_method?: string;
  rocketride_request_body_shape?: string[];
  rocketride_attempts?: Array<{ shape: string[]; http_status?: number; error?: string }>;
  rocketride_url_redacted?: string;
  rocketride_content_type_sent?: string;
  rocketride_accept_sent?: string;
  rocketride_authorization_header_sent?: boolean;
  rocketride_auth_value_exposed?: boolean;
  rocketride_prompt_preview?: string;
  rocketride_timeout_ms?: number;
  rocketride_config?: {
    webhook_url_present: boolean;
    auth_key_present: boolean;
    webhook_url_redacted: string | null;
    expected_secret_names: string[];
  };
};

function rocketrideConfigDebug(webhookUrl?: string, authKey?: string) {
  return {
    webhook_url_present: Boolean(webhookUrl),
    auth_key_present: Boolean(authKey),
    webhook_url_redacted: webhookUrl
      ? webhookUrl.replace(/auth=.*/, "auth=***")
      : null,
    expected_secret_names: ["ROCKETRIDE_WEBHOOK_URL", "ROCKETRIDE_AUTH_KEY"],
  };
}


function rocketridePendingConfig(): RocketRideStatus {
  return {
    agent_completed: false,
    webhook_triggered: false,
    status: "pending_configuration",
    message:
      "RocketRide pipeline is built, but workflow URL/API credentials are not configured yet. Core Butterbase + BiopsyGraph safety net completed.",
  };
}


function pickString(o: unknown, key: string): string | undefined {
  if (!o || typeof o !== "object") return undefined;
  const v = (o as Record<string, unknown>)[key];
  return typeof v === "string" && v.trim() !== "" ? v : undefined;
}

async function callRocketRide(
  payload: Record<string, unknown>,
): Promise<RocketRideStatus> {
  // New canonical secrets
  const webhookUrl = process.env.ROCKETRIDE_WEBHOOK_URL;
  const authKey = process.env.ROCKETRIDE_AUTH_KEY;
  // Legacy fallbacks (kept so existing deployments don't regress)
  const legacyWorkflowUrl = process.env.ROCKETRIDE_WORKFLOW_URL;
  const legacyApiUrl = process.env.ROCKETRIDE_API_URL;
  const legacyApiKey = process.env.ROCKETRIDE_API_KEY;
  const legacyPipelineId = process.env.ROCKETRIDE_PIPELINE_ID;

  const hasWebhook = !!(webhookUrl && webhookUrl.trim() !== "");
  const hasAuth = !!(authKey && authKey.trim() !== "");
  if (!hasWebhook || !hasAuth) {
    return {
      agent_completed: false,
      webhook_triggered: false,
      status: "missing_configuration",
      http_status: null,
      error: "RocketRide server-side configuration missing.",
      message:
        "RocketRide server-side configuration is missing. Required secrets: ROCKETRIDE_WEBHOOK_URL and ROCKETRIDE_AUTH_KEY.",
      missing: {
        ROCKETRIDE_WEBHOOK_URL: !hasWebhook,
        ROCKETRIDE_AUTH_KEY: !hasAuth,
      },
      rocketride_authorization_header_sent: false,
      rocketride_auth_value_exposed: false,
      rocketride_config: rocketrideConfigDebug(webhookUrl, authKey),
    };
  }

  let url: string | undefined;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Accept": "application/json",
    "Authorization": authKey,
  };

  // Canonical inner payload used by both attempts.
  const caseData = ((payload as Record<string, unknown>).case ?? {}) as Record<string, unknown>;
  const butterbaseData = (payload as Record<string, unknown>).butterbase ?? {};
  const biopsygraphData = (payload as Record<string, unknown>).biopsygraph ?? {};

  const getStr = (k: string): string => {
    const v = caseData[k];
    return typeof v === "string" ? v : v == null ? "" : String(v);
  };
  const patientName = getStr("patient_name");
  const dob = getStr("dob");
  const site = getStr("body_site") || getStr("biopsy_site");
  const diagnosis = getStr("diagnosis");
  const margins = getStr("margins");
  const priority = getStr("priority") || getStr("risk_level");
  const requiredAction = getStr("required_action") || getStr("recommended_follow_up");
  const clinicalDescription = getStr("clinical_description");
  const clinicalConcern = getStr("clinical_concern");
  const clinicNoteExcerpt = getStr("clinic_note_excerpt");
  const caseKey = getStr("case_id") || getStr("id");

  // Pull graph fields from biopsygraph status object for normalization fallback.
  const bg = biopsygraphData as Record<string, unknown>;
  const graph = (bg.graph ?? {}) as Record<string, unknown>;
  const gStr = (o: Record<string, unknown>, k: string): string => {
    const v = o[k];
    return typeof v === "string" ? v : v == null ? "" : String(v);
  };

  const rrPatientName =
    patientName || gStr(graph, "patient") || gStr(graph, "patient_name") || "";
  const rrDob = dob || gStr(graph, "dob") || "";
  const rrSite =
    site ||
    gStr(caseData, "site") ||
    gStr(caseData, "biopsy_site") ||
    gStr(graph, "biopsy_site") ||
    gStr(graph, "site") ||
    "";
  const rrDiagnosis =
    diagnosis || gStr(caseData, "diagnosis") || gStr(graph, "diagnosis") || "";
  const rrMargins =
    margins || gStr(caseData, "margins") || gStr(graph, "margins") || "";
  const rrPriority =
    priority || gStr(graph, "priority") || gStr(graph, "risk_level") || "";
  const rrRequiredAction =
    requiredAction ||
    gStr(caseData, "required_action") ||
    gStr(graph, "required_action") ||
    gStr(graph, "recommended_follow_up") ||
    "";

  const rocketrideClinicalPrompt = `
You are the DermPathOS Follow-Up Safety Agent.
Review this dermatology pathology follow-up case and return JSON only.

Patient: ${rrPatientName}
DOB: ${rrDob}
Biopsy site: ${rrSite}
Diagnosis: ${rrDiagnosis}
Margins: ${rrMargins}
Priority: ${rrPriority}
Required action: ${rrRequiredAction}
Clinical description: ${clinicalDescription || "Not provided"}
Clinical concern / rule-out: ${clinicalConcern || "Not provided"}
Clinic note excerpt: ${clinicNoteExcerpt || "Not provided"}

Butterbase status:
- biopsy case saved: true
- follow-up task saved: true

BiopsyGraph / Neo4j status:
- graph synced: true
- graph verified: true

Rules:
- Use the actual diagnosis, margins, site, priority, and required action above.
- Do not say diagnosis or margins are missing if they are listed above.
- If margins are involved, state that definitive follow-up is required.
- If diagnosis includes melanoma, melanoma in situ, SCC, BCC, atypical nevus, severe atypia, or malignancy, flag for physician review.
- If site is nose, eyelid, lip, ear, genital, hand, foot, or nail unit, mention site-sensitive treatment planning.
- If benign nevus with clear margins, recommend routine patient notification.

Return exactly this JSON shape:
{
  "agent_completed": true,
  "agent": "DermPathOS Follow-Up Safety Agent",
  "risk_summary": "short clinical risk summary",
  "recommended_next_action": "specific next action",
  "safety_status": "Routine follow-up | Clear follow-up required | Needs physician review | Incomplete data",
  "handoff": "short operational handoff instruction"
}
`;

  // Flat, simple RocketRide body. Only `input` and `question` — no duplicates.
  const primaryBody: Record<string, unknown> = {
    input: rocketrideClinicalPrompt,
    question: rocketrideClinicalPrompt,
  };
  // Fallback body (only tried on HTTP 400): nested legacy shape.
  const fallbackBody: Record<string, unknown> = {
    agent: "DermPathOS Follow-Up Safety Agent",
    event_type: "biopsy_case_submitted",
    case: caseData,
    butterbase: butterbaseData,
    biopsygraph: biopsygraphData,
    input: rocketrideClinicalPrompt,
  };
  void caseKey;

  let legacyPipelineIdApplied = false;
  if (webhookUrl) {
    url = webhookUrl;
  } else if (legacyWorkflowUrl) {
    url = legacyWorkflowUrl;
  } else if (legacyApiUrl && legacyApiKey) {
    url = legacyApiUrl;
    if (legacyPipelineId) {
      (primaryBody as Record<string, unknown>).pipeline_id = legacyPipelineId;
      (fallbackBody as Record<string, unknown>).pipeline_id = legacyPipelineId;
      legacyPipelineIdApplied = true;
    }
  } else {
    return rocketridePendingConfig();
  }
  void legacyPipelineIdApplied;

  // Redact URL for debug output.
  let url_redacted = "(unavailable)";
  try {
    const u = new URL(url);
    const hasAuth = u.searchParams.has("auth");
    url_redacted = `${u.origin}${u.pathname}${hasAuth ? "?auth=***" : ""}`;
  } catch {
    /* noop */
  }

  const attempts: Array<{ shape: string[]; http_status?: number; error?: string }> = [];
  const requested_at = new Date().toISOString();

  const ROCKETRIDE_TIMEOUT_MS = 15000;

  async function attempt(body: Record<string, unknown>): Promise<{
    ok: boolean;
    status?: number;
    text: string;
    response: unknown;
    response_json: unknown;
    error?: string;
    timed_out?: boolean;
  }> {
    const shape = Object.keys(body);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ROCKETRIDE_TIMEOUT_MS);
    try {
      const res = await fetch(url!, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const text = await res.text();
      let response_json: unknown = undefined;
      let response: unknown = text;
      try {
        response_json = JSON.parse(text);
        response = response_json;
      } catch {
        /* raw */
      }
      attempts.push({ shape, http_status: res.status });
      return { ok: res.ok, status: res.status, text, response, response_json };
    } catch (err) {
      const timed_out = controller.signal.aborted;
      const msg = timed_out
        ? `RocketRide timed out after ${ROCKETRIDE_TIMEOUT_MS}ms`
        : err instanceof Error ? err.message : String(err);
      attempts.push({ shape, error: msg });
      return { ok: false, text: "", response: undefined, response_json: undefined, error: msg, timed_out };
    } finally {
      clearTimeout(timer);
    }
  }

  // Attempt 1: primary {{input}} shape.
  let result = await attempt(primaryBody);
  // Attempt 2: only retry on HTTP 400 (never on timeout — stay nonblocking).
  if (!result.ok && result.status === 400 && !result.timed_out) {
    result = await attempt(fallbackBody);
  }

  const debug = {
    rocketride_http_status: result.status,
    rocketride_response_body: result.text,
    rocketride_response_json: result.response_json,
    rocketride_request_method: "POST",
    rocketride_request_body_shape: attempts[attempts.length - 1]?.shape,
    rocketride_attempts: attempts,
    rocketride_url_redacted: url_redacted,
    rocketride_content_type_sent: "application/json",
    rocketride_accept_sent: "application/json",
    rocketride_authorization_header_sent: true,
    rocketride_auth_value_exposed: false,
    rocketride_prompt_preview: rocketrideClinicalPrompt.slice(0, 300),
    rocketride_config: rocketrideConfigDebug(webhookUrl, authKey),
    rocketride_timeout_ms: ROCKETRIDE_TIMEOUT_MS,
  };

  if (result.timed_out) {
    return {
      agent_completed: false,
      webhook_triggered: false,
      status: "timeout_nonblocking",
      requested_at,
      nonblocking: true,
      error: "RocketRide timed out after 15 seconds; core safety net completed.",
      rocketride_error_message: result.error,
      ...debug,
    };
  }

  if (result.error && result.status === undefined) {
    return {
      agent_completed: false,
      webhook_triggered: false,
      status: "failed",
      requested_at,
      error: result.error,
      rocketride_error_message: result.error,
      ...debug,
    };
  }

  if (!result.ok) {
    return {
      agent_completed: false,
      webhook_triggered: false,
      status: "failed",
      http_status: result.status,
      requested_at,
      error: `RocketRide returned HTTP ${result.status}`,
      rocketride_error_message: result.text,
      response: result.response,
      raw_response: result.text,
      ...debug,
    };
  }

  const response = result.response;
  const agent_completed =
    typeof response === "object" &&
    response !== null &&
    (response as Record<string, unknown>).agent_completed === true;
  return {
    agent_completed,
    webhook_triggered: true,
    status: agent_completed ? "completed" : "triggered",
    http_status: result.status,
    requested_at,
    agent: agent_completed ? pickString(response, "agent") : undefined,
    risk_summary: agent_completed ? pickString(response, "risk_summary") : undefined,
    recommended_next_action: agent_completed ? pickString(response, "recommended_next_action") : undefined,
    safety_status: agent_completed ? pickString(response, "safety_status") : undefined,
    handoff: agent_completed ? pickString(response, "handoff") : undefined,
    message: agent_completed
      ? undefined
      : "RocketRide Cloud accepted the workflow handoff. Agent review is asynchronous.",
    response,
    raw_response: result.text,
    ...debug,
  };
}



export const Route = createFileRoute("/api/cases/submit")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const input = (await request
          .json()
          .catch(() => ({}))) as Input;

        const patient_name = s(input.patient_name).trim();
        if (!patient_name) {
          return respond({
            success: false,
            message: "patient_name is required.",
            butterbase: {
              biopsy_case_saved: false,
              follow_up_task_saved: false,
            },
            neo4j: { graph_synced: false, verified: false },
          });
        }
        const diagnosis = s(input.diagnosis) || "Unspecified diagnosis";
        const priority = s(input.priority) || "Routine";
        const required_action = s(input.required_action) || "Physician review";
        const responsible_physician = s(input.responsible_physician);
        const body_site = s(input.body_site);
        const biopsy_type = s(input.biopsy_type);
        const pathology_result_text = s(input.pathology_result_text);
        const margins = s(input.margins);
        const age = s(input.age);
        const dob = s(input.dob);
        const biopsy_date = s(input.biopsy_date);
        const clinical_description = s(input.clinical_description);
        const clinical_concern = s(input.clinical_concern);
        const clinic_note_excerpt = s(input.clinic_note_excerpt);
        const clinical_photo_present = input.clinical_photo_present === true;
        const pathology_image_present = input.pathology_image_present === true;
        const clinical_photo_label = s(input.clinical_photo_label);
        const pathology_image_label = s(input.pathology_image_label);
        const has_visual_evidence =
          clinical_photo_present || pathology_image_present;

        const caseKey = s(input.caseKey).trim() || makeCaseKey(patient_name);
        const taskKey = `task_${caseKey}`;

        const apiUrl =
          process.env.BUTTERBASE_API_URL ?? "https://api.butterbase.ai";
        const appId = process.env.BUTTERBASE_APP_ID;
        const apiKey = process.env.BUTTERBASE_API_KEY;
        const neoUri = process.env.NEO4J_URI;
        const neoUser = process.env.NEO4J_USERNAME;
        const neoPass = process.env.NEO4J_PASSWORD;

        if (!appId || !apiKey) {
          return respond({
            success: false,
            message: "Server missing BUTTERBASE_APP_ID or BUTTERBASE_API_KEY.",
            caseKey,
            taskKey,
            butterbase: {
              biopsy_case_saved: false,
              follow_up_task_saved: false,
            },
            neo4j: { graph_synced: false, verified: false },
          });
        }

        const biopsyPayload: Record<string, string> = {
          id: caseKey,
          case_id: caseKey,
          patient_name,
          age,
          biopsy_date,
          body_site,
          biopsy_site: body_site,
          biopsy_type,
          pathology_result_text,
          pathology_result: pathology_result_text,
          diagnosis,
          margins,
          patient_notified: "No",
          treatment_scheduled: "No",
          responsible_physician,
          priority,
          risk_level: priority,
          required_action,
          recommended_follow_up: required_action,
          status: "pathology_result_received",
          clinical_description,
          clinical_concern,
          clinic_note_excerpt,
          clinical_photo_present: clinical_photo_present ? "true" : "false",
          pathology_image_present: pathology_image_present ? "true" : "false",
          clinical_photo_label,
          pathology_image_label,
        };

        const taskPayload: Record<string, string> = {
          id: taskKey,
          task_id: taskKey,
          case_id: caseKey,
          patient_name,
          task_type: "pathology_follow_up",
          task_title: required_action,
          priority,
          assigned_to: responsible_physician,
          due_timing: "Within 24 hours",
          status: "Open",
          reason: `${diagnosis} requires documented follow-up.`,
        };

        let biopsyRes: { ok: boolean; status: number; body: unknown };
        let taskRes: { ok: boolean; status: number; body: unknown };
        try {
          biopsyRes = await postRow(
            apiUrl,
            appId,
            apiKey,
            "biopsy_cases",
            biopsyPayload,
          );
        } catch (err) {
          return respond({
            success: false,
            message: `Network error writing biopsy_cases: ${
              err instanceof Error ? err.message : String(err)
            }`,
            failed_step: "biopsy_cases",
            caseKey,
            taskKey,
            butterbase: {
              biopsy_case_saved: false,
              follow_up_task_saved: false,
            },
            neo4j: { graph_synced: false, verified: false },
          });
        }
        if (!biopsyRes.ok) {
          return respond({
            success: false,
            message: "Butterbase write failed",
            failed_step: "biopsy_cases",
            status: biopsyRes.status,
            body: biopsyRes.body,
            caseKey,
            taskKey,
            butterbase: {
              biopsy_case_saved: false,
              follow_up_task_saved: false,
            },
            neo4j: { graph_synced: false, verified: false },
          });
        }

        try {
          taskRes = await postRow(
            apiUrl,
            appId,
            apiKey,
            "follow_up_tasks",
            taskPayload,
          );
        } catch (err) {
          return respond({
            success: false,
            message: `Network error writing follow_up_tasks: ${
              err instanceof Error ? err.message : String(err)
            }`,
            failed_step: "follow_up_tasks",
            caseKey,
            taskKey,
            butterbase: {
              biopsy_case_saved: true,
              follow_up_task_saved: false,
            },
            neo4j: { graph_synced: false, verified: false },
          });
        }
        if (!taskRes.ok) {
          return respond({
            success: false,
            message: "Butterbase write failed",
            failed_step: "follow_up_tasks",
            status: taskRes.status,
            body: taskRes.body,
            caseKey,
            taskKey,
            butterbase: {
              biopsy_case_saved: true,
              follow_up_task_saved: false,
            },
            neo4j: { graph_synced: false, verified: false },
          });
        }

        // Both Butterbase writes succeeded. Now sync to Neo4j.
        const butterbase = {
          biopsy_case_saved: true,
          follow_up_task_saved: true,
        };

        if (!neoUri || !neoUser || !neoPass) {
          return neo4jMissingResponse(caseKey, taskKey);
        }

        const hasClinicalContext = Boolean(
          clinical_description || clinical_concern || clinic_note_excerpt,
        );
        const clinicalContextCypher = hasClinicalContext
          ? `
          MERGE (cc:ClinicalContext {case_id: $caseKey})
          SET cc.clinical_description = $clinical_description,
              cc.clinical_concern = $clinical_concern,
              cc.clinic_note_excerpt = $clinic_note_excerpt
          MERGE (c)-[:HAS_CLINICAL_CONTEXT]->(cc)
        `
          : "";

        const visualEvidenceCypher = has_visual_evidence
          ? `
          MERGE (ve:VisualEvidence {case_id: $caseKey})
          SET ve.clinical_photo_present = $clinical_photo_present,
              ve.pathology_image_present = $pathology_image_present,
              ve.clinical_photo_label = $clinical_photo_label,
              ve.pathology_image_label = $pathology_image_label,
              ve.created_at = timestamp()
          MERGE (c)-[:HAS_VISUAL_EVIDENCE]->(ve)
        `
          : "";

        const cypher = `
          MERGE (p:Patient {name: $patient_name})
          SET p.age = $age
          MERGE (c:BiopsyCase {case_id: $caseKey})
          SET c.site = $body_site,
              c.biopsy_type = $biopsy_type,
              c.pathology_result = $pathology_result_text,
              c.status = "pathology_result_received",
              c.risk_level = $priority
          MERGE (d:Diagnosis {name: $diagnosis})
          SET d.margins = $margins
          MERGE (t:FollowUpTask {task_id: $taskKey})
          SET t.task_title = $required_action,
              t.priority = $priority,
              t.assigned_to = $responsible_physician,
              t.due_timing = "Within 24 hours",
              t.status = "Open",
              t.reason = $diagnosis + " requires documented follow-up."
          MERGE (a:Action {name: $required_action})
          MERGE (p)-[:HAS_BIOPSY]->(c)
          MERGE (c)-[:HAS_DIAGNOSIS]->(d)
          MERGE (c)-[:GENERATES_TASK]->(t)
          MERGE (t)-[:REQUIRES_ACTION]->(a)
          ${clinicalContextCypher}
          ${visualEvidenceCypher}
          RETURN
            p.name AS patient,
            c.case_id AS case_id,
            c.site AS biopsy_site,
            d.name AS diagnosis,
            t.task_title AS task_title,
            t.priority AS priority,
            t.status AS task_status,
            a.name AS required_action
        `;
        const params = {
          patient_name,
          age,
          caseKey,
          taskKey,
          body_site,
          biopsy_type,
          pathology_result_text,
          diagnosis,
          margins,
          priority,
          responsible_physician,
          required_action,
          clinical_description,
          clinical_concern,
          clinic_note_excerpt,
          clinical_photo_present,
          pathology_image_present,
          clinical_photo_label,
          pathology_image_label,
        };

        const verifyCypher = `
          MATCH (p:Patient)-[:HAS_BIOPSY]->(c:BiopsyCase {case_id: $caseKey})-[:HAS_DIAGNOSIS]->(d:Diagnosis),
                (c)-[:GENERATES_TASK]->(t:FollowUpTask)
          OPTIONAL MATCH (t)-[:REQUIRES_ACTION]->(a:Action)
          RETURN
            p.name AS patient,
            c.case_id AS case_id,
            c.site AS biopsy_site,
            d.name AS diagnosis,
            t.task_title AS task_title,
            t.priority AS priority,
            t.status AS task_status,
            a.name AS required_action
        `;

        let driver: import("neo4j-driver").Driver | undefined;
        let session: import("neo4j-driver").Session | undefined;
        try {
          const neo4j = (await import("neo4j-driver")).default;
          driver = neo4j.driver(neoUri, neo4j.auth.basic(neoUser, neoPass));
          session = driver.session();
          const mergeResult = await session.run(cypher, params);
          const mergeRows = mergeResult.records.map(neoRecordToObject);
          if (mergeRows.length === 0) {
            return respond({
              success: false,
              partial_success: true,
              message: "Case saved to Butterbase, but Neo4j returned no rows.",
              caseKey,
              taskKey,
              butterbase,
              neo4j: {
                graph_synced: false,
                verified: false,
                error: "Neo4j MERGE returned no rows.",
              },
            });
          }
          const verifyResult = await session.run(verifyCypher, { caseKey });
          const verifyResults = verifyResult.records.map(neoRecordToObject);
          if (verifyResults.length === 0) {
            return respond({
              success: false,
              partial_success: true,
              message: "Case saved to Butterbase, but BiopsyGraph verification failed.",
              caseKey,
              taskKey,
              butterbase,
              neo4j: {
                graph_synced: true,
                verified: false,
                graph: mergeRows[0],
                verify_results: [],
                error: `Neo4j verify query returned no rows for caseKey ${caseKey}.`,
              },
            });
          }

          const graphStatus: GraphStatus = {
            graph_synced: true,
            verified: true,
            graph: mergeRows[0],
            verify_results: verifyResults,
          };

          const rocketride = await callRocketRide({
            agent: "DermPathOS Follow-Up Safety Agent",
            event_type: "biopsy_case_submitted",
            case: {
              case_id: caseKey,
              patient_name,
              dob,
              biopsy_date,
              site: body_site,
              diagnosis,
              margins,
              priority,
              required_action,
              task_status: "Open",
              clinical_description,
              clinical_concern,
              clinic_note_excerpt,
            },
            butterbase,
            biopsygraph: { graph_synced: true, verified: true },
          });


          if (rocketride.status === "completed" || rocketride.status === "triggered") {
            return respond({
              success: true,
              workflow_complete: rocketride.status === "completed",
              core_safety_net_complete: true,
              message:
                rocketride.status === "completed"
                  ? "Full sponsor workflow complete: Butterbase saved, BiopsyGraph synced, RocketRide safety agent completed."
                  : "Butterbase saved, BiopsyGraph synced, RocketRide webhook triggered successfully.",
              caseKey,
              taskKey,
              butterbase,
              neo4j: graphStatus,
              rocketride,
            });
          }

          if (rocketride.status === "failed") {
            return respond({
              success: true,
              workflow_complete: false,
              core_safety_net_complete: true,
              message:
                "Core safety net complete, but RocketRide safety agent failed.",
              caseKey,
              taskKey,
              butterbase,
              neo4j: graphStatus,
              rocketride,
            });
          }
          // pending_configuration
          return respond({
            success: true,
            workflow_complete: false,
            core_safety_net_complete: true,
            message:
              "Case saved to Butterbase and synced to BiopsyGraph. RocketRide safety agent is pending workflow URL/API configuration.",
            caseKey,
            taskKey,
            butterbase,
            neo4j: graphStatus,
            rocketride,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error("[cases/submit] Neo4j error", message);
          return respond({
            success: false,
            partial_success: true,
            message: "Case saved to Butterbase, but BiopsyGraph sync failed.",
            caseKey,
            taskKey,
            butterbase,
            neo4j: { graph_synced: false, verified: false, error: message },
          });
        } finally {
          if (session) await session.close();
          if (driver) await driver.close();
        }
      },
    },
  },
});
