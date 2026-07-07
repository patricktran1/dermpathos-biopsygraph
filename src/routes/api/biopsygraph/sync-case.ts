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
  priority?: string;
  required_action?: string;
  recommended_follow_up?: string;
  task_id?: string;
  task_type?: string;
  task_title?: string;
  assigned_to?: string;
  due_timing?: string;
  reason?: string;
  [key: string]: unknown;
}

interface Debug {
  table: string;
  url: string;
  status: number | null;
  ok: boolean;
  rawResponse: unknown;
  parsedRows: Row[];
  responseShape?: string[];
  error?: string;
}

function asText(value: unknown, fallback: string): string {
  if (value === undefined || value === null || value === "") return fallback;
  return String(value);
}

function getRows(body: unknown): { rows: Row[]; shape?: string[] } {
  if (Array.isArray(body)) return { rows: body as Row[] };
  if (body && typeof body === "object") {
    const rec = body as Record<string, unknown>;
    for (const key of ["body", "data", "rows", "records", "result"]) {
      if (Array.isArray(rec[key])) return { rows: rec[key] as Row[] };
    }
    return { rows: [], shape: Object.keys(rec) };
  }
  return { rows: [], shape: body === null ? ["null"] : [typeof body] };
}

async function bbGet(
  apiUrl: string,
  appId: string,
  apiKey: string,
  table: string,
  query: string,
): Promise<Debug> {
  const url = `${apiUrl.replace(/\/+$/, "")}/v1/${appId}/${table}?${query}`;
  const dbg: Debug = {
    table,
    url,
    status: null,
    ok: false,
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
    dbg.status = res.status;
    dbg.ok = res.ok;
    try {
      dbg.rawResponse = text ? JSON.parse(text) : null;
    } catch {
      dbg.rawResponse = text;
      dbg.error = "Non-JSON response";
      return dbg;
    }
    const { rows, shape } = getRows(dbg.rawResponse);
    dbg.parsedRows = rows;
    dbg.responseShape = shape;
    if (!res.ok) dbg.error = `Butterbase ${table} status ${res.status}`;
    return dbg;
  } catch (err) {
    dbg.error = err instanceof Error ? err.message : String(err);
    return dbg;
  }
}

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

