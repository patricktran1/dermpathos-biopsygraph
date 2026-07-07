import { createFileRoute } from "@tanstack/react-router";

interface BbResult {
  success: boolean;
  status: number;
  body: unknown;
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

const biopsyPayload: Record<string, string> = {
  case_id: "demo_sarah_miller_001",
  patient_name: "Sarah Miller",
  age: "42",
  biopsy_date: "2026-07-01",
  biopsy_site: "Left upper back",
  biopsy_type: "Shave biopsy",
  pathology_result: "Melanoma in situ, margins involved.",
  diagnosis: "Melanoma in situ",
  margins: "Involved",
  patient_notified: "No",
  treatment_scheduled: "No",
  responsible_physician: "Dr. Tran",
  risk_level: "Urgent",
  recommended_follow_up: "Physician review and excision scheduling",
  status: "pathology_result_received",
};

const taskPayload: Record<string, string> = {
  task_id: "task_sarah_miller_001",
  case_id: "demo_sarah_miller_001",
  patient_name: "Sarah Miller",
  task_type: "urgent_physician_review_melanoma",
  task_title: "Urgent physician review — melanoma pathology",
  priority: "Urgent",
  assigned_to: "Dr. Tran",
  due_timing: "Within 24 hours",
  status: "Open",
  reason:
    "Melanoma-related pathology requires documented follow-up and definitive treatment planning.",
};

export const Route = createFileRoute("/api/butterbase/submit-sarah")({
  server: {
    handlers: {
      POST: async () => {
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

        try {
          const biopsy = await postRow(
            apiUrl,
            appId,
            apiKey,
            "biopsy_cases",
            biopsyPayload,
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
