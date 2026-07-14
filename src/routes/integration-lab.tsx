import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { normalizeAbridgePayload, SYNTHETIC_ABRIDGE_PAYLOAD } from "@/lib/event-stack/abridge";
import {
  EVENT_TOOL_NAMES,
  type AgentRunResult,
  type AgentTraceEntry,
} from "@/lib/event-stack/contracts";

export const Route = createFileRoute("/integration-lab")({
  head: () => ({
    meta: [
      { title: "Event Stack Lab · Closed Care Loop" },
      {
        name: "description",
        content:
          "Abridge encounter intelligence, Anthropic tool use, and an OpenEMR-compatible EHR adapter working as one bounded clinical workflow agent.",
      },
    ],
  }),
  component: IntegrationLab,
});

const APPROVED_WRITES = [
  EVENT_TOOL_NAMES.createTask,
  EVENT_TOOL_NAMES.draftPatientCommunication,
  EVENT_TOOL_NAMES.createServiceRequest,
];

function IntegrationLab() {
  const encounter = useMemo(
    () => normalizeAbridgePayload(SYNTHETIC_ABRIDGE_PAYLOAD),
    [],
  );
  const [result, setResult] = useState<AgentRunResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forceMockEhr, setForceMockEhr] = useState(true);

  const run = async (approveWrites: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/agent/orchestrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          encounter,
          approvedActionIds: approveWrites ? APPROVED_WRITES : [],
          forceMockEhr,
        }),
      });
      const body = (await response.json()) as AgentRunResult | { message?: string };
      if (!response.ok || !("trace" in body)) {
        throw new Error("message" in body ? body.message : "Agent orchestration failed.");
      }
      setResult(body);
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Agent orchestration failed.");
    } finally {
      setLoading(false);
    }
  };

  const blockedCount =
    result?.trace.filter((entry) => Boolean(entry.result.blockedReason)).length ?? 0;
  const writeCount =
    result?.trace.filter((entry) => entry.result.writeAttempted).length ?? 0;

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-5">
        <div>
          <div className="chip bg-[var(--gold-soft)] text-[var(--gold)]">
            Saturday event stack
          </div>
          <h1 className="mt-4 font-display text-4xl font-semibold">
            Abridge → Anthropic → EHR
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            Abridge supplies encounter intelligence. Claude decides which typed EHR
            tools are needed. The application executes those tools through an EHR
            adapter, with OpenEMR FHIR as the reference implementation and explicit
            approval gates on every write.
          </p>
        </div>
        <label className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-sm">
          <input
            type="checkbox"
            checked={forceMockEhr}
            onChange={(event) => setForceMockEhr(event.target.checked)}
          />
          Safe mock EHR
        </label>
      </header>

      <section className="mb-7 grid gap-4 md:grid-cols-3">
        <StackCard
          number="01"
          title="Abridge adapter"
          detail="Normalizes the event-provided encounter payload into one stable clinical obligation contract."
        />
        <StackCard
          number="02"
          title="Anthropic tool loop"
          detail="Claude searches evidence first, selects minimum necessary actions, and receives structured tool results."
        />
        <StackCard
          number="03"
          title="EHR adapter"
          detail="Typed tools map to OpenEMR FHIR today and can be replaced with Epic, Oracle, athenahealth, or another EHR adapter later."
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="card-clinical p-6">
          <div className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Synthetic Abridge encounter
          </div>
          <h2 className="mt-3 text-xl font-semibold">{encounter.patientName}</h2>
          <div className="mt-1 text-xs text-muted-foreground">
            {encounter.encounterId} · {encounter.bodySite}
          </div>

          <div className="mt-5 rounded-xl bg-muted/45 p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Clinical summary
            </div>
            <p className="mt-2 text-sm leading-relaxed">{encounter.clinicalSummary}</p>
          </div>

          <div className="mt-4 rounded-xl border border-border p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Encounter transcript
            </div>
            <p className="mt-2 text-sm leading-relaxed text-foreground/80">
              {encounter.transcript}
            </p>
          </div>

          <div className="mt-5 space-y-2">
            {encounter.linkedEvidence.map((evidence) => (
              <div key={evidence.id} className="rounded-lg border border-border px-4 py-3">
                <div className="text-xs font-semibold">{evidence.label}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  “{evidence.quote}”
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => run(false)}
              disabled={loading}
              className="rounded-lg border border-border px-4 py-3 text-sm font-semibold hover:bg-accent disabled:opacity-50"
            >
              {loading ? "Running agent…" : "1. Inspect without approval"}
            </button>
            <button
              type="button"
              onClick={() => run(true)}
              disabled={loading}
              className="rounded-lg bg-[var(--lavender)] px-4 py-3 text-sm font-semibold text-primary-foreground hover:opacity-95 disabled:opacity-50"
            >
              {loading ? "Running agent…" : "2. Approve bounded writes"}
            </button>
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
            “Approve” authorizes only the three displayed draft actions. It does not
            send a patient message, alter treatment, or mark the obligation closed.
          </p>
        </section>

        <section className="card-clinical min-h-[620px] p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                Agent execution trace
              </div>
              <h2 className="mt-3 text-xl font-semibold">
                Typed tools, visible approvals, auditable results
              </h2>
            </div>
            {result && (
              <div className="flex gap-2">
                <Pill>{result.agentMode.replaceAll("_", " ")}</Pill>
                <Pill>{result.ehrMode.replaceAll("_", " ")}</Pill>
              </div>
            )}
          </div>

          {error && (
            <div className="mt-5 rounded-lg border border-[var(--urgent)]/25 bg-[var(--urgent-soft)] p-4 text-sm text-[var(--urgent)]">
              {error}
            </div>
          )}

          {!result && !error && (
            <div className="mt-20 text-center">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[var(--lavender-soft)] text-2xl text-[var(--lavender)]">
                ↳
              </div>
              <h3 className="mt-5 text-lg font-semibold">Run the approval boundary</h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                The first run shows Claude’s proposed EHR writes being blocked. The
                second run executes the same tools through the safe adapter.
              </p>
            </div>
          )}

          {result && (
            <>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <Metric label="Tool calls" value={result.trace.length} />
                <Metric label="Writes prepared" value={writeCount} />
                <Metric label="Approval blocks" value={blockedCount} />
              </div>

              {result.configurationMessage && (
                <div className="mt-4 rounded-lg bg-[var(--gold-soft)]/60 p-3 text-xs text-[var(--gold)]">
                  {result.configurationMessage}
                </div>
              )}

              <div className="mt-6 space-y-3">
                {result.trace.map((entry, index) => (
                  <TraceCard key={`${entry.id}-${index}`} entry={entry} index={index} />
                ))}
              </div>

              <div className="mt-6 rounded-xl border border-[var(--lavender)]/25 bg-[var(--lavender-soft)]/45 p-5">
                <div className="text-xs font-semibold uppercase tracking-wider text-[var(--lavender)]">
                  Agent conclusion
                </div>
                <p className="mt-2 text-sm leading-relaxed">{result.finalSummary}</p>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function StackCard({
  number,
  title,
  detail,
}: {
  number: string;
  title: string;
  detail: string;
}) {
  return (
    <div className="card-clinical p-5">
      <div className="text-xs font-semibold tracking-[0.16em] text-[var(--lavender)]">
        {number}
      </div>
      <div className="mt-3 text-base font-semibold">{title}</div>
      <div className="mt-2 text-sm leading-relaxed text-muted-foreground">{detail}</div>
    </div>
  );
}

function TraceCard({ entry, index }: { entry: AgentTraceEntry; index: number }) {
  const blocked = Boolean(entry.result.blockedReason);
  return (
    <div
      className={`rounded-xl border p-4 ${
        blocked
          ? "border-[var(--high)]/25 bg-[var(--high-soft)]/45"
          : entry.result.ok
            ? "border-[var(--routine)]/25 bg-[var(--routine-soft)]/35"
            : "border-[var(--urgent)]/25 bg-[var(--urgent-soft)]/40"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-card text-xs font-semibold">
            {index + 1}
          </span>
          <code className="text-xs font-semibold">{entry.tool}</code>
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {blocked ? "Approval blocked" : entry.result.resourceType ?? "Read tool"}
        </span>
      </div>
      <p className="mt-3 text-sm">{entry.result.summary}</p>
      {entry.result.blockedReason && (
        <p className="mt-2 text-xs font-medium text-[var(--high)]">
          {entry.result.blockedReason}
        </p>
      )}
      {entry.result.evidence && entry.result.evidence.length > 0 && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {entry.result.evidence.map((item) => (
            <div key={`${entry.id}-${item.label}`} className="rounded-md bg-card/70 px-3 py-2">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {item.label}
              </div>
              <div className="mt-1 text-xs font-semibold">{item.value}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-4">
      <div className="font-display text-2xl font-semibold">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function Pill({ children }: { children: string }) {
  return (
    <span className="chip bg-muted text-[10px] uppercase tracking-wider text-muted-foreground">
      {children}
    </span>
  );
}
