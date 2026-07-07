import { createFileRoute } from "@tanstack/react-router";

async function handleTest() {
  const apiUrl = process.env.BUTTERBASE_API_URL ?? "https://api.butterbase.ai";
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

  const url = `${apiUrl.replace(/\/+$/, "")}/v1/${appId}/biopsy_cases?limit=1`;
  try {
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
    return Response.json({
      success: res.ok,
      message: res.ok
        ? "Butterbase backend connection OK"
        : `Butterbase backend returned HTTP ${res.status}`,
      status: res.status,
      body,
    });
  } catch (err) {
    return Response.json({
      success: false,
      message: `Network error contacting Butterbase: ${
        err instanceof Error ? err.message : String(err)
      }`,
    });
  }
}

export const Route = createFileRoute("/api/butterbase/test")({
  server: {
    handlers: {
      GET: handleTest,
      POST: handleTest,
    },
  },
});
