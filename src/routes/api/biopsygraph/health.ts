import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/biopsygraph/health")({
  server: {
    handlers: {
      GET: async () => {
        const neoUri = process.env.NEO4J_URI;
        const neoUser = process.env.NEO4J_USERNAME;
        const neoPass = process.env.NEO4J_PASSWORD;
        if (!neoUri || !neoUser || !neoPass) {
          return Response.json({
            success: false,
            message: "Neo4j connection failed.",
            error: "Missing NEO4J_URI / NEO4J_USERNAME / NEO4J_PASSWORD.",
          });
        }

        let driver: import("neo4j-driver").Driver | undefined;
        let session: import("neo4j-driver").Session | undefined;
        try {
          const neo4j = (await import("neo4j-driver")).default;
          driver = neo4j.driver(neoUri, neo4j.auth.basic(neoUser, neoPass));
          session = driver.session();
          const { records } = await session.run(
            'RETURN "Neo4j connected" AS message',
          );
          return Response.json({
            success: true,
            message: "Neo4j connection OK.",
            result: records[0]?.get("message") ?? "Neo4j connected",
          });
        } catch (err) {
          return Response.json({
            success: false,
            message: "Neo4j connection failed.",
            error: err instanceof Error ? err.message : String(err),
          });
        } finally {
          if (session) await session.close();
          if (driver) await driver.close();
        }
      },
    },
  },
});