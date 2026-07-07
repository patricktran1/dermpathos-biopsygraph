import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/rocketride/health")({
  server: {
    handlers: {
      GET: async () => {
        const workflowUrl = process.env.ROCKETRIDE_WORKFLOW_URL;
        const apiUrl = process.env.ROCKETRIDE_API_URL;
        const apiKey = process.env.ROCKETRIDE_API_KEY;
        const pipelineId = process.env.ROCKETRIDE_PIPELINE_ID;

        const configured = Boolean(workflowUrl || (apiUrl && apiKey));

        if (!configured) {
          return Response.json({
            success: false,
            configured: false,
            status: "pending_configuration",
            message:
              "RocketRide pending configuration. Add workflow URL or API credentials.",
            env: {
              ROCKETRIDE_WORKFLOW_URL: Boolean(workflowUrl),
              ROCKETRIDE_API_URL: Boolean(apiUrl),
              ROCKETRIDE_API_KEY: Boolean(apiKey),
              ROCKETRIDE_PIPELINE_ID: Boolean(pipelineId),
            },
          });
        }

        const url = workflowUrl ?? apiUrl!;
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (!workflowUrl && apiKey) headers.Authorization = `Bearer ${apiKey}`;
        const body: Record<string, unknown> = {
          project: "DermPathOS",
          workflow: "health_check",
          message: "RocketRide connection test",
        };
        if (!workflowUrl && pipelineId) body.pipeline_id = pipelineId;

        try {
          const res = await fetch(url, {
            method: "POST",
            headers,
            body: JSON.stringify(body),
          });
          const text = await res.text();
          let response: unknown = text;
          try {
            response = JSON.parse(text);
          } catch {
            /* raw text */
          }
          return Response.json({
            success: res.ok,
            configured: true,
            status: res.ok ? "complete" : "failed",
            httpStatus: res.status,
            message: res.ok
              ? "RocketRide reachable."
              : `RocketRide returned ${res.status}`,
            response,
          });
        } catch (err) {
          return Response.json({
            success: false,
            configured: true,
            status: "failed",
            error: err instanceof Error ? err.message : String(err),
          });
        }
      },
    },
  },
});
