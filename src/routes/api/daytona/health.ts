import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/daytona/health")({
  server: {
    handlers: {
      GET: async () => {
        const apiKey = process.env.DAYTONA_API_KEY;
        if (!apiKey) {
          return Response.json({
            success: false,
            sandbox: "Daytona",
            status: "not_configured",
            message: "DAYTONA_API_KEY is not configured.",
            env: { DAYTONA_API_KEY: false },
          });
        }
        try {
          const { Daytona } = await import("@daytonaio/sdk");
          // Lightweight init — do not create a sandbox here.
          new Daytona({ apiKey });
          return Response.json({
            success: true,
            sandbox: "Daytona",
            status: "configured",
            message: "Daytona SDK client initialized.",
            env: { DAYTONA_API_KEY: true },
          });
        } catch (err) {
          return Response.json({
            success: false,
            sandbox: "Daytona",
            status: "sdk_error",
            message: err instanceof Error ? err.message : String(err),
            env: { DAYTONA_API_KEY: true },
          });
        }
      },
    },
  },
});
