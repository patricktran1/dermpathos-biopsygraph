import { createFileRoute } from "@tanstack/react-router";

function recordToObject(record: import("neo4j-driver").Record) {
  const obj: Record<string, unknown> = {};
  for (const key of record.keys) obj[String(key)] = record.get(key);
  return obj;
}

export const Route = createFileRoute("/api/biopsygraph/list-patients")({
  server: {
    handlers: {
      GET: async () => {
        const neoUri = process.env.NEO4J_URI;
        const neoUser = process.env.NEO4J_USERNAME;
        const neoPass = process.env.NEO4J_PASSWORD;
        if (!neoUri || !neoUser || !neoPass) {
          return Response.json({
            success: false,
            message: "Unable to list BiopsyGraph patients.",
            error: "Missing NEO4J_URI / NEO4J_USERNAME / NEO4J_PASSWORD.",
            rows: [],
          });
        }

        const cypher = `
          MATCH (p:Patient)
          OPTIONAL MATCH (p)-[:HAS_BIOPSY]->(c:BiopsyCase)
          OPTIONAL MATCH (c)-[:HAS_DIAGNOSIS]->(d:Diagnosis)
          OPTIONAL MATCH (c)-[:GENERATES_TASK]->(t:FollowUpTask)
          RETURN
            p.name AS patient,
            c.case_id AS case_id,
            c.site AS biopsy_site,
            d.name AS diagnosis,
            t.task_title AS task_title,
            t.status AS task_status
          ORDER BY patient
          LIMIT 50
        `;

        let driver: import("neo4j-driver").Driver | undefined;
        let session: import("neo4j-driver").Session | undefined;
        try {
          const neo4j = (await import("neo4j-driver")).default;
          driver = neo4j.driver(neoUri, neo4j.auth.basic(neoUser, neoPass));
          session = driver.session();
          const { records } = await session.run(cypher);
          const rows = records.map(recordToObject);
          return Response.json({
            success: true,
            message: `Found ${rows.length} BiopsyGraph patient row${
              rows.length === 1 ? "" : "s"
            }.`,
            rows,
          });
        } catch (err) {
          return Response.json({
            success: false,
            message: "Unable to list BiopsyGraph patients.",
            error: err instanceof Error ? err.message : String(err),
            rows: [],
          });
        } finally {
          if (session) await session.close();
          if (driver) await driver.close();
        }
      },
    },
  },
});