import { createFileRoute } from "@tanstack/react-router";

async function run(caseId: string, patientName: string) {
  const neoUri = process.env.NEO4J_URI;
  const neoUser = process.env.NEO4J_USERNAME;
  const neoPass = process.env.NEO4J_PASSWORD;
  if (!neoUri || !neoUser || !neoPass) {
    return Response.json({
      success: false,
      message: "Server missing required Neo4j environment variables.",
    });
  }
  if (!caseId && !patientName) {
    return Response.json({
      success: false,
      message: "Provide caseKey/case_id or patient_name.",
    });
  }

  const cypher = caseId
    ? `
      MATCH (p:Patient)-[:HAS_BIOPSY]->(c:BiopsyCase)-[:HAS_DIAGNOSIS]->(d:Diagnosis),
            (c)-[:GENERATES_TASK]->(t:FollowUpTask)
      OPTIONAL MATCH (t)-[:REQUIRES_ACTION]->(a:Action)
      WHERE c.case_id = $case_id OR c.id = $case_id
      RETURN p.name AS patient, c.case_id AS case_id, c.site AS biopsy_site,
             d.name AS diagnosis, t.task_title AS task_title, t.priority AS priority,
             t.status AS task_status, a.name AS required_action
    `
    : `
      MATCH (p:Patient)-[:HAS_BIOPSY]->(c:BiopsyCase)-[:HAS_DIAGNOSIS]->(d:Diagnosis),
            (c)-[:GENERATES_TASK]->(t:FollowUpTask)
      OPTIONAL MATCH (t)-[:REQUIRES_ACTION]->(a:Action)
      WHERE toLower(p.name) CONTAINS toLower($patient_name)
      RETURN p.name AS patient, c.case_id AS case_id, c.site AS biopsy_site,
             d.name AS diagnosis, t.task_title AS task_title, t.priority AS priority,
             t.status AS task_status, a.name AS required_action
    `;
  const params = caseId ? { case_id: caseId } : { patient_name: patientName };

  let driver: import("neo4j-driver").Driver | undefined;
  let session: import("neo4j-driver").Session | undefined;
  try {
    const neo4j = (await import("neo4j-driver")).default;
    driver = neo4j.driver(neoUri, neo4j.auth.basic(neoUser, neoPass));
    session = driver.session();
    const { records } = await session.run(cypher, params);
    const results = records.map((r) => {
      const obj: Record<string, unknown> = {};
      for (const key of r.keys) obj[String(key)] = r.get(key);
      return obj;
    });
    const success = results.length > 0;
    const first = results[0] as Record<string, unknown> | undefined;
    return Response.json({
      success,
      message: success && first
        ? `BiopsyGraph verified: ${first.patient} → biopsy → ${first.diagnosis} → follow-up task.`
        : "Case not found in BiopsyGraph. Run sync first.",
      results,
    });
  } catch (err) {
    return Response.json({
      success: false,
      message: `Neo4j error: ${err instanceof Error ? err.message : String(err)}`,
    });
  } finally {
    if (session) await session.close();
    if (driver) await driver.close();
  }
}

export const Route = createFileRoute("/api/biopsygraph/verify-case")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        return run(
          (url.searchParams.get("caseKey") ?? url.searchParams.get("case_id") ?? "").trim(),
          (url.searchParams.get("patient_name") ?? "").trim(),
        );
      },
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => ({}))) as {
          case_id?: string;
          caseKey?: string;
          patient_name?: string;
        };
        return run(
          (body.caseKey ?? body.case_id ?? "").trim(),
          (body.patient_name ?? "").trim(),
        );
      },
    },
  },
});
