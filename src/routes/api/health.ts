import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        const anthropicConfigured = Boolean(
          process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_MODEL,
        );
        const openEmrConfigured = Boolean(
          process.env.OPENEMR_FHIR_BASE_URL && process.env.OPENEMR_ACCESS_TOKEN,
        );

        return Response.json(
          {
            ok: true,
            service: "closed-care-loop",
            deployment: "ready",
            agentMode: anthropicConfigured
              ? "claude_tool_use"
              : "deterministic_fallback",
            ehrMode: openEmrConfigured ? "openemr_fhir" : "mock",
            ehrWritesEnabled:
              openEmrConfigured && process.env.OPENEMR_ALLOW_WRITES === "true",
            safety: {
              writeApprovalRequired: true,
              patientCommunicationAutoSend: false,
              closureRequiresEvidence: true,
            },
            checkedAt: new Date().toISOString(),
          },
          {
            headers: {
              "cache-control": "no-store",
            },
          },
        );
      },
    },
  },
});
