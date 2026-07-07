import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { DEMO_CASES, useDermStore } from "@/lib/derm/store";
import { assessCase } from "@/lib/derm/logic";
import type { CaseAssessment, PathologyCase, YesNo } from "@/lib/derm/types";
import type { SubmitBackendResult } from "@/lib/derm/butterbase";
import {
  parsePathologyReport,
  FIELD_LABELS,
  type ParsedFields,
} from "@/lib/derm/pathologyParser";
import {
  compressImageFile,
  ACCEPTED_IMAGE_EXT,
} from "@/lib/derm/imageUpload";

const SMART_PASTE_EXAMPLE = `Patient: Jane Test
DOB: 1968-05-12
Biopsy Date: 07/07/2026
Site: Left cheek
Biopsy Type: Shave biopsy
Final Diagnosis: Basal cell carcinoma, nodular type
Margins: Transected at base
Ordering Physician: Dr. Tran`;

export const Route = createFileRoute("/intake")({
  head: () => ({
    meta: [
      { title: "Case Intake · DermPathOS" },
      {
        name: "description",
        content: "Log a new dermatology pathology case for BiopsyGraph review.",
      },
    ],
  }),
  component: IntakePage,
});

type FormState = Omit<PathologyCase, "id" | "createdAt">;

const empty: FormState = {
  patientName: "",
  age: 0,
  dob: "",
  reportDate: "",
  biopsyDate: "",
  bodySite: "",
  biopsyType: "Shave biopsy",
  pathologyResult: "",
  diagnosis: "",
  margins: "",
  patientNotified: "No",
  treatmentScheduled: "No",
  physician: "Dr. Tran",
  clinicalDescription: "",
  clinicalConcern: "",
  clinicNoteExcerpt: "",
  clinicalPhotoDataUrl: "",
  pathologyImageDataUrl: "",
  clinicalPhotoLabel: "",
  pathologyImageLabel: "",
};

function ageFromDob(dob: string | undefined): number {
  if (!dob) return 0;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return 0;
  const now = new Date();
  let a = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a--;
  return a > 0 && a < 130 ? a : 0;
}


