import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { normalizeAbridgePayload, SYNTHETIC_ABRIDGE_PAYLOAD } from "@/lib/event-stack/abridge";
import { useDermStore } from "@/lib/derm/store";
import type { PathologyCase, YesNo } from "@/lib/derm/types";

export const Route = createFileRoute("/intake")({
  head: () => ({
    meta: [
      { title: "Result Intake · Closed Care Loop" },
      {
        name: "description",
        content:
          "Create a clinical obligation from a pathology result or normalized Abridge encounter.",
      },
    ],
  }),
  component: IntakePage,
});

type FormState = Omit<PathologyCase, "id" | "createdAt">;

const EMPTY_FORM: FormState = {
  patientName: "",
  age: 0,
  dob: "",
  reportDate: new Date().toISOString().slice(0, 10),
  biopsyDate: "",
  bodySite: "",
  biopsyType: "Shave biopsy",
  pathologyResult: "",
  diagnosis: "",
  margins: "",
  patientNotified: "No",
  treatmentScheduled: "No",
  appointmentStatus: "Not scheduled",
  treatmentCompleted: "No",
  closureVerified: false,
  physician: "Dr. Tran",
};

function IntakePage() {
  const navigate = useNavigate();
  const { addCase } = useDermStore();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [source, setSource] = useState<"manual" | "abridge">("manual");

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((previous) => ({ ...previous, [key]: value }));

  const loadAbridgeDemo = () => {
    const encounter = normalizeAbridgePayload(SYNTHETIC_ABRIDGE_PAYLOAD);
    setForm({
      ...EMPTY_FORM,
      patientName: encounter.patientName,
      age: 42,
      reportDate: encounter.occurredAt ?? new Date().toISOString().slice(0, 10),
      biopsyDate: "2026-07-01",
      bodySite: encounter.bodySite ?? "",
      biopsyType: "Shave biopsy",
      pathologyResult: encounter.pathologyResult ?? encounter.clinicalSummary,
      diagnosis: "Melanoma in situ",
      margins: "Involved",
      clinicNoteExcerpt: encounter.clinicalSummary,
      clinicalConcern: encounter.assessmentPlan,
    });
    setSource("abridge");
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const pathologyCase = addCase({
      ...form,
      age: Number(form.age) || 0,
      auditTrail: [
        {
          id: `intake-${Date.now()}`,
          at: new Date().toLocaleString(),
          actor: "System",
          action:
            source === "abridge"
              ? "Obligation created from Abridge encounter"
              : "Obligation created from manual intake",
          detail:
            source === "abridge"
              ? "The normalized encounter payload was converted into a monitored pathology obligation."
              : "The pathology result was added to the local obligation queue.",
        },
      ],
    });
    navigate({ to: "/cases/$caseId", params: { caseId: pathologyCase.id } });
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--lavender)]">
            Obligation intake
          </div>
          <h1 className="mt-2 font-display text-3xl font-semibold">
            Turn a result into accountable follow-up
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Enter a pathology result manually or load the synthetic Abridge encounter.
            This page creates the local obligation; the event-stack lab demonstrates
            Anthropic tool use and EHR execution.
          </p>
        </div>
        <Link
          to="/integration-lab"
          className="rounded-lg border border-[var(--lavender)] px-4 py-2 text-sm font-semibold text-[var(--lavender)] hover:bg-[var(--lavender-soft)]"
        >
          Open event stack
        </Link>
      </div>

      <div className="mb-6 rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-sm font-semibold">Abridge adapter demo</div>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Load a synthetic encounter through the same normalization boundary that
              will map the event-provided Abridge schema on Saturday.
            </p>
          </div>
          <button
            type="button"
            onClick={loadAbridgeDemo}
            className="rounded-lg bg-[var(--lavender-soft)] px-4 py-2 text-sm font-semibold text-[var(--lavender)]"
          >
            Load Abridge encounter
          </button>
        </div>
        {source === "abridge" && (
          <div className="mt-4 rounded-lg bg-[var(--routine-soft)] px-3 py-2 text-xs text-[var(--routine)]">
            Normalized Abridge encounter loaded into the obligation form.
          </div>
        )}
      </div>

      <form onSubmit={submit} className="card-clinical p-6 md:p-8">
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Patient name">
            <input
              required
              value={form.patientName}
              onChange={(event) => set("patientName", event.target.value)}
              className="field"
              placeholder="Synthetic patient"
            />
          </Field>
          <Field label="Age">
            <input
              type="number"
              min={0}
              max={130}
              value={form.age || ""}
              onChange={(event) => set("age", Number(event.target.value))}
              className="field"
            />
          </Field>
          <Field label="Biopsy date">
            <input
              required
              type="date"
              value={form.biopsyDate}
              onChange={(event) => set("biopsyDate", event.target.value)}
              className="field"
            />
          </Field>
          <Field label="Report date">
            <input
              type="date"
              value={form.reportDate ?? ""}
              onChange={(event) => set("reportDate", event.target.value)}
              className="field"
            />
          </Field>
          <Field label="Body site">
            <input
              required
              value={form.bodySite}
              onChange={(event) => set("bodySite", event.target.value)}
              className="field"
              placeholder="Left upper back"
            />
          </Field>
          <Field label="Biopsy type">
            <select
              value={form.biopsyType}
              onChange={(event) => set("biopsyType", event.target.value)}
              className="field"
            >
              <option>Shave biopsy</option>
              <option>Punch biopsy</option>
              <option>Excisional biopsy</option>
              <option>Other</option>
            </select>
          </Field>
          <Field label="Diagnosis">
            <input
              required
              value={form.diagnosis}
              onChange={(event) => set("diagnosis", event.target.value)}
              className="field"
              placeholder="Melanoma in situ"
            />
          </Field>
          <Field label="Margins">
            <input
              value={form.margins}
              onChange={(event) => set("margins", event.target.value)}
              className="field"
              placeholder="Involved"
            />
          </Field>
          <Field label="Patient notification">
            <YesNoSelect
              value={form.patientNotified}
              onChange={(value) => set("patientNotified", value)}
            />
          </Field>
          <Field label="Treatment scheduling">
            <YesNoSelect
              value={form.treatmentScheduled}
              onChange={(value) => set("treatmentScheduled", value)}
            />
          </Field>
        </div>

        <div className="mt-5">
          <Field label="Pathology result">
            <textarea
              required
              rows={5}
              value={form.pathologyResult}
              onChange={(event) => set("pathologyResult", event.target.value)}
              className="field resize-y"
              placeholder="Paste the final pathology diagnosis and margin language."
            />
          </Field>
        </div>

        {form.clinicNoteExcerpt && (
          <div className="mt-5 rounded-xl border border-border bg-muted/30 p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Normalized encounter context
            </div>
            <p className="mt-2 text-sm leading-relaxed">{form.clinicNoteExcerpt}</p>
          </div>
        )}

        <div className="mt-7 flex flex-wrap justify-end gap-3">
          <Link
            to="/dashboard"
            className="rounded-lg border border-border px-5 py-2.5 text-sm font-semibold hover:bg-accent"
          >
            Cancel
          </Link>
          <button
            type="submit"
            className="rounded-lg bg-[var(--lavender)] px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-95"
          >
            Create clinical obligation
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

function YesNoSelect({
  value,
  onChange,
}: {
  value: YesNo;
  onChange: (value: YesNo) => void;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value as YesNo)}
      className="field"
    >
      <option value="No">No</option>
      <option value="Yes">Yes</option>
      <option value="Not required">Not required</option>
    </select>
  );
}
