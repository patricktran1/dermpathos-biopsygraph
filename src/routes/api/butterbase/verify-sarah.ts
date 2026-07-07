import { createFileRoute } from "@tanstack/react-router";

interface BbQuery {
  success: boolean;
  status: number;
  body: unknown;
  matched: boolean;
  rowCount: number;
  responseShape?: string[];
}

function getRows(body: unknown): { rows: Array<Record<string, unknown>>; shape?: string[] } {
  if (Array.isArray(body)) return { rows: body as Array<Record<string, unknown>> };
  if (body && typeof body === "object") {
    const rec = body as Record<string, unknown>;
    for (const key of ["body", "data", "rows", "records", "result"]) {
      if (Array.isArray(rec[key]))
        return { rows: rec[key] as Array<Record<string, unknown>> };
    }
    return { rows: [], shape: Object.keys(rec) };
  }
  return { rows: [], shape: body === null ? ["null"] : [typeof body] };
}

async function query(
  apiUrl: string,
  appId: string,
  apiKey: string,
  table: string,
): Promise<BbQuery> {
  const url = `${apiUrl.replace(/\/+$/, "")}/v1/${appId}/${table}?patient_name=ilike.%Sarah%&limit=10`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  });
  const text = await res.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    /* ignore */
  }
  const { rows, shape } = getRows(body);
  const matched = rows.some((r) =>
    String(r.patient_name ?? "").toLowerCase().includes("sarah"),
  );
  return {
    success: res.ok,
    status: res.status,
    body,
    matched,
    rowCount: rows.length,
    responseShape: shape,
  };
}

export const Route = createFileRoute("/api/butterbase/verify-sarah")({
  server: {
    handlers: {
      GET: async () => {
        const apiUrl =
          process.env.BUTTERBASE_API_URL ?? "https://api.butterbase.ai";
        const appId = process.env.BUTTERBASE_APP_ID;
        const apiKey = process.env.BUTTERBASE_API_KEY;
        if (!apiKey || !appId) {
          return Response.json({
            success: false,
            message: "Server missing BUTTERBASE_API_KEY or BUTTERBASE_APP_ID.",
          });
        }
        try {
          const biopsy = await query(apiUrl, appId, apiKey, "biopsy_cases");
          const tasks = await query(apiUrl, appId, apiKey, "follow_up_tasks");
          const success = biopsy.success && tasks.success && biopsy.matched && tasks.matched;
          const reasons: string[] = [];
          if (!biopsy.success) reasons.push(`biopsy_cases HTTP ${biopsy.status}`);
          if (!tasks.success) reasons.push(`follow_up_tasks HTTP ${tasks.status}`);
          if (biopsy.success && !biopsy.matched)
            reasons.push("Sarah not found in biopsy_cases");
          if (tasks.success && !tasks.matched)
            reasons.push("Sarah not found in follow_up_tasks");
          return Response.json({
            success,
            message: success
              ? "Butterbase write verified"
              : `Verification failed: ${reasons.join("; ")}`,
            biopsy_cases: biopsy,
            follow_up_tasks: tasks,
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