function IntakePage() {
  const { recordSubmittedCase } = useDermStore();
  const [form, setForm] = useState<FormState>(empty);
  const [status, setStatus] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const [backendResponse, setBackendResponse] =
    useState<SubmitBackendResult | null>(null);
  const [assessment, setAssessment] = useState<CaseAssessment | null>(null);
  const [submittedCaseId, setSubmittedCaseId] = useState<string | null>(null);
  const [steps, setSteps] = useState<{
    biopsy: "pending" | "ok" | "fail" | "idle";
    task: "pending" | "ok" | "fail" | "idle";
    graph: "pending" | "ok" | "fail" | "idle";
    rocket: "pending" | "ok" | "fail" | "pending_config" | "idle";
  }>({ biopsy: "idle", task: "idle", graph: "idle", rocket: "idle" });
  const [submitting, setSubmitting] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [parsedPreview, setParsedPreview] = useState<ParsedFields | null>(null);
  const smartPasteWarning = useMemo(() => {
    if (!parsedPreview) return null;
    const missing: string[] = [];
    if (!form.dob) missing.push("DOB");
    if (!form.biopsyDate) missing.push("biopsy date");
    return missing.length > 0
      ? `Please review: ${missing.join(" and/or ")} could not be found in the pasted report.`
      : null;
  }, [form.dob, form.biopsyDate, parsedPreview]);

  const runSmartPaste = () => {
    const parsed = parsePathologyReport(pasteText);
    const changed: ParsedFields = {};
    const next: FormState = { ...form };
    (Object.keys(parsed) as (keyof ParsedFields)[]).forEach((k) => {
      const v = parsed[k];
      if (v === undefined || v === null || v === "") return;
      (next as Record<string, unknown>)[k] = v;
      (changed as Record<string, unknown>)[k] = v;
    });
    // Derive age from DOB if we have DOB but no explicit age
    if (next.dob && (!next.age || next.age === 0)) {
      const a = ageFromDob(next.dob);
      if (a > 0) {
        next.age = a;
        (changed as Record<string, unknown>).age = a;
      }
    }
    setForm(next);
    setParsedPreview(changed);
  };

  const clearSmartPaste = () => {
    setPasteText("");
    setParsedPreview(null);
  };

  const [imageError, setImageError] = useState<{
    clinical?: string | null;
    pathology?: string | null;
  }>({});

  const handleImageUpload = async (
    slot: "clinical" | "pathology",
    file: File | null,
  ) => {
    setImageError((p) => ({ ...p, [slot]: null }));
    if (!file) return;
    const res = await compressImageFile(file);
    if (!res.ok || !res.image) {
      setImageError((p) => ({ ...p, [slot]: res.error ?? "Upload failed." }));
      return;
    }
    if (slot === "clinical") set("clinicalPhotoDataUrl", res.image.dataUrl);
    else set("pathologyImageDataUrl", res.image.dataUrl);
  };

  const clearImage = (slot: "clinical" | "pathology") => {
    if (slot === "clinical") set("clinicalPhotoDataUrl", "");
    else set("pathologyImageDataUrl", "");
    setImageError((p) => ({ ...p, [slot]: null }));
  };

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const loadDemo = (i: number) => {
    const d = DEMO_CASES[i];
    const { id: _id, createdAt: _c, ...rest } = d;
    setForm(rest);
    setStatus(null);
    setBackendResponse(null);
    setSubmittedCaseId(null);
    setSteps({ biopsy: "idle", task: "idle", graph: "idle", rocket: "idle" });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    setBackendResponse(null);
    setSubmittedCaseId(null);
    setSubmitting(true);
    setSteps({ biopsy: "pending", task: "pending", graph: "pending", rocket: "pending" });
    try {
      const provisionalCase: PathologyCase = {
        ...form,
        id: "pending",
        createdAt: Date.now(),
      };
      const assessment = assessCase(provisionalCase);
      setAssessment(assessment);
      const response = await fetch("/api/cases/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patient_name: form.patientName,
          age: String((form.age && form.age > 0 ? form.age : ageFromDob(form.dob)) || ""),
          dob: form.dob ?? "",
          biopsy_date: form.biopsyDate,
          body_site: form.bodySite,
          biopsy_type: form.biopsyType,
          pathology_result_text: form.pathologyResult,
          diagnosis: form.diagnosis,
          margins: form.margins,
          responsible_physician: form.physician,
          priority: assessment.priority,
          required_action: assessment.requiredAction,
          clinical_description: form.clinicalDescription ?? "",
          clinical_concern: form.clinicalConcern ?? "",
          clinic_note_excerpt: form.clinicNoteExcerpt ?? "",
          clinical_photo_present: Boolean(form.clinicalPhotoDataUrl),
          pathology_image_present: Boolean(form.pathologyImageDataUrl),
          clinical_photo_label: form.clinicalPhotoLabel ?? "",
          pathology_image_label: form.pathologyImageLabel ?? "",
        }),
      });
      const result = (await response.json()) as SubmitBackendResult;
      setBackendResponse(result);
      const caseOk = result.butterbase?.biopsy_case_saved === true;
      const taskOk = result.butterbase?.follow_up_task_saved === true;
      const graphSynced = result.neo4j?.graph_synced === true;
      const graphVerified = result.neo4j?.verified === true;
      const rr = result.rocketride;
      const rrStatus = rr?.status;
      const rrHttp = rr?.http_status;
      const rrWebhook = rr?.webhook_triggered;
      const rrCompleted = rr?.agent_completed === true;
      const rrTriggered =
        rrWebhook === true ||
        (rrHttp != null && rrHttp >= 200 && rrHttp < 300) ||
        rrStatus === "triggered" ||
        rrStatus === "completed" ||
        rrStatus === "complete";
      const rocketStep: "ok" | "fail" | "pending_config" =
        rrCompleted || rrTriggered
          ? "ok"
          : rrStatus === "pending_configuration"
            ? "pending_config"
            : "fail";
      setSteps({
        biopsy: caseOk ? "ok" : "fail",
        task: taskOk ? "ok" : "fail",
        graph: graphSynced && graphVerified ? "ok" : "fail",
        rocket: rocketStep,
      });

      if (result.caseKey && caseOk) {
        const savedCase: PathologyCase = {
          ...form,
          id: result.caseKey,
          createdAt: Date.now(),
        };
        recordSubmittedCase(
          savedCase,
          {
            caseId: result.caseKey,
            title: assessment.requiredAction,
            priority: assessment.priority,
            physician: form.physician,
            dueTiming: assessment.dueTiming,
            reason: assessment.taskReason,
            status: "Open",
          },
          {
            mode: "butterbase_and_graph",
            caseKey: result.caseKey,
            taskKey: result.taskKey,
            butterbaseCaseSaved: caseOk,
            butterbaseTaskSaved: taskOk,
            graphSynced,
            graphVerified,
            partialSuccess: result.partial_success === true,
            graphError: result.neo4j?.error,
            rocketrideStatus: result.rocketride?.status,
            rocketrideMessage: result.rocketride?.message ?? result.rocketride?.error,
            rocketrideResponse: result.rocketride?.response,
            lastResponse: result,
          },
        );
        setSubmittedCaseId(result.caseKey);
      }

      if (result.success && caseOk && taskOk && graphSynced && graphVerified) {
        setStatus({
          ok: true,
          message: result.message,
        });
        return;
      }
      if (caseOk && taskOk && (!graphSynced || !graphVerified)) {
        setStatus({
          ok: false,
          message: result.message,
        });
        return;
      }
      setStatus({
        ok: false,
        message:
          result.message ?? "Submission failed. See backend response below.",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setSteps({ biopsy: "fail", task: "fail", graph: "fail", rocket: "fail" });
      setBackendResponse({
        success: false,
        message: `Network error calling /api/cases/submit: ${message}`,
      });
      setStatus({
        ok: false,
        message: `Network error calling /api/cases/submit: ${message}`,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-semibold">Pathology Case Intake</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Log a biopsy result. BiopsyGraph classifies priority and generates the
          operational follow-up task.
        </p>
      </div>

      <div className="card-clinical mb-6 p-5">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Auto-fill demo case
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {DEMO_CASES.map((c, i) => (
            <button
              key={c.id}
              type="button"
              onClick={() => loadDemo(i)}
              className="rounded-lg border border-border bg-card px-4 py-3 text-left transition hover:border-[var(--lavender)] hover:bg-[var(--lavender-soft)]"
            >
              <div className="text-sm font-semibold">{c.patientName}</div>
              <div className="text-xs text-muted-foreground">{c.diagnosis}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="card-clinical mb-6 p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Smart Paste Pathology Report
          </div>
          <div className="text-[11px] text-muted-foreground">
            Client-side parser. No upload, no AI call.
          </div>
        </div>
        <textarea
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          rows={7}
          placeholder="Paste pathology report text, clinical note excerpt, or biopsy context here..."
          style={{ caretColor: "#111827", color: "#111827" }}
          className={`${inputCls} font-mono text-xs cursor-text`}
        />
        <p className="mt-2 text-[11px] text-muted-foreground">
          Review parsed fields before submitting. Smart Paste does not submit automatically.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={runSmartPaste}
            disabled={!pasteText.trim()}
            className="rounded-lg bg-[var(--lavender)] px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-95 disabled:opacity-50"
          >
            Parse into case
          </button>
          <button
            type="button"
            onClick={clearSmartPaste}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Clear Smart Paste
          </button>
        </div>
        {parsedPreview && <SmartPastePreview parsed={parsedPreview} />}
        {smartPasteWarning && (
          <div className="mt-3 rounded-md border border-[var(--gold)]/50 bg-[var(--gold-soft)]/40 px-3 py-2 text-xs text-[var(--gold)]">
            {smartPasteWarning}
          </div>
        )}
      </div>

      <form onSubmit={submit} className="card-clinical space-y-5 p-6">

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Patient name">
            <input required value={form.patientName} onChange={(e) => set("patientName", e.target.value)} className={inputCls} />
          </Field>
          <Field label="Date of birth">
            <input
              required
              type="date"
              value={form.dob ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                setForm((p) => ({ ...p, dob: v, age: ageFromDob(v) || p.age }));
              }}
              className={`${inputCls} ${smartPasteWarning && !form.dob ? "border-[var(--gold)] ring-2 ring-[var(--gold-soft)]" : ""}`}
            />
            {form.dob && (
              <div className="mt-1 text-[11px] text-muted-foreground">
                Derived age: {ageFromDob(form.dob) || "—"}
              </div>
            )}
          </Field>
          <Field label="Biopsy date">
            <input
              required
              type="date"
              value={form.biopsyDate}
              onChange={(e) => set("biopsyDate", e.target.value)}
              className={`${inputCls} ${smartPasteWarning && !form.biopsyDate ? "border-[var(--gold)] ring-2 ring-[var(--gold-soft)]" : ""}`}
            />
          </Field>
          <Field label="Body site">
            <input required value={form.bodySite} onChange={(e) => set("bodySite", e.target.value)} className={inputCls} />
          </Field>

          <Field label="Biopsy type">
            <select value={form.biopsyType} onChange={(e) => set("biopsyType", e.target.value)} className={inputCls}>
              <option>Shave biopsy</option>
              <option>Punch biopsy</option>
              <option>Excisional biopsy</option>
              <option>Incisional biopsy</option>
            </select>
          </Field>
          <Field label="Responsible physician">
            <input required value={form.physician} onChange={(e) => set("physician", e.target.value)} className={inputCls} />
          </Field>
        </div>

        <Field label="Pathology result text">
          <textarea required rows={3} value={form.pathologyResult} onChange={(e) => set("pathologyResult", e.target.value)} className={`${inputCls} font-mono text-sm`} />
        </Field>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Diagnosis">
            <input required value={form.diagnosis} onChange={(e) => set("diagnosis", e.target.value)} className={inputCls} />
          </Field>
          <Field label="Margins">
            <input required value={form.margins} onChange={(e) => set("margins", e.target.value)} className={inputCls} />
          </Field>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Patient notified?">
            <YesNoToggle value={form.patientNotified} onChange={(v) => set("patientNotified", v)} />
          </Field>
          <Field label="Treatment scheduled?">
            <YesNoToggle value={form.treatmentScheduled} onChange={(v) => set("treatmentScheduled", v)} includeNA />
          </Field>
        </div>

        <div className="rounded-md border border-dashed border-border bg-muted/20 p-4">
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Clinical context (optional)
            </div>
            <div className="text-[11px] text-muted-foreground">
              Expands pathology-only follow-up into clinicopathologic safety context.
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Clinical description">
              <textarea
                rows={2}
                value={form.clinicalDescription ?? ""}
                onChange={(e) => set("clinicalDescription", e.target.value)}
                className={inputCls}
                placeholder="e.g. 8mm pink pearly papule with telangiectasias"
              />
            </Field>
            <Field label="Clinical concern / rule-out">
              <textarea
                rows={2}
                value={form.clinicalConcern ?? ""}
                onChange={(e) => set("clinicalConcern", e.target.value)}
                className={inputCls}
                placeholder="e.g. Rule out BCC vs SCC"
              />
            </Field>
          </div>
          <div className="mt-4">
            <Field label="Clinic note excerpt">
              <textarea
                rows={3}
                value={form.clinicNoteExcerpt ?? ""}
                onChange={(e) => set("clinicNoteExcerpt", e.target.value)}
                className={inputCls}
                placeholder="Short excerpt from clinic note relevant to this biopsy"
              />
            </Field>
          </div>
        </div>

        <div className="rounded-md border border-dashed border-border bg-muted/20 p-4">
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Visual evidence (optional)
            </div>
            <div className="text-[11px] text-muted-foreground">
              Images stored client-side only. No AI interpretation, no diagnostic claims.
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <ImageUploadField
              title="Pre-biopsy clinical photo"
              dataUrl={form.clinicalPhotoDataUrl ?? ""}
              label={form.clinicalPhotoLabel ?? ""}
              onFile={(f) => handleImageUpload("clinical", f)}
              onLabelChange={(v) => set("clinicalPhotoLabel", v)}
              onClear={() => clearImage("clinical")}
              error={imageError.clinical ?? null}
              labelPlaceholder="e.g. Left cheek lesion, before shave"
            />
            <ImageUploadField
              title="Pathology image / photomicrograph"
              dataUrl={form.pathologyImageDataUrl ?? ""}
              label={form.pathologyImageLabel ?? ""}
              onFile={(f) => handleImageUpload("pathology", f)}
              onLabelChange={(v) => set("pathologyImageLabel", v)}
              onClear={() => clearImage("pathology")}
              error={imageError.pathology ?? null}
              labelPlaceholder="e.g. H&E 10x, nests at DEJ"
            />
          </div>
        </div>




        {(submitting || steps.biopsy !== "idle") && (
          <div className="space-y-1 rounded-md border border-border bg-muted/40 p-3 text-xs">
            <StepRow state={steps.biopsy} label="Saving biopsy case to Butterbase…" />
            <StepRow state={steps.task} label="Creating follow-up task…" />
            <StepRow state={steps.graph} label="Syncing BiopsyGraph…" />
            <RocketRideStepRow step={steps.rocket} result={backendResponse} />
          </div>
        )}

        {status && (
          <div
            className={`rounded-md border px-3 py-2 text-xs ${
              status.ok
                ? "border-[var(--routine)]/40 bg-[var(--routine-soft)]/40 text-[var(--routine)]"
                : "border-[var(--moderate)]/50 bg-[var(--moderate-soft)]/40 text-[var(--moderate)]"
            }`}
          >
            {status.message}
          </div>
        )}

        {backendResponse && (
          <BackendSubmitPanel result={backendResponse} form={form} assessment={assessment} />
        )}

        {submittedCaseId && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[var(--lavender)]/40 bg-[var(--lavender-soft)]/40 px-3 py-2 text-xs">
            <span className="text-muted-foreground">
              Case recorded. A follow-up task was queued for accountable review.
            </span>
            <div className="flex gap-2">
              <Link
                to="/cases/$caseId"
                params={{ caseId: submittedCaseId }}
                className="font-semibold text-[var(--lavender)] hover:underline"
              >
                Open case detail
              </Link>
              <Link
                to="/follow-up"
                className="rounded-md bg-[var(--lavender)] px-3 py-1 text-xs font-semibold text-primary-foreground hover:opacity-95"
              >
                View Follow-Up Safety Queue →
              </Link>
            </div>
          </div>
        )}
        <div className="text-[11px] text-muted-foreground">
          Secrets are server-side only. The browser never receives the Butterbase API key.
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-border pt-5">
          <button type="button" onClick={() => { setForm(empty); setBackendResponse(null); setSubmittedCaseId(null); setStatus(null); setSteps({ biopsy: "idle", task: "idle", graph: "idle", rocket: "idle" }); setPasteText(""); setParsedPreview(null); }} className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent">
            Clear
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-[var(--lavender)] px-5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-95 disabled:opacity-60"
          >
            {submitting ? "Submitting…" : "Submit Case"}
          </button>
        </div>
      </form>
    </div>
  );
}

function BackendSubmitPanel({
  result,
  form,
  assessment,
}: {
  result: SubmitBackendResult;
  form: FormState;
  assessment: CaseAssessment | null;
}) {
  const neoError = result.neo4j?.error;
  const [lastBackendResponse, setLastBackendResponse] = useState<any>(null);
  const [status, setStatus] = useState<string | null>(null);
  const fullJsonRef = useRef<HTMLTextAreaElement>(null);
  const rocketrideJsonRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setLastBackendResponse(result);
  }, [result]);

  useEffect(() => {
    if (!status) return;
    const id = window.setTimeout(() => setStatus(null), 2000);
    return () => window.clearTimeout(id);
  }, [status]);

  async function copyToClipboard(value: unknown, label: "full" | "rocketride") {
    const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        textarea.style.top = "-9999px";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setStatus(label === "full" ? "Full JSON copied" : "RocketRide JSON copied");
    } catch (error) {
      console.error("Copy failed", error);
      setStatus("Copy failed");
    }
  }

  function selectTextarea(ref: React.RefObject<HTMLTextAreaElement | null>) {
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.select();
    setStatus("Selected. Press Cmd+C.");
  }

  function downloadJson(value: unknown, filename: string) {
    const text = JSON.stringify(value, null, 2);
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setStatus(`Downloaded ${filename}`);
  }

  const fullJson = JSON.stringify(lastBackendResponse, null, 2);
  const rocketrideJson = JSON.stringify(lastBackendResponse?.rocketride ?? {}, null, 2);

  return (
    <div className="space-y-4">
      <RocketRidePanel result={result} form={form} assessment={assessment} />

      <div className="rounded-md border border-border bg-muted/30 p-4 text-sm">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Backend response from /api/cases/submit
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <StatusKV label="caseKey" value={result.caseKey ?? "—"} mono />
          <StatusKV label="taskKey" value={result.taskKey ?? "—"} mono />
          <StatusKV
            label="Butterbase biopsy case saved"
            value={String(result.butterbase?.biopsy_case_saved === true)}
          />
          <StatusKV
            label="Butterbase follow-up task saved"
            value={String(result.butterbase?.follow_up_task_saved === true)}
          />
          <StatusKV
            label="BiopsyGraph synced"
            value={String(result.neo4j?.graph_synced === true)}
          />
          <StatusKV
            label="BiopsyGraph verified"
            value={String(result.neo4j?.verified === true)}
          />
          <StatusKV
            label="RocketRide safety agent"
            value={
              result.rocketride?.status === "completed" || result.rocketride?.status === "complete"
                ? "agent completed"
                : result.rocketride?.status === "triggered"
                  ? "webhook triggered"
                    : result.rocketride?.status === "failed"
                      ? "failed"
                      : result.rocketride?.status === "timeout_nonblocking"
                        ? "timed out (non-blocking)"
                        : result.rocketride?.status === "missing_configuration"
                          ? "missing configuration"
                          : result.rocketride?.status === "pending_configuration"
                            ? "pending configuration"
                            : "—"
            }
          />
          <StatusKV
            label="Daytona sandbox"
            value={
              result.daytona?.status === "configured"
                ? "configured"
                : result.daytona?.status === "not_configured"
                  ? "not configured"
                  : "—"
            }
          />
        </div>
        {neoError && (
          <div className="mt-3 rounded-md border border-[var(--moderate)]/40 bg-[var(--moderate-soft)]/40 p-3 text-xs text-[var(--moderate)]">
            {neoError}
          </div>
        )}

        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Full backend JSON response
          </summary>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => copyToClipboard(lastBackendResponse, "full")}
              disabled={!lastBackendResponse}
              className="rounded-lg bg-[var(--lavender)] px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-95 disabled:opacity-50"
            >
              Copy Full Backend JSON
            </button>
            <button
              type="button"
              onClick={() => copyToClipboard(lastBackendResponse?.rocketride ?? {}, "rocketride")}
              disabled={!lastBackendResponse}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
            >
              Copy RocketRide Only
            </button>
            <button
              type="button"
              onClick={() => selectTextarea(fullJsonRef)}
              disabled={!lastBackendResponse}
              className="rounded-lg bg-[var(--lavender-soft)] px-3 py-1.5 text-xs font-semibold text-foreground hover:opacity-95 disabled:opacity-50"
            >
              Select Full Backend JSON
            </button>
            <button
              type="button"
              onClick={() => selectTextarea(rocketrideJsonRef)}
              disabled={!lastBackendResponse}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
            >
              Select RocketRide JSON
            </button>
            <button
              type="button"
              onClick={() => downloadJson(lastBackendResponse, "dermpathos-backend-response.json")}
              disabled={!lastBackendResponse}
              className="rounded-lg bg-[var(--routine-soft)] px-3 py-1.5 text-xs font-semibold text-foreground hover:opacity-95 disabled:opacity-50"
            >
              Download Full Backend JSON
            </button>
            <button
              type="button"
              onClick={() => downloadJson(lastBackendResponse?.rocketride ?? {}, "dermpathos-rocketride-response.json")}
              disabled={!lastBackendResponse}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
            >
              Download RocketRide JSON
            </button>
          </div>
          {status && (
            <div className="mt-2 text-xs font-medium text-[var(--lavender)]">{status}</div>
          )}
          <div className="mt-3 space-y-3">
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Full backend JSON
            </label>
            <textarea
              ref={fullJsonRef}
              readOnly
              value={fullJson}
              className="w-full min-h-[260px] rounded-md border border-border bg-background/70 p-3 font-mono text-xs whitespace-pre select-text cursor-text overflow-auto resize-y"
            />
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              RocketRide JSON
            </label>
            <textarea
              ref={rocketrideJsonRef}
              readOnly
              value={rocketrideJson}
              className="w-full min-h-[260px] rounded-md border border-border bg-background/70 p-3 font-mono text-xs whitespace-pre select-text cursor-text overflow-auto resize-y"
            />
          </div>
        </details>
      </div>
    </div>
  );
}

