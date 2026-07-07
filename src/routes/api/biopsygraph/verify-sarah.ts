import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/biopsygraph/verify-sarah")({
  server: {
    handlers: {
      GET: async () => {
        const neoUri = process.env.NEO4J_URI;
        const neoUser = process.env.NEO4J_USERNAME;
        const neoPass = process.env.NEO4J_PASSWORD;
        if (!neoUri || !neoUser || !neoPass) {
          return Response.json({
            success: false,
            message: "Server missing required Neo4j environment variables.",
          });
        }

        const cypher = `
          MATCH (p:Patient {name: "Sarah Miller"})-[:HAS_BIOPSY]->(c:BiopsyCase)-[:HAS_DIAGNOSIS]->(d:Diagnosis),
                (c)-[:GENERATES_TASK]->(t:FollowUpTask)
          OPTIONAL MATCH (t)-[:REQUIRES_ACTION]->(a:Action)
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
          const { records } = await session.run(cypher, {});
          const results = records.map((r) => {
            const obj: Record<string, unknown> = {};
            for (const key of r.keys) obj[String(key)] = r.get(key);
            return obj;
          });
          const success = results.length > 0;
          return Response.json({
            success,
            message: success
              ? "BiopsyGraph verified"
              : "Sarah Miller graph not found in Neo4j. Run sync first.",
            results,
          });
        } catch (err) {
          return Response.json({
            success: false,
            message: `Neo4j error: ${
              err instanceof Error ? err.message : String(err)
            }`,
          });
        } finally {
          if (session) await session.close();
          if (driver) await driver.close();
        }
      },
    },
  },
});
