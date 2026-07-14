import { EncounterInputSchema, type EncounterInput } from "./contracts";

const text = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const firstText = (...values: unknown[]) => {
  for (const value of values) {
    const candidate = text(value);
    if (candidate) return candidate;
  }
  return undefined;
};

/**
 * Event adapter boundary for Abridge-provided resources.
 *
 * The public Abridge site describes encounter intelligence, documentation,
 * care-gap identification, orders, and follow-up, but the hackathon payload
 * contract is expected to be supplied at the event. This function intentionally
 * accepts unknown JSON and isolates field mapping in one place so the exact
 * event schema can be swapped in without changing the agent or EHR layers.
 */
export function normalizeAbridgePayload(payload: unknown): EncounterInput {
  const root = record(payload);
  const patient = record(root.patient);
  const encounter = record(root.encounter);
  const note = record(root.note);
  const output = record(root.output);

  const encounterId = firstText(
    root.encounterId,
    root.encounter_id,
    encounter.id,
    root.id,
  );
  const patientId = firstText(
    root.patientId,
    root.patient_id,
    patient.id,
    patient.mrn,
  );
  const patientName = firstText(
    root.patientName,
    root.patient_name,
    patient.name,
    patient.display,
  );
  const clinicalSummary = firstText(
    root.clinicalSummary,
    root.clinical_summary,
    root.summary,
    note.summary,
    note.text,
    output.summary,
    output.note,
  );

  const normalized = {
    encounterId: encounterId ?? "abridge-demo-encounter",
    patientId: patientId ?? "synthetic-patient-001",
    patientName: patientName ?? "Synthetic Patient",
    source: "abridge" as const,
    transcript: firstText(root.transcript, encounter.transcript, output.transcript),
    clinicalSummary:
      clinicalSummary ??
      "Clinical conversation received. Exact Abridge event fields will be mapped in this adapter.",
    assessmentPlan: firstText(
      root.assessmentPlan,
      root.assessment_plan,
      note.assessmentPlan,
      note.assessment_plan,
      output.assessmentPlan,
    ),
    pathologyResult: firstText(
      root.pathologyResult,
      root.pathology_result,
      note.pathologyResult,
      output.pathologyResult,
    ),
    bodySite: firstText(root.bodySite, root.body_site, note.bodySite, output.bodySite),
    linkedEvidence: Array.isArray(root.linkedEvidence)
      ? root.linkedEvidence
      : Array.isArray(root.linked_evidence)
        ? root.linked_evidence
        : [],
    occurredAt: firstText(root.occurredAt, root.occurred_at, encounter.occurredAt),
  };

  return EncounterInputSchema.parse(normalized);
}

export const SYNTHETIC_ABRIDGE_PAYLOAD = {
  encounter_id: "enc-derm-2026-0718-001",
  patient: {
    id: "patient-sarah-miller",
    name: "Sarah Miller",
  },
  transcript:
    "Clinician: The pathology came back as melanoma in situ on the left upper back. We need to contact Sarah today and arrange excision. Staff: I do not see an outreach task or surgery request yet.",
  clinical_summary:
    "Melanoma in situ of the left upper back with involved peripheral margin. Patient notification and definitive treatment planning are not documented.",
  assessment_plan:
    "Urgent clinician review, contact patient, and arrange definitive excision. Keep the obligation open until treatment completion is verified.",
  pathology_result: "Melanoma in situ, extending to the peripheral margin.",
  body_site: "Left upper back",
  linkedEvidence: [
    {
      id: "evidence-1",
      label: "Pathology diagnosis",
      quote: "melanoma in situ on the left upper back",
      sourceType: "transcript",
    },
    {
      id: "evidence-2",
      label: "Missing workflow evidence",
      quote: "I do not see an outreach task or surgery request yet",
      sourceType: "transcript",
    },
  ],
};
