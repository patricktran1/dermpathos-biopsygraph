import type { EhrAdapter, EhrToolResult } from "./contracts";

type JsonObject = Record<string, unknown>;

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const id = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function mockResult(
  tool: string,
  summary: string,
  options: Partial<EhrToolResult> = {},
): EhrToolResult {
  return {
    ok: true,
    tool,
    mode: "mock",
    writeAttempted: false,
    approvalRequired: false,
    summary,
    ...options,
  };
}

function createMockAdapter(): EhrAdapter {
  return {
    mode: "mock",
    async searchEvidence(input) {
      return mockResult(
        "ehr_search_evidence",
        "Synthetic EHR search found no completed outreach, treatment request, or procedure evidence.",
        {
          evidence: [
            {
              label: "Patient",
              value: input.patientId,
              source: "Synthetic EHR patient index",
            },
            {
              label: "Communication",
              value: "No qualifying communication found",
              source: "Synthetic Communication search",
            },
            {
              label: "Definitive care",
              value: "No completed procedure found",
              source: "Synthetic Procedure search",
            },
          ],
        },
      );
    },
    async createTask(input) {
      return mockResult("ehr_create_task", `Dry-run task prepared: ${input.title}`, {
        writeAttempted: true,
        approvalRequired: true,
        resourceType: "Task",
        resourceId: id("task"),
        raw: input,
      });
    },
    async draftPatientCommunication(input) {
      return mockResult(
        "ehr_draft_patient_communication",
        `Draft patient communication prepared: ${input.subject}`,
        {
          writeAttempted: true,
          approvalRequired: true,
          resourceType: "Communication",
          resourceId: id("communication"),
          raw: input,
        },
      );
    },
    async createServiceRequest(input) {
      return mockResult(
        "ehr_create_service_request",
        `Dry-run service request prepared: ${input.service}`,
        {
          writeAttempted: true,
          approvalRequired: true,
          resourceType: "ServiceRequest",
          resourceId: id("service-request"),
          raw: input,
        },
      );
    },
    async verifyClosure(input) {
      return mockResult(
        "ehr_verify_closure",
        "Closure remains blocked because required completion evidence is missing.",
        {
          evidence: input.requiredEvidence.map((requirement) => ({
            label: requirement,
            value: "Not verified",
            source: "Synthetic EHR reconciliation",
          })),
        },
      );
    },
  };
}