function RocketRidePanel({
  result,
  form,
  assessment,
}: {
  result: SubmitBackendResult;
  form: FormState;
  assessment: CaseAssessment | null;
}) {
  const rr = result.rocketride;
  if (!rr) return null;

  const rawAgentFields = extractRocketRideAgentFields(rr);
  const { validated, reason } = validateRocketRideAgentOutput(
    rr,
    rawAgentFields,
    form,
    assessment,
  );

  const isCompleted = rr.agent_completed === true;
  const isTriggered =
    rr.webhook_triggered === true ||
    (rr.http_status != null && rr.http_status >= 200 && rr.http_status < 300);
  const isFailed = rr.status === "failed";
  const isPendingConfig = rr.status === "pending_configuration";

  // Show validated agent output if valid; otherwise show the safe fallback
  // when the workflow was at least accepted (triggered / http 200).
  const agentFields: RocketRideAgentFields = validated
    ? rawAgentFields
    : isTriggered
      ? SAFE_FALLBACK_AGENT_FIELDS
      : {};
  const hasAgentFields = Boolean(
    agentFields.risk_summary ||
      agentFields.recommended_next_action ||
      agentFields.safety_status ||
      agentFields.handoff,
  );

  const statusLabel = isCompleted
    ? "Completed"
    : isFailed
      ? "Failed"
      : isPendingConfig
        ? "Pending configuration"
        : isTriggered
          ? "Webhook triggered"
          : "—";

  const statusTone = isCompleted
    ? "routine"
    : isFailed
      ? "urgent"
      : isPendingConfig
        ? "gold"
        : isTriggered
          ? "routine"
          : "muted";

  const statusColor = `var(--${statusTone})`;
  const statusSoft = `var(--${statusTone}-soft)`;

  return (
    <section
      className="overflow-hidden rounded-2xl border bg-card p-0"
      style={{ borderColor: statusSoft }}
    >
      <div className="px-6 py-5" style={{ backgroundColor: statusSoft }}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-semibold" style={{ color: statusColor }}>
              RocketRide Safety Agent
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Agentic safety workflow triggered after Butterbase save and BiopsyGraph sync.
            </p>
          </div>
          <span
            className="chip"
            style={{ backgroundColor: statusSoft, color: statusColor }}
          >
            {statusLabel}
          </span>
        </div>
      </div>

      <div className="space-y-6 p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <RRField label="Agent name" value="DermPathOS Follow-Up Safety Agent" />
          <RRField label="Workflow status" value={statusLabel} />
          <RRField
            label="HTTP status"
            value={rr.http_status !== undefined ? String(rr.http_status) : "—"}
          />
          <RRField
            label="Webhook triggered"
            value={rr.webhook_triggered === true ? "true" : "false"}
          />
        </div>

        <div className="rounded-xl border border-border bg-muted/20 p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Case reviewed
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <RRField label="Diagnosis" value={form.diagnosis || "—"} />
            <RRField label="Margins" value={form.margins || "—"} />
            <RRField label="Priority" value={assessment?.priority ?? "—"} />
            <RRField label="Required action" value={assessment?.requiredAction ?? "—"} />
          </div>
        </div>

        {hasAgentFields && (
          <div className="rounded-xl border border-border bg-muted/20 p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Agent output
              </div>
              {!validated && isTriggered && (
                <span
                  className="chip"
                  style={{
                    backgroundColor: "var(--gold-soft)",
                    color: "var(--gold)",
                  }}
                  title={`RocketRide agent output rejected: ${reason ?? "unknown"}`}
                >
                  Safe fallback
                </span>
              )}
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {agentFields.risk_summary && (
                <RRField label="Risk summary" value={agentFields.risk_summary} />
              )}
              {agentFields.recommended_next_action && (
                <RRField
                  label="Recommended next action"
                  value={agentFields.recommended_next_action}
                />
              )}
              {agentFields.safety_status && (
                <RRField label="Safety status" value={agentFields.safety_status} />
              )}
              {agentFields.handoff && <RRField label="Handoff" value={agentFields.handoff} />}
            </div>
            <div className="mt-3 grid gap-1 text-[11px] text-muted-foreground sm:grid-cols-2">
              <div>
                <span className="font-mono">rocketride_agent_output_validated:</span>{" "}
                {validated ? "true" : "false"}
              </div>
              <div>
                <span className="font-mono">rocketride_agent_output_rejected_reason:</span>{" "}
                {reason ?? "null"}
              </div>
            </div>
          </div>
        )}


        {!isCompleted && isTriggered && (
          <div className="rounded-xl border border-[var(--routine)]/30 bg-[var(--routine-soft)]/20 p-4 text-sm text-foreground">
            RocketRide Cloud accepted the DermPathOS safety-agent workflow. The case has been
            handed off for agentic safety review without blocking the clinical safety record.
          </div>
        )}

        {isPendingConfig && (
          <div className="rounded-xl border border-[var(--gold)]/40 bg-[var(--gold-soft)]/30 p-4 text-sm text-foreground">
            Core safety net complete. RocketRide pipeline built, waiting for workflow URL/API
            credentials.
          </div>
        )}

        {isFailed && (
          <div className="rounded-xl border border-[var(--urgent)]/40 bg-[var(--urgent-soft)]/30 p-4 text-sm text-foreground">
            RocketRide safety agent failed: {rr.error ?? "Unknown error"}
            {rr.http_status !== undefined ? ` (HTTP ${rr.http_status})` : ""}
          </div>
        )}

        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <span style={{ color: statusColor }}>▸</span>
          <span>
            Why this matters: Butterbase stores the operational record, BiopsyGraph preserves the
            relationship trail, and RocketRide runs the safety-agent workflow.
          </span>
        </div>
      </div>
    </section>
  );
}

