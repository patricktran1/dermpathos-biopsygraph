import assert from "node:assert/strict";
import test from "node:test";

import { assessCase, priorityRank } from "../src/lib/derm/logic.ts";
import type { PathologyCase } from "../src/lib/derm/types.ts";

function pathologyCase(overrides: Partial<PathologyCase> = {}): PathologyCase {
  return {
    id: "case-001",
    patientName: "Test Patient",
    age: 55,
    biopsyDate: "2026-07-01",
    bodySite: "Left cheek",
    biopsyType: "Shave biopsy",
    pathologyResult: "Final diagnosis available",
    diagnosis: "Benign nevus",
    margins: "Not applicable",
    patientNotified: "No",
    treatmentScheduled: "Not required",
    physician: "Test Physician",
    createdAt: Date.UTC(2026, 6, 1),
    ...overrides,
  };
}

test("melanoma creates an urgent physician-review pathway", () => {
  const assessment = assessCase(
    pathologyCase({
      diagnosis: "Melanoma in situ",
      treatmentScheduled: "No",
    }),
  );

  assert.equal(assessment.priority, "Urgent");
  assert.equal(assessment.isMalignant, true);
  assert.equal(assessment.dueTiming, "Within 24 hours");
  assert.match(assessment.requiredAction, /physician review/i);
  assert.ok(assessment.flags.includes("Patient notification pending"));
  assert.ok(assessment.flags.includes("Treatment scheduling gap"));
  assert.ok(assessment.graphPath.includes("Urgent Physician Review Task"));
});

test("SCC creates a high-priority surgical scheduling pathway", () => {
  const assessment = assessCase(
    pathologyCase({
      diagnosis: "Invasive squamous cell carcinoma",
      patientNotified: "Yes",
      treatmentScheduled: "No",
    }),
  );

  assert.equal(assessment.priority, "High");
  assert.equal(assessment.isMalignant, true);
  assert.equal(assessment.dueTiming, "Within 72 hours");
  assert.deepEqual(assessment.flags, ["Treatment scheduling gap"]);
  assert.ok(assessment.graphPath.includes("Squamous Cell Carcinoma"));
});

test("BCC creates a moderate-priority treatment pathway", () => {
  const assessment = assessCase(
    pathologyCase({
      diagnosis: "Nodular basal cell carcinoma",
      treatmentScheduled: "No",
    }),
  );

  assert.equal(assessment.priority, "Moderate");
  assert.equal(assessment.isMalignant, true);
  assert.equal(assessment.dueTiming, "Within 2 weeks");
  assert.match(assessment.requiredAction, /Mohs or excision/i);
  assert.ok(assessment.graphPath.includes("Basal Cell Carcinoma"));
});

test("benign nevi retain a closed-loop notification task", () => {
  const assessment = assessCase(
    pathologyCase({
      diagnosis: "Benign compound nevus",
      treatmentScheduled: "Not required",
    }),
  );

  assert.equal(assessment.priority, "Routine");
  assert.equal(assessment.isMalignant, false);
  assert.equal(assessment.dueTiming, "Within 7 days");
  assert.deepEqual(assessment.flags, ["Patient notification pending"]);
  assert.ok(assessment.graphPath.includes("Patient Notification Task"));
});

test("unrecognized diagnoses still produce a follow-up path", () => {
  const assessment = assessCase(
    pathologyCase({
      diagnosis: "Atypical lymphoid infiltrate",
      patientNotified: "Yes",
      treatmentScheduled: "Not required",
    }),
  );

  assert.equal(assessment.priority, "Routine");
  assert.equal(assessment.isMalignant, false);
  assert.deepEqual(assessment.flags, []);
  assert.deepEqual(assessment.graphPath.slice(-2), [
    "Atypical lymphoid infiltrate",
    "Follow-Up Task",
  ]);
});

test("priority rank preserves urgent-to-routine ordering", () => {
  assert.ok(priorityRank.Urgent < priorityRank.High);
  assert.ok(priorityRank.High < priorityRank.Moderate);
  assert.ok(priorityRank.Moderate < priorityRank.Routine);
});
