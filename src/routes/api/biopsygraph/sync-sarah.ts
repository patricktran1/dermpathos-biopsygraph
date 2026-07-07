import { createFileRoute } from "@tanstack/react-router";

interface Row {
  id?: string;
  patient_name?: string;
  age?: string;
  case_id?: string;
  body_site?: string;
  biopsy_site?: string;
  biopsy_type?: string;
  pathology_result?: string;
  pathology_result_text?: string;
  diagnosis?: string;
  margins?: string;
  status?: string;
  risk_level?: string;
  required_action?: string;
  recommended_follow_up?: string;
  task_id?: string;
  task_title?: string;
  priority?: string;
  assigned_to?: string;
  due_timing?: string;
  reason?: string;
  [key: string]: unknown;
}

interface ButterbaseDebug {
  table: string;
  url: string;
  status: number | null;
  ok: boolean;
  rawText: string;
  rawResponse: unknown;
  parsedRows: Row[];
  responseShape?: string[];
  error?: string;
}

const SARAH_NAME = "Sarah Miller";

function asText(value: unknown, fallback: string): string {
  if (value === undefined || value === null || value === "") return fallback;
  return String(value);
}

function getRows(body: unknown): { rows: Row[]; shape?: string[] } {
  if (Array.isArray(body)) return { rows: body as Row[] };
  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>;
    for (const key of ["data", "rows", "records", "result"]) {
      if (Array.isArray(record[key])) return { rows: record[key] as Row[] };
    }
    return { rows: [], shape: Object.keys(record) };
  }
  return { rows: [], shape: body === null ? ["null"] : [typeof body] };
}

function isSarahRow(row: Row): boolean {
  return String(row.patient_name ?? "")
    .toLowerCase()
    .includes(SARAH_NAME.toLowerCase());
}

async function bbGet(
  apiUrl: string,
  appId: string,
  apiKey: string,
  table: string,
): Promise<ButterbaseDebug> {
  const url = `${apiUrl.replace(/\/+$/, "")}/v1/${appId}/${table}?patient_name=ilike.%Sarah%&limit=10`;
  const debug: ButterbaseDebug = {
    table,
    url,
    status: null,
    ok: false,
    rawText: "",
    rawResponse: null,
    parsedRows: [],
  };
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });
    const text = await res.text();
    debug.status = res.status;
    debug.ok = res.ok;
    debug.rawText = text;
    try {
      debug.rawResponse = text ? (JSON.parse(text) as unknown) : null;
    } catch {
      debug.rawResponse = text;
      debug.error = "Butterbase returned non-JSON response.";
      return debug;
    }
    const { rows, shape } = getRows(debug.rawResponse);
    debug.parsedRows = rows;
    debug.responseShape = shape;
    if (!res.ok) debug.error = `Butterbase ${table} read failed with status ${res.status}.`;
    if (shape && rows.length === 0) {
      console.warn(`Butterbase ${table} response shape did not contain rows`, shape);
    }
    return debug;
  } catch (err) {
    debug.error = err instanceof Error ? err.message : String(err);
    return debug;
  }
}