type RocketRideAgentFields = {
  risk_summary?: string;
  recommended_next_action?: string;
  safety_status?: string;
  handoff?: string;
};

const SAFE_FALLBACK_AGENT_FIELDS: Required<RocketRideAgentFields> = {
  risk_summary:
    "RocketRide Cloud accepted the DermPathOS safety-agent workflow handoff, but no case-specific synchronous agent result was returned.",
  recommended_next_action:
    "Use the verified BiopsyGraph safety trail and required follow-up task for this case.",
  safety_status: "Agent workflow handoff confirmed; synchronous review pending",
  handoff:
    "Core safety net completed. Butterbase saved the record, BiopsyGraph verified the case relationship, and RocketRide received the workflow trigger.",
};

function extractRocketRideAgentFields(
  rr: NonNullable<SubmitBackendResult["rocketride"]>,
): RocketRideAgentFields {
  const response = rr.response;
  if (!response || typeof response !== "object") return {};

  const data = (response as Record<string, unknown>).data;
  if (!data || typeof data !== "object") return {};

  const objects = (data as Record<string, unknown>).objects;
  if (!objects || typeof objects !== "object") return {};

  const body = (objects as Record<string, unknown>).body;
  if (!body || typeof body !== "object") return {};

  const answers = (body as Record<string, unknown>).answers;
  if (!Array.isArray(answers) || answers.length === 0) return {};

  const first = answers[0];
  if (typeof first !== "string") return {};

  const jsonMatch = first.match(/```json\n?([\s\S]*?)\n?```/);
  if (!jsonMatch) return {};

  try {
    const parsed = JSON.parse(jsonMatch[1]) as Record<string, unknown>;
    return {
      risk_summary: typeof parsed.risk_summary === "string" ? parsed.risk_summary : undefined,
      recommended_next_action:
        typeof parsed.recommended_next_action === "string"
          ? parsed.recommended_next_action
          : undefined,
      safety_status: typeof parsed.safety_status === "string" ? parsed.safety_status : undefined,
      handoff: typeof parsed.handoff === "string" ? parsed.handoff : undefined,
    };
  } catch {
    return {};
  }
}

