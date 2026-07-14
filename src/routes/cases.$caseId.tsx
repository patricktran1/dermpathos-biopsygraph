import { createFileRoute, Link } from "@tanstack/react-router";
import { useDermStore } from "@/lib/derm/store";
import { assessCase } from "@/lib/derm/logic";
import { PriorityBadge } from "@/components/PriorityBadge";
import { CaseBiopsyGraphPanel } from "@/components/CaseBiopsyGraphPanel";
import { CaseBackendStatusPanel } from "@/components/CaseBackendStatusPanel";
import type {
  AgentAction,
  EvidenceItem,
  ObligationState,
  WorkflowStep,
} from "@/lib/derm/types";

export const Route = createFileRoute("/cases/$caseId")({
  component: CaseDetailPage,
  notFoundComponent: () => (
    <div className="mx-auto max-w-xl px-6 py-20 text-center">
      <h1 className="font-display text-2xl font-semibold">Case not found</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Reset the synthetic clinic and try again.
      </p>
      <Link
        to="/dashboard"
        className="mt-6 inline-block rounded-lg bg-[var(--lavender)] px-4 py-2 text-sm font-semibold text-primary-foreground"
      >
        Back to dashboard
      </Link>
    </div>
  ),
});

function CaseDetailPage() {
  const { caseId } = Route.useParams();
  const { getCase, tasks, applyAgentAction } = useDermStore();
  const c = getCase(caseId);

  if (!c) {
    return (
      <div className="mx-auto max-w-xl px-6 py-20 text-center">
        <h1 className="font-display text-2xl font-semibold">Case not found</h1>
        <Link
          to="/dashboard"
          className="mt-6 inline-block rounded-lg bg-[var(--lavender)] px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          Back to dashboard
        </Link>
      </div>
    );
  }

  const a = assessCase(c);
  const task = tasks[c.id];

  return (
    <div className="mx-auto max-w-7xl px-6 py-9">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/dashboard"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Clinical obligations
        </Link>
        <div className="flex items-center gap-2">
          <PriorityBadge priority={a.priority} />
          <StateBadge state={a.obligationState} />
        </div>
      </div>

      <section className="mb-7 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="grid lg:grid-cols-[1fr_310px]">
          <div className="p-7">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--lavender)]">
              Clinical obligation · {c.patientName}
            </div>
            <h1 className="mt-3 max-w-4xl font-display text-3xl font-semibold tracking-tight md:text-4xl">
              {a.headline}
            </h1>
            <p className="mt-3 max-w-3xl text-base leading-relaxed text-muted-foreground">
              {a.summary}
            </p>
            <div className="mt-6 flex flex-wrap gap-2 text-xs">
              <Meta label="Diagnosis" value={c.diagnosis} />
              <Meta label="Biopsy site" value={c.bodySite} />
              <Meta label="Report date" value={c.reportDate ?? "Available"} />
              <Meta label="Owner" value={c.physician} />
            </div>
          </div>
          <div className="border-t border-border bg-muted/35 p-6 lg:border-l lg:border-t-0">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Closure standard
            </div>
            <div className="mt-3 text-lg font-semibold">
              {a.obligationState === "Closed"
                ? "Verified complete"
                : a.canClose
                  ? "Evidence complete, approval pending"
                  : "Required evidence is missing"}
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              A reviewed result is not closed care. The record must prove patient
              communication and, when required, completed definitive treatment.
            </p>
            <div className="mt-4 rounded-lg border border-border bg-card p-3 text-xs">
              <div className="text-muted-foreground">Current task</div>
              <div className="mt-1 font-semibold">{task?.title ?? a.taskTitle}</div>
              <div className="mt-1 text-muted-foreground">Due {a.dueTiming}</div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-7 lg:grid-cols-[1fr_360px]">
        <main className="space-y-7">
          {a.blockers.length > 0 && (
            <section className="rounded-xl border border-[var(--urgent)]/25 bg-[var(--urgent-soft)]/45 p-5">
              <SectionTitle>Safety interlock</SectionTitle>
              <div className="mt-3 text-lg font-semibold">
                The agent stopped this workflow instead of guessing.
              </div>
              <div className="mt-3 space-y-2">
                {a.blockers.map((blocker) => (
                  <div
                    key={blocker}
                    className="rounded-lg border border-[var(--urgent)]/20 bg-card/75 p-3 text-sm"
                  >
                    {blocker}
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="card-clinical p-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <SectionTitle>Source-linked evidence</SectionTitle>
                <p className="mt-2 text-sm text-muted-foreground">
                  Every conclusion is tied to the record the agent searched.
                </p>
              </div>
              <span className="rounded-full bg-[var(--lavender-soft)] px-3 py-1 text-[11px] font-semibold text-[var(--lavender)]">
                {a.evidence.length} evidence checks
              </span>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {a.evidence.map((item) => (
                <EvidenceCard key={`${item.label}-${item.value}`} item={item} />
              ))}
            </div>
            <div className="mt-5 rounded-lg bg-muted/60 p-4">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Pathology source excerpt
              </div>
              <p className="mt-2 font-mono text-sm leading-relaxed">
                {c.pathologyResult}
              </p>
            </div>
          </section>

          <section className="card-clinical p-6">
            <SectionTitle>Detect · Decide · Act · Verify</SectionTitle>
            <p className="mt-2 text-sm text-muted-foreground">
              The obligation stays open until every required step has defensible
              evidence.
            </p>
            <div className="mt-6 space-y-0">
              {a.workflow.map((step, index) => (
                <WorkflowRow
                  key={step.id}
                  step={step}
                  last={index === a.workflow.length - 1}
                />
              ))}
            </div>
          </section>

          <section className="card-clinical p-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <SectionTitle>Audit trail</SectionTitle>
                <p className="mt-2 text-sm text-muted-foreground">
                  What happened, what the agent inferred, and what a human approved.
                </p>
              </div>
              <span className="text-xs text-muted-foreground">
                {(c.auditTrail ?? []).length} events
              </span>
            </div>
            <div className="mt-5 divide-y divide-border">
              {(c.auditTrail ?? []).map((event) => (
                <div key={event.id} className="grid gap-2 py-4 sm:grid-cols-[125px_85px_1fr]">
                  <div className="text-xs text-muted-foreground">{event.at}</div>
                  <div>
                    <span className="rounded-md bg-muted px-2 py-1 text-[10px] font-semibold uppercase tracking-wider">
                      {event.actor}
                    </span>
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{event.action}</div>
                    <div className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {event.detail}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section id="graph" className="card-clinical p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <SectionTitle>Clinical obligation graph</SectionTitle>
              <span className="text-xs text-muted-foreground">
                Patient → evidence → obligation → verified outcome
              </span>
            </div>
            <GraphPath nodes={a.graphPath} />
          </section>

          <details className="card-clinical p-6">
            <summary className="cursor-pointer text-sm font-semibold">
              Technical integration evidence
            </summary>
            <div className="mt-5 space-y-6">
              <CaseBackendStatusPanel caseId={c.id} />
              <CaseBiopsyGraphPanel caseId={c.id} patientName={c.patientName} />
            </div>
          </details>
        </main>

        <aside className="space-y-5 lg:sticky lg:top-6 lg:self-start">
          <section className="card-clinical p-5">
            <SectionTitle>Agent recommendation</SectionTitle>
            <div className="mt-3 text-lg font-semibold">{a.requiredAction}</div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {a.taskReason}
            </p>

            <div className="mt-5 space-y-3">
              {a.actions.length > 0 ? (
                a.actions.map((action) => (
                  <ActionButton
                    key={action.id}
                    action={action}
                    onClick={() => applyAgentAction(c.id, action.id)}
                  />
                ))
              ) : (
                <div className="rounded-lg bg-[var(--routine-soft)] p-4 text-sm text-[var(--routine)]">
                  No further action is required. The evidence chain is complete.
                </div>
              )}
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-5">
            <SectionTitle>Bounded autonomy</SectionTitle>
            <div className="mt-3 space-y-3 text-sm">
              <SafetyLine
                label="Agent may"
                value="search records, detect gaps, draft outreach, create internal tasks, and verify evidence"
              />
              <SafetyLine
                label="Human controls"
                value="patient-facing communication, treatment decisions, discrepancy resolution, and final closure"
              />
              <SafetyLine
                label="Agent must"
                value="stop when evidence conflicts or required information is missing"
              />
            </div>
          </section>

          {a.flags.length > 0 && (
            <section className="rounded-xl border border-border bg-card p-5">
              <SectionTitle>Open evidence gaps</SectionTitle>
              <div className="mt-3 flex flex-wrap gap-2">
                {a.flags.map((flag) => (
                  <span
                    key={flag}
                    className="rounded-md bg-muted px-2.5 py-1.5 text-xs text-foreground/80"
                  >
                    {flag}
                  </span>
                ))}
              </div>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
      {children}
    </h2>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-full border border-border bg-card px-3 py-1.5">
      <span className="text-muted-foreground">{label}: </span>
      <span className="font-medium">{value}</span>
    </span>
  );
}

function StateBadge({ state }: { state: ObligationState }) {
  const cls: Record<ObligationState, string> = {
    "Critical gap": "bg-[var(--urgent-soft)] text-[var(--urgent)]",
    Blocked: "bg-[var(--high-soft)] text-[var(--high)]",
    "In progress": "bg-[var(--lavender-soft)] text-[var(--lavender)]",
    "Ready to close": "bg-[var(--gold-soft)] text-[var(--gold)]",
    Closed: "bg-[var(--routine-soft)] text-[var(--routine)]",
  };
  return <span className={`chip ${cls[state]}`}>{state}</span>;
}

function EvidenceCard({ item }: { item: EvidenceItem }) {
  const cls = {
    neutral: "border-border bg-card",
    good: "border-[var(--routine)]/20 bg-[var(--routine-soft)]/35",
    warning: "border-[var(--gold)]/25 bg-[var(--gold-soft)]/40",
    danger: "border-[var(--urgent)]/25 bg-[var(--urgent-soft)]/40",
  }[item.tone ?? "neutral"];

  return (
    <div className={`rounded-lg border p-4 ${cls}`}>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {item.label}
      </div>
      <div className="mt-1 text-sm font-semibold">{item.value}</div>
      <div className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
        {item.source}
      </div>
    </div>
  );
}

function WorkflowRow({ step, last }: { step: WorkflowStep; last: boolean }) {
  const state = {
    complete: {
      dot: "bg-[var(--routine)] text-white",
      line: "bg-[var(--routine)]/25",
      label: "Complete",
    },
    active: {
      dot: "bg-[var(--lavender)] text-white",
      line: "bg-border",
      label: "Active",
    },
    missing: {
      dot: "bg-[var(--urgent-soft)] text-[var(--urgent)]",
      line: "bg-border",
      label: "Missing",
    },
    blocked: {
      dot: "bg-[var(--high-soft)] text-[var(--high)]",
      line: "bg-border",
      label: "Blocked",
    },
  }[step.status];

  return (
    <div className="grid grid-cols-[32px_1fr_auto] gap-3">
      <div className="flex flex-col items-center">
        <div
          className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${state.dot}`}
        >
          {step.status === "complete" ? "✓" : step.status === "blocked" ? "!" : "•"}
        </div>
        {!last && <div className={`min-h-8 w-px flex-1 ${state.line}`} />}
      </div>
      <div className={last ? "pb-0" : "pb-5"}>
        <div className="text-sm font-semibold">{step.label}</div>
        <div className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {step.detail}
        </div>
      </div>
      <div className="pt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {state.label}
      </div>
    </div>
  );
}

function ActionButton({
  action,
  onClick,
}: {
  action: AgentAction;
  onClick: () => void;
}) {
  const primary = action.kind === "escalation" || action.kind === "verify";
  return (
    <button
      onClick={onClick}
      className={`w-full rounded-lg border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${
        primary
          ? "border-[var(--lavender)]/30 bg-[var(--lavender-soft)]/55"
          : "border-border bg-card hover:bg-accent"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="text-sm font-semibold">{action.label}</div>
        <span className="shrink-0 rounded-full bg-card px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
          {action.requiresApproval ? "Approval" : "Agent"}
        </span>
      </div>
      <div className="mt-2 text-xs leading-relaxed text-muted-foreground">
        {action.description}
      </div>
    </button>
  );
}

function SafetyLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 leading-relaxed">{value}</div>
    </div>
  );
}

function GraphPath({ nodes }: { nodes: string[] }) {
  const nodeTone = (label: string) => {
    const l = label.toLowerCase();
    if (l.includes("verified closure"))
      return "bg-[var(--routine-soft)] text-[var(--routine)] border-[var(--routine)]/30";
    if (l.includes("missing") || l.includes("gap") || l.includes("unverified"))
      return "bg-[var(--urgent-soft)] text-[var(--urgent)] border-[var(--urgent)]/30";
    if (l.includes("conflict") || l.includes("blocked"))
      return "bg-[var(--high-soft)] text-[var(--high)] border-[var(--high)]/30";
    if (l.includes("melanoma") || l.includes("squamous") || l.includes("basal"))
      return "bg-[var(--urgent-soft)] text-[var(--urgent)] border-[var(--urgent)]/30";
    return "bg-[var(--lavender-soft)] text-[var(--lavender)] border-[var(--lavender)]/30";
  };

  return (
    <div className="mt-6 flex flex-wrap items-center gap-x-1 gap-y-3">
      {nodes.map((node, index) => (
        <div key={`${node}-${index}`} className="flex items-center gap-1">
          <div
            className={`rounded-lg border px-3 py-2 text-xs font-semibold ${nodeTone(node)}`}
          >
            {node}
          </div>
          {index < nodes.length - 1 && (
            <span className="text-muted-foreground">→</span>
          )}
        </div>
      ))}
    </div>
  );
}