export const Route = createFileRoute("/api/biopsygraph/sync-sarah")({
  server: {
    handlers: {
      POST: async () => {
        const apiUrl =
          process.env.BUTTERBASE_API_URL ?? "https://api.butterbase.ai";
        const appId = process.env.BUTTERBASE_APP_ID;
        const apiKey = process.env.BUTTERBASE_API_KEY;
        const neoUri = process.env.NEO4J_URI;
        const neoUser = process.env.NEO4J_USERNAME;
        const neoPass = process.env.NEO4J_PASSWORD;
        if (!appId || !apiKey || !neoUri || !neoUser || !neoPass) {
          return Response.json({
            success: false,
            message:
              "Server missing required Butterbase or Neo4j environment variables.",
          });
        }

        const [biopsyDebug, taskDebug] = await Promise.all([
          bbGet(apiUrl, appId, apiKey, "biopsy_cases"),
          bbGet(apiUrl, appId, apiKey, "follow_up_tasks"),
        ]);
        const biopsy = biopsyDebug.parsedRows.find(isSarahRow) ?? null;
        const foundTask = taskDebug.parsedRows.find(isSarahRow) ?? null;
        const fallbackTask: Row = {
          task_id: "task_sarah_miller_001",
          patient_name: SARAH_NAME,
          task_title: "Urgent physician review — melanoma pathology",
          priority: "Urgent",
          assigned_to: "Dr. Tran",
          due_timing: "Within 24 hours",
          status: "Open",
          reason:
            "Melanoma-related pathology requires documented follow-up and definitive treatment planning.",
        };
        const task = foundTask ?? fallbackTask;
        const warnings = foundTask
          ? []
          : [
              "Follow-up task row not found, used demo fallback task for graph sync.",
            ];

        if (!biopsy) {
          return Response.json({
            success: false,
            message:
              "Sarah Miller biopsy row not found in Butterbase. Submit to Butterbase first.",
            debug: {
              butterbase_biopsy_cases_raw_response: biopsyDebug.rawResponse,
              butterbase_follow_up_tasks_raw_response: taskDebug.rawResponse,
              biopsy_cases_response_shape: biopsyDebug.responseShape,
              follow_up_tasks_response_shape: taskDebug.responseShape,
              selected_biopsy_row: null,
              selected_task_row_or_fallback: task,
              neo4j_query_result: null,
              final_success_failure: "failure",
              errors: [biopsyDebug.error, taskDebug.error].filter(Boolean),
              warnings,
            },
          });
        }

        const params = {
          patient_name: asText(biopsy.patient_name, SARAH_NAME),
          age: asText(biopsy.age, "42"),
          case_id: asText(biopsy.case_id ?? biopsy.id, "demo_sarah_miller_001"),
          biopsy_site: asText(
            biopsy.biopsy_site ?? biopsy.body_site,
            "Left upper back",
          ),
          biopsy_type: asText(biopsy.biopsy_type, "Shave biopsy"),
          pathology_result: asText(
            biopsy.pathology_result ?? biopsy.pathology_result_text,
            "Melanoma in situ, margins involved.",
          ),
          case_status: asText(biopsy.status, "pathology_result_received"),
          risk_level: asText(biopsy.risk_level ?? biopsy.priority, "Urgent"),
          diagnosis: asText(biopsy.diagnosis, "Melanoma in situ"),
          margins: asText(biopsy.margins, "Involved"),
          recommended_follow_up: asText(
            biopsy.recommended_follow_up ?? biopsy.required_action,
            "Physician review and excision scheduling",
          ),
          task_id: asText(task.task_id ?? task.id, "task_sarah_miller_001"),
          task_title: asText(
            task.task_title,
            "Urgent physician review — melanoma pathology",
          ),
          priority: asText(task.priority, "Urgent"),
          assigned_to: asText(task.assigned_to, "Dr. Tran"),
          due_timing: asText(task.due_timing, "Within 24 hours"),
          task_status: asText(task.status, "Open"),
          reason: asText(
            task.reason,
            "Melanoma-related pathology requires documented follow-up and definitive treatment planning.",
          ),
        };

        const cypher = `
          MERGE (p:Patient {name: $patient_name})
          SET p.age = $age
          MERGE (c:BiopsyCase {case_id: $case_id})
          SET c.site = $biopsy_site,
              c.biopsy_type = $biopsy_type,
              c.pathology_result = $pathology_result,
              c.status = $case_status,
              c.risk_level = $risk_level
          MERGE (d:Diagnosis {name: $diagnosis})
          SET d.margins = $margins
          MERGE (t:FollowUpTask {task_id: $task_id})
          SET t.task_title = $task_title,
              t.priority = $priority,
              t.assigned_to = $assigned_to,
              t.due_timing = $due_timing,
              t.status = $task_status,
              t.reason = $reason
          MERGE (a:Action {name: $recommended_follow_up})
          MERGE (p)-[:HAS_BIOPSY]->(c)
          MERGE (c)-[:HAS_DIAGNOSIS]->(d)
          MERGE (c)-[:GENERATES_TASK]->(t)
          MERGE (t)-[:REQUIRES_ACTION]->(a)
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
          const { records } = await session.run(cypher, params);
          const first = records[0];
          const graph = first
            ? {
                patient: first.get("patient"),
                case_id: first.get("case_id"),
                biopsy_site: first.get("biopsy_site"),
                diagnosis: first.get("diagnosis"),
                task_title: first.get("task_title"),
                priority: first.get("priority"),
                task_status: first.get("task_status"),
                required_action: first.get("required_action"),
              }
            : null;
          return Response.json({
            success: true,
            message: "BiopsyGraph sync confirmed from Butterbase",
            warnings,
            graph,
            debug: {
              butterbase_biopsy_cases_raw_response: biopsyDebug.rawResponse,
              butterbase_follow_up_tasks_raw_response: taskDebug.rawResponse,
              selected_biopsy_row: biopsy,
              selected_task_row_or_fallback: task,
              neo4j_query_result: graph,
              final_success_failure: "success",
            },
          });
        } catch (err) {
          const message = `Neo4j error: ${
            err instanceof Error ? err.message : String(err)
          }`;
          return Response.json({
            success: false,
            message,
            warnings,
            debug: {
              butterbase_biopsy_cases_raw_response: biopsyDebug.rawResponse,
              butterbase_follow_up_tasks_raw_response: taskDebug.rawResponse,
              selected_biopsy_row: biopsy,
              selected_task_row_or_fallback: task,
              neo4j_query_result: null,
              final_success_failure: "failure",
              errors: [message],
            },
          });
        } finally {
          if (session) await session.close();
          if (driver) await driver.close();
        }
      },
    },
  },
});