export const Route = createFileRoute("/api/biopsygraph/sync-case")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => ({}))) as {
          case_id?: string;
          caseKey?: string;
          patient_name?: string;
        };
        const caseIdIn = (body.caseKey ?? body.case_id ?? "").trim();
        const patientNameIn = (body.patient_name ?? "").trim();

        if (!caseIdIn && !patientNameIn) {
          return Response.json({
            success: false,
            message: "Provide caseKey/case_id or patient_name.",
          });
        }

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

        const biopsyAttempts: Array<{ by: string; debug: Debug }> = [];
        let biopsyDebug: Debug | null = null;
        if (caseIdIn) {
          const d1 = await bbGet(apiUrl, appId, apiKey, "biopsy_cases",
            `id=eq.${encodeURIComponent(caseIdIn)}&limit=1`);
          biopsyAttempts.push({ by: "id", debug: d1 });
          if (d1.parsedRows.length) biopsyDebug = d1;
          if (!biopsyDebug) {
            const d2 = await bbGet(apiUrl, appId, apiKey, "biopsy_cases",
              `case_id=eq.${encodeURIComponent(caseIdIn)}&limit=1`);
            biopsyAttempts.push({ by: "case_id", debug: d2 });
            if (d2.parsedRows.length) biopsyDebug = d2;
          }
        }
        if (!biopsyDebug && patientNameIn) {
          const d3 = await bbGet(apiUrl, appId, apiKey, "biopsy_cases",
            `patient_name=ilike.%${encodeURIComponent(patientNameIn)}%&limit=10`);
          biopsyAttempts.push({ by: "patient_name", debug: d3 });
          if (d3.parsedRows.length) biopsyDebug = d3;
        }
        biopsyDebug = biopsyDebug ?? biopsyAttempts[biopsyAttempts.length - 1]?.debug ?? {
          table: "biopsy_cases", url: "", status: null, ok: false,
          rawResponse: null, parsedRows: [],
        };

        const taskAttempts: Array<{ by: string; debug: Debug }> = [];
        let taskDebug: Debug | null = null;
        if (caseIdIn) {
          const t1 = await bbGet(apiUrl, appId, apiKey, "follow_up_tasks",
            `case_id=eq.${encodeURIComponent(caseIdIn)}&limit=10`);
          taskAttempts.push({ by: "case_id", debug: t1 });
          if (t1.parsedRows.length) taskDebug = t1;
          if (!taskDebug) {
            const t2 = await bbGet(apiUrl, appId, apiKey, "follow_up_tasks",
              `id=eq.task_${encodeURIComponent(caseIdIn)}&limit=10`);
            taskAttempts.push({ by: "id", debug: t2 });
            if (t2.parsedRows.length) taskDebug = t2;
          }
        }
        if (!taskDebug && patientNameIn) {
          const t3 = await bbGet(apiUrl, appId, apiKey, "follow_up_tasks",
            `patient_name=ilike.%${encodeURIComponent(patientNameIn)}%&limit=10`);
          taskAttempts.push({ by: "patient_name", debug: t3 });
          if (t3.parsedRows.length) taskDebug = t3;
        }
        taskDebug = taskDebug ?? taskAttempts[taskAttempts.length - 1]?.debug ?? {
          table: "follow_up_tasks", url: "", status: null, ok: false,
          rawResponse: null, parsedRows: [],
        };

        const matches = (row: Row) => {
          if (caseIdIn && (row.id === caseIdIn || row.case_id === caseIdIn))
            return true;
          if (
            patientNameIn &&
            String(row.patient_name ?? "")
              .toLowerCase()
              .includes(patientNameIn.toLowerCase())
          )
            return true;
          return false;
        };

        const biopsy =
          biopsyDebug.parsedRows.find(matches) ??
          biopsyDebug.parsedRows[0] ??
          null;

        const attemptSummary = (a: Array<{ by: string; debug: Debug }>) =>
          a.map((x) => ({
            by: x.by, url: x.debug.url, status: x.debug.status,
            rowCount: x.debug.parsedRows.length, shape: x.debug.responseShape,
            error: x.debug.error,
          }));

        if (!biopsy) {
          return Response.json({
            success: false,
            message:
              "Matching biopsy row not found in Butterbase. Submit to Butterbase first.",
            debug: {
              caseKey: caseIdIn,
              patient_name: patientNameIn,
              biopsy_attempts: attemptSummary(biopsyAttempts),
              task_attempts: attemptSummary(taskAttempts),
              biopsy_raw: biopsyDebug.rawResponse,
              task_raw: taskDebug.rawResponse,
            },
          });
        }

        const resolvedCaseId =
          asText(biopsy.case_id ?? biopsy.id, "") ||
          caseIdIn ||
          `case_${normalizeName(
            asText(biopsy.patient_name, patientNameIn || "unknown"),
          )}_${Date.now()}`;

        const foundTask =
          taskDebug.parsedRows.find(
            (r) => r.case_id && r.case_id === resolvedCaseId,
          ) ??
          taskDebug.parsedRows.find(matches) ??
          null;

        const patientName = asText(
          biopsy.patient_name,
          patientNameIn || "Unknown patient",
        );
        const diagnosis = asText(biopsy.diagnosis, "Unspecified diagnosis");
        const recommended = asText(
          biopsy.recommended_follow_up ?? biopsy.required_action,
          "Physician review",
        );

        const fallbackTaskType = "follow_up";
        const task: Row = foundTask ?? {
          task_id: `task_${resolvedCaseId}_${fallbackTaskType}`,
          case_id: resolvedCaseId,
          patient_name: patientName,
          task_type: fallbackTaskType,
          task_title: `Follow-up — ${diagnosis}`,
          priority: asText(biopsy.risk_level ?? biopsy.priority, "Routine"),
          assigned_to: "Unassigned",
          due_timing: "As soon as possible",
          status: "Open",
          reason: `Auto-generated task from biopsy result: ${diagnosis}`,
        };
        const warnings = foundTask
          ? []
          : ["Follow-up task row not found; used generated fallback task."];

        const resolvedTaskId =
          asText(task.task_id ?? task.id, "") ||
          `task_${resolvedCaseId}_${asText(task.task_type, fallbackTaskType)}`;

        const params = {
          patient_name: patientName,
          age: asText(biopsy.age, ""),
          case_id: resolvedCaseId,
          biopsy_site: asText(biopsy.biopsy_site ?? biopsy.body_site, ""),
          biopsy_type: asText(biopsy.biopsy_type, ""),
          pathology_result: asText(
            biopsy.pathology_result ?? biopsy.pathology_result_text,
            "",
          ),
          case_status: asText(biopsy.status, ""),
          risk_level: asText(biopsy.risk_level ?? biopsy.priority, ""),
          diagnosis,
          margins: asText(biopsy.margins, ""),
          recommended_follow_up: recommended,
          task_id: resolvedTaskId,
          task_title: asText(task.task_title, `Follow-up — ${diagnosis}`),
          priority: asText(task.priority, "Routine"),
          assigned_to: asText(task.assigned_to, "Unassigned"),
          due_timing: asText(task.due_timing, "As soon as possible"),
          task_status: asText(task.status, "Open"),
          reason: asText(task.reason, ""),
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
          if (!first) {
            return Response.json({
              success: false,
              message: "Neo4j returned no rows after MERGE.",
              debug: { params, biopsy_raw: biopsyDebug.rawResponse },
            });
          }
          const graph = {
            patient: first.get("patient"),
            case_id: first.get("case_id"),
            biopsy_site: first.get("biopsy_site"),
            diagnosis: first.get("diagnosis"),
            task_title: first.get("task_title"),
            priority: first.get("priority"),
            task_status: first.get("task_status"),
            required_action: first.get("required_action"),
          };
          return Response.json({
            success: true,
            message: `BiopsyGraph verified: ${graph.patient} → biopsy → ${graph.diagnosis} → follow-up task.`,
            warnings,
            graph,
            debug: {
              resolved_case_id: resolvedCaseId,
              resolved_task_id: resolvedTaskId,
              selected_biopsy_row: biopsy,
              selected_task_row: foundTask,
              params,
            },
          });
        } catch (err) {
          return Response.json({
            success: false,
            message: `Neo4j error: ${
              err instanceof Error ? err.message : String(err)
            }`,
            debug: { params },
          });
        } finally {
          if (session) await session.close();
          if (driver) await driver.close();
        }
      },
    },
  },
});