type RocketRideRejectionReason =
  | "missing"
  | "timeout"
  | "mismatched_case"
  | "contradicts_case"
  | null;

function validateRocketRideAgentOutput(
  rr: NonNullable<SubmitBackendResult["rocketride"]>,
  fields: RocketRideAgentFields,
  form: FormState,
  assessment: CaseAssessment | null,
): { validated: boolean; reason: RocketRideRejectionReason } {
  if (
    rr.status === "timeout_nonblocking" ||
    (typeof rr.error === "string" && /timeout|abort/i.test(rr.error))
  ) {
    return { validated: false, reason: "timeout" };
  }

  const combined = [
    fields.risk_summary,
    fields.recommended_next_action,
    fields.safety_status,
    fields.handoff,
  ]
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .join(" \n ")
    .toLowerCase();

  if (!combined) return { validated: false, reason: "missing" };

  const diagnosis = (form.diagnosis || "").toLowerCase().trim();
  const margins = (form.margins || "").toLowerCase().trim();
  const site = (form.bodySite || "").toLowerCase().trim();
  const requiredAction = (assessment?.requiredAction || "").toLowerCase().trim();
  const priority = (assessment?.priority || "").toLowerCase().trim();

  // Contradictions
  const mentionsMelanoma = /melanoma/.test(combined);
  const mentionsBenign = /\bbenign\b|\bnevus\b/.test(combined);
  if (/melanoma/.test(diagnosis) && mentionsBenign && !mentionsMelanoma) {
    return { validated: false, reason: "contradicts_case" };
  }
  if (/benign|nevus/.test(diagnosis) && mentionsMelanoma) {
    return { validated: false, reason: "contradicts_case" };
  }

  const mentionsClearMargins = /clear margins?|margins?\s+(are\s+)?clear|negative margins?/.test(
    combined,
  );
  const mentionsInvolvedMargins =
    /involved margins?|margins?\s+(are\s+)?involved|positive margins?/.test(combined);
  if (/involved|positive/.test(margins) && mentionsClearMargins && !mentionsInvolvedMargins) {
    return { validated: false, reason: "contradicts_case" };
  }
  if (/clear|negative/.test(margins) && mentionsInvolvedMargins && !mentionsClearMargins) {
    return { validated: false, reason: "contradicts_case" };
  }

  if (priority === "urgent" && /\broutine\b/.test(combined) && !/urgent/.test(combined)) {
    return { validated: false, reason: "contradicts_case" };
  }

  // Match — must reference diagnosis OR required_action OR site
  const dxTokens = diagnosis.split(/\s+/).filter((t) => t.length >= 4);
  const actionTokens = requiredAction.split(/\s+/).filter((t) => t.length >= 5);
  const siteTokens = site.split(/\s+/).filter((t) => t.length >= 4);
  const matchesDx = dxTokens.some((t) => combined.includes(t));
  const matchesAction = actionTokens.some((t) => combined.includes(t));
  const matchesSite = siteTokens.some((t) => combined.includes(t));

  if (!matchesDx && !matchesAction && !matchesSite) {
    return { validated: false, reason: "mismatched_case" };
  }

  return { validated: true, reason: null };
}