function createOpenEmrFhirAdapter(baseUrl: string, accessToken: string): EhrAdapter {
  const normalizedBase = baseUrl.replace(/\/+$/, "");
  const allowWrites = process.env.OPENEMR_ALLOW_WRITES === "true";

  const request = async (
    path: string,
    init?: RequestInit,
  ): Promise<{ ok: boolean; status: number; body: unknown }> => {
    const response = await fetch(`${normalizedBase}/${path.replace(/^\/+/, "")}`, {
      ...init,
      headers: {
        accept: "application/fhir+json, application/json",
        authorization: `Bearer ${accessToken}`,
        ...(init?.body ? { "content-type": "application/fhir+json" } : {}),
        ...(init?.headers ?? {}),
      },
    });
    const body = await response.json().catch(() => null);
    return { ok: response.ok, status: response.status, body };
  };

  const write = async (
    tool: string,
    resourceType: string,
    resource: JsonObject,
    summary: string,
  ): Promise<EhrToolResult> => {
    if (!allowWrites) {
      return {
        ok: true,
        tool,
        mode: "openemr_fhir",
        writeAttempted: true,
        approvalRequired: true,
        blockedReason:
          "OPENEMR_ALLOW_WRITES is not enabled. Returning a safe write preview.",
        resourceType,
        resourceId: id(`${resourceType.toLowerCase()}-preview`),
        summary,
        raw: resource,
      };
    }

    const response = await request(resourceType, {
      method: "POST",
      body: JSON.stringify(resource),
    });
    const body = response.body as JsonObject | null;
    return {
      ok: response.ok,
      tool,
      mode: "openemr_fhir",
      writeAttempted: true,
      approvalRequired: true,
      resourceType,
      resourceId:
        body && typeof body.id === "string" ? body.id : undefined,
      summary: response.ok
        ? summary
        : `OpenEMR FHIR write failed with status ${response.status}.`,
      raw: response.body,
    };
  };

  return {
    mode: "openemr_fhir",
    async searchEvidence(input) {
      const patientRef = encodeURIComponent(`Patient/${input.patientId}`);
      const [tasks, communications, serviceRequests, procedures] = await Promise.all([
        request(`Task?patient=${encodeURIComponent(input.patientId)}`),
        request(`Communication?subject=${patientRef}`),
        request(`ServiceRequest?subject=${patientRef}`),
        request(`Procedure?subject=${patientRef}`),
      ]);

      const count = (body: unknown) => {
        const object = body && typeof body === "object" ? (body as JsonObject) : {};
        return asArray(object.entry).length;
      };

      const evidence = [
        { label: "Tasks", value: String(count(tasks.body)), source: "OpenEMR FHIR Task" },
        {
          label: "Communications",
          value: String(count(communications.body)),
          source: "OpenEMR FHIR Communication",
        },
        {
          label: "Service requests",
          value: String(count(serviceRequests.body)),
          source: "OpenEMR FHIR ServiceRequest",
        },
        {
          label: "Procedures",
          value: String(count(procedures.body)),
          source: "OpenEMR FHIR Procedure",
        },
      ];

      const ok = [tasks, communications, serviceRequests, procedures].every(
        (response) => response.ok,
      );
      return {
        ok,
        tool: "ehr_search_evidence",
        mode: "openemr_fhir",
        writeAttempted: false,
        approvalRequired: false,
        summary: ok
          ? "OpenEMR FHIR evidence search completed."
          : "One or more OpenEMR FHIR evidence searches failed.",
        evidence,
        raw: { tasks, communications, serviceRequests, procedures, input },
      };
    },
    async createTask(input) {
      return write(
        "ehr_create_task",
        "Task",
        {
          resourceType: "Task",
          status: "requested",
          intent: "order",
          priority: input.priority,
          for: { reference: `Patient/${input.patientId}` },
          encounter: { reference: `Encounter/${input.encounterId}` },
          description: input.description,
          code: { text: input.title },
        },
        `OpenEMR task created: ${input.title}`,
      );
    },
    async draftPatientCommunication(input) {
      return write(
        "ehr_draft_patient_communication",
        "Communication",
        {
          resourceType: "Communication",
          status: "preparation",
          subject: { reference: `Patient/${input.patientId}` },
          encounter: { reference: `Encounter/${input.encounterId}` },
          topic: { text: input.subject },
          payload: [{ contentString: input.body }],
        },
        `OpenEMR communication draft created: ${input.subject}`,
      );
    },
    async createServiceRequest(input) {
      return write(
        "ehr_create_service_request",
        "ServiceRequest",
        {
          resourceType: "ServiceRequest",
          status: "draft",
          intent: "proposal",
          subject: { reference: `Patient/${input.patientId}` },
          encounter: { reference: `Encounter/${input.encounterId}` },
          code: { text: input.service },
          reasonCode: [{ text: input.reason }],
          bodySite: input.bodySite ? [{ text: input.bodySite }] : undefined,
        },
        `OpenEMR service request created: ${input.service}`,
      );
    },
    async verifyClosure(input) {
      const evidence = await this.searchEvidence({
        patientId: input.patientId,
        encounterId: input.encounterId,
        obligationType: "closure-verification",
      });
      return {
        ...evidence,
        tool: "ehr_verify_closure",
        summary:
          "Closure verification completed against current OpenEMR FHIR evidence. Deterministic closure policy must still evaluate the returned resources.",
      };
    },
  };
}

export function createEhrAdapter(forceMock = false): EhrAdapter {
  const baseUrl = process.env.OPENEMR_FHIR_BASE_URL;
  const accessToken = process.env.OPENEMR_ACCESS_TOKEN;
  if (forceMock || !baseUrl || !accessToken) return createMockAdapter();
  return createOpenEmrFhirAdapter(baseUrl, accessToken);
}
