import { createFileRoute } from "@tanstack/react-router";

interface CasePayload {
  case_id?: string;
  patient_name: string;
  age: string;
  biopsy_date: string;
  biopsy_site: string;
  biopsy_type: string;
  pathology_result: string;
  diagnosis: string;
  margins: string;
  patient_notified: string;
  treatment_scheduled: string;
  responsible_physician: string;
  risk_level: string;
  recommended_follow_up: string;
  status: string;
}

interface TaskPayload {
  task_id?: string;
  case_id: string;
  patient_name: string;
  task_type: string;
  task_title: string;
  priority: string;
  assigned_to: string;
  due_timing: string;
  status: string;
  reason: string;
}

interface BbResult {
  success: boolean;
  status: number;
  body: unknown;
}

function stringifyAll(o: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(o)) {
    if (v === null || v === undefined) out[k] = "";
    else if (typeof v === "string") out[k] = v;
    else if (typeof v === "object") out[k] = JSON.stringify(v);
    else out[k] = String(v);
  }
  return out;
}

async function postRow(
  apiUrl: string,
  appId: string,
  apiKey: string,
  table: string,
  payload: Record<string, string>,
): Promise<BbResult> {
  const url = `${apiUrl.replace(/\/+$/, "")}/v1/${appId}/${table}`;
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
  return { success: res.ok, status: res.status, body };
}

export const Route = createFileRoute("/api/butterbase/submit-case")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiUrl =
          process.env.BUTTERBASE_API_URL ?? "https://api.butterbase.ai";
        const appId = process.env.BUTTERBASE_APP_ID;
        const apiKey = process.env.BUTTERBASE_API_KEY;
        if (!apiKey) {
          return Response.json({
            success: false,
            message: "Server missing BUTTERBASE_API_KEY environment variable.",
          });
        }
        if (!appId) {
          return Response.json({
            success: false,
            message: "Server missing BUTTERBASE_APP_ID environment variable.",
          });
        }

        let input: { case: CasePayload; task: TaskPayload };
        try {
          input = (await request.json()) as {
            case: CasePayload;
            task: TaskPayload;
          };
        } catch {
          return Response.json({
            success: false,
            message: "Invalid request body.",
          });
        }
        if (!input?.case || !input?.task) {
          return Response.json({
            success: false,
            message: "Missing case or task in request body.",
          });
        }

        const casePayload = stringifyAll(
          input.case as unknown as Record<string, unknown>,
        );
        const taskPayload = stringifyAll(
          input.task as unknown as Record<string, unknown>,
        );

        try {
          const biopsy = await postRow(
            apiUrl,
            appId,
            apiKey,
            "biopsy_cases",
            casePayload,
          );
          if (!biopsy.success) {
            return Response.json({
              success: false,
              message: "Butterbase write failed",
              failed_step: "biopsy_cases",
              status: biopsy.status,
              body: biopsy.body,
            });
          }
          const task = await postRow(
            apiUrl,
            appId,
            apiKey,
            "follow_up_tasks",
            taskPayload,
          );
          if (!task.success) {
            return Response.json({
              success: false,
              message: "Butterbase write failed",
              failed_step: "follow_up_tasks",
              status: task.status,
              body: task.body,
            });
          }
          return Response.json({
            success: true,
            message: "Butterbase write confirmed",
            case_id: casePayload.case_id,
            biopsy_cases: biopsy,
            follow_up_tasks: task,
          });
        } catch (err) {
          return Response.json({
            success: false,
            message: `Network error contacting Butterbase: ${
              err instanceof Error ? err.message : String(err)
            }`,
          });
        }
      },
    },
  },
});