function StatusKV({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className={`mt-1 font-medium ${mono ? "font-mono text-xs" : ""}`}>
        {value}
      </div>
    </div>
  );
}

function StepRow({
  state,
  label,
}: {
  state: "pending" | "ok" | "fail" | "idle" | "pending_config";
  label: string;
}) {
  const icon =
    state === "ok"
      ? "✓"
      : state === "fail"
        ? "✗"
        : state === "pending"
          ? "…"
          : state === "pending_config"
            ? "⏸"
            : "•";
  const cls =
    state === "ok"
      ? "text-[var(--routine)]"
      : state === "fail"
        ? "text-[var(--moderate)]"
        : state === "pending_config"
          ? "text-[var(--gold)]"
          : "text-muted-foreground";
  const suffix = state === "pending_config" ? " (pending configuration)" : "";
  return (
    <div className={`flex items-center gap-2 ${cls}`}>
      <span className="inline-block w-4 text-center">{icon}</span>
      <span>
        {label}
        {suffix}
      </span>
    </div>
  );
}

function RocketRideStepRow({
  step,
  result,
}: {
  step: "pending" | "ok" | "fail" | "idle" | "pending_config";
  result: SubmitBackendResult | null;
}) {
  const rr = result?.rocketride;
  const isCompleted = rr?.agent_completed === true;
  const isTriggered =
    rr?.webhook_triggered === true ||
    (rr?.http_status != null && rr.http_status >= 200 && rr.http_status < 300);
  let label: string;
  if (step === "ok") {
    label = isCompleted
      ? "RocketRide safety agent completed"
      : "RocketRide safety agent webhook triggered";
  } else if (step === "fail") {
    label = "RocketRide safety agent failed";
  } else if (step === "pending_config") {
    label = "RocketRide pending configuration";
  } else {
    label = "Checking RocketRide safety agent…";
  }
  const icon =
    step === "ok"
      ? "✓"
      : step === "fail"
        ? "✗"
        : step === "pending"
          ? "…"
          : step === "pending_config"
            ? "⏸"
            : "•";
  const cls =
    step === "ok"
      ? "text-[var(--routine)]"
      : step === "fail"
        ? "text-[var(--moderate)]"
        : step === "pending_config"
          ? "text-[var(--gold)]"
          : "text-muted-foreground";
  return (
    <div className={`flex items-center gap-2 ${cls}`}>
      <span className="inline-block w-4 text-center">{icon}</span>
      <span>{label}</span>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none transition focus:border-[var(--lavender)] focus:ring-2 focus:ring-[var(--lavender-soft)]";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

function YesNoToggle({
  value,
  onChange,
  includeNA,
}: {
  value: YesNo;
  onChange: (v: YesNo) => void;
  includeNA?: boolean;
}) {
  const opts: YesNo[] = includeNA ? ["Yes", "No", "Not required"] : ["Yes", "No"];
  return (
    <div className="inline-flex rounded-lg border border-border p-1">
      {opts.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
            value === o
              ? "bg-[var(--lavender-soft)] text-[var(--lavender)]"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

function SmartPastePreview({ parsed }: { parsed: ParsedFields }) {
  const entries = (Object.keys(parsed) as (keyof ParsedFields)[])
    .filter((k) => k !== "pathologyResult")
    .map((k) => [k, parsed[k]] as const)
    .filter(([, v]) => v !== undefined && v !== null && v !== "");

  if (entries.length === 0) {
    return (
      <div className="mt-3 rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
        No structured fields detected. Paste a report with labels like Patient, Site, Diagnosis, or Margins.
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-md border border-border bg-muted/30 p-3 text-xs">
      <div className="mb-2 font-semibold uppercase tracking-wider text-muted-foreground">
        Parsed fields (review before submit)
      </div>
      <ul className="space-y-1">
        {entries.map(([k, v]) => (
          <li key={k} className="flex gap-2">
            <span className="min-w-24 text-muted-foreground">{FIELD_LABELS[k]}:</span>
            <span className="font-medium">{String(v)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ImageUploadField({
  title,
  dataUrl,
  label,
  onFile,
  onLabelChange,
  onClear,
  error,
  labelPlaceholder,
}: {
  title: string;
  dataUrl: string;
  label: string;
  onFile: (file: File | null) => void;
  onLabelChange: (v: string) => void;
  onClear: () => void;
  error: string | null;
  labelPlaceholder?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-background/60 p-3">
      <div className="text-xs font-semibold">{title}</div>
      <div className="mt-2 flex items-start gap-3">
        {dataUrl ? (
          <img
            src={dataUrl}
            alt={label || title}
            className="h-20 w-20 rounded-md border border-border object-cover"
          />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-md border border-dashed border-border text-[10px] text-muted-foreground">
            No image
          </div>
        )}
        <div className="flex-1 space-y-2">
          <input
            type="file"
            accept={ACCEPTED_IMAGE_EXT}
            onChange={(e) => onFile(e.target.files?.[0] ?? null)}
            className="block w-full text-xs file:mr-2 file:rounded-md file:border-0 file:bg-[var(--lavender-soft)] file:px-2 file:py-1 file:text-xs file:font-semibold file:text-[var(--lavender)] hover:file:bg-[var(--lavender-soft)]/80"
          />
          <input
            type="text"
            value={label}
            onChange={(e) => onLabelChange(e.target.value)}
            placeholder={labelPlaceholder ?? "Optional label"}
            className={inputCls + " text-xs"}
          />
          {dataUrl && (
            <button
              type="button"
              onClick={onClear}
              className="text-[11px] font-semibold text-muted-foreground underline hover:text-foreground"
            >
              Remove image
            </button>
          )}
        </div>
      </div>
      {error && (
        <div className="mt-2 rounded-md border border-[var(--moderate)]/40 bg-[var(--moderate-soft)]/40 px-2 py-1.5 text-[11px] text-[var(--moderate)]">
          {error}
        </div>
      )}
      <div className="mt-2 text-[10px] text-muted-foreground">
        JPG, PNG, or WEBP. Compressed client-side. No AI interpretation.
      </div>
    </div>
  );
}

function RRField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-sm font-medium">{value}</div>
    </div>
  );
}
