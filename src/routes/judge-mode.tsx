import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { assessCase } from "@/lib/derm/logic";
import { DEMO_CASES, useDermStore } from "@/lib/derm/store";
import type {
  CaseAssessment,
  EvidenceItem,
  ObligationState,
  PathologyCase,
} from "@/lib/derm/types";

export const Route = createFileRoute("/judge-mode")({
  head: () => ({
    meta: [
      { title: "Judge Mode · Closed Care Loop" },
      {
        name: "description",
        content:
          "A guided three-minute demonstration of the Closed Care Loop clinical obligation agent.",
      },
    ],
  }),
  component: JudgeModePage,
});

type Scene = {
  id: string;
  eyebrow: string;
  title: string;
  narrative: string;
  caseId?: string;
  behavior?: string;
  proof?: string;
};

const SCENES: Scene[] = [
  {
    id: "scan",
    eyebrow: "01 · Detect",
    title: "Scan the clinic for obligations that look handled but are not closed.",
    narrative:
      "Closed Care Loop reconciles pathology, communication, scheduling, and procedure evidence. It ranks the gaps by patient-safety risk instead of waiting for a human to notice a stale inbox item.",
    behavior:
      "Four synthetic cases scanned. Three clinically meaningful failures surfaced immediately.",
    proof:
      "The agent does not treat a reviewed result, a sent message, or a scheduled appointment as proof of completed care.",
  },
  {
    id: "lost-melanoma",
    eyebrow: "02 · Escalate",
    title: "A melanoma result has no documented patient contact.",
    narrative:
      "The result posted four days ago. There is no communication, referral, or treatment-planning evidence. The agent identifies the obligation as a critical gap and prepares bounded outreach for clinician approval.",
    caseId: "case-sarah-miller",
    behavior:
      "Draft urgent outreach, create an accountable task, and preserve human approval for the clinical conversation.",
    proof:
      "The case remains open after notification because definitive treatment still has to be arranged and verified.",
  },
  {
    id: "wrong-site",
    eyebrow: "03 · Block",
    title: "Pathology says left cheek. Scheduling says right cheek.",
    narrative:
      "A conventional automation could accelerate the wrong workflow. Closed Care Loop compares the source evidence, detects the laterality conflict, and stops the scheduling path before an unsafe action moves forward.",
    caseId: "case-robert-lee",
    behavior:
      "Block automation and require a clinician to verify the intended treatment site.",
    proof:
      "Restraint is a product feature. When the evidence conflicts, the agent does less, not more.",
  },
  {
    id: "false-closure",
    eyebrow: "04 · Reopen",
    title: "The patient was notified and scheduled, but the appointment was canceled.",
    narrative:
      "Many workflows stop measuring after an appointment is created. This agent detects that definitive treatment never occurred and reopens the clinical obligation instead of preserving a misleading completed state.",
    caseId: "case-james-carter",
    behavior:
      "Remove the false closure, return the case to scheduling, and continue monitoring until completed care is found.",
    proof:
      "Scheduled is an activity. Treated is an outcome. Closed Care Loop knows the difference.",
  },
  {
    id: "architecture",
    eyebrow: "05 · Verify",
    title: "Language models interpret. Deterministic policy governs. Evidence closes the loop.",
    narrative:
      "Claude converts fragmented clinical records into structured risks and source-linked explanations. Deterministic rules control urgency, permissions, blockers, and closure. Humans approve high-stakes steps.",
    behavior:
      "The result is an auditable agent that can act without becoming an unbounded clinical decision-maker.",
    proof:
      "The dermatology wedge expands naturally into imaging, referrals, laboratory monitoring, prior authorization, and post-discharge obligations.",
  },
];

function JudgeModePage() {
  const { cases, loadDemoCases, resetDemo } = useDermStore();
  const [sceneIndex, setSceneIndex] = useState(0);
  const [autoplay, setAutoplay] = useState(false);

  useEffect(() => {
    if (cases.length === 0) loadDemoCases();
  }, [cases.length, loadDemoCases]);

  useEffect(() => {
    if (!autoplay || sceneIndex >= SCENES.length - 1) return;
    const timer = window.setTimeout(() => setSceneIndex((index) => index + 1), 6500);
    return () => window.clearTimeout(timer);
  }, [autoplay, sceneIndex]);

  useEffect(() => {
    if (sceneIndex >= SCENES.length - 1) setAutoplay(false);
  }, [sceneIndex]);

  const clinicCases = cases.length > 0 ? cases : DEMO_CASES;
  const assessedCases = useMemo(
    () => clinicCases.map((pathologyCase) => ({ pathologyCase, assessment: assessCase(pathologyCase) })),
    [clinicCases],
  );

  const stats = useMemo(() => {
    const critical = assessedCases.filter(
      ({ assessment }) => assessment.obligationState === "Critical gap",
    ).length;
    const blocked = assessedCases.filter(
      ({ assessment }) => assessment.obligationState === "Blocked",
    ).length;
    const falseClosure = assessedCases.filter(({ pathologyCase }) =>
      pathologyCase.appointmentStatus === "Canceled",
    ).length;
    return { total: assessedCases.length, critical, blocked, falseClosure };
  }, [assessedCases]);

  const scene = SCENES[sceneIndex];
  const selectedCase = scene.caseId
    ? clinicCases.find((pathologyCase) => pathologyCase.id === scene.caseId) ??
      DEMO_CASES.find((pathologyCase) => pathologyCase.id === scene.caseId)
    : undefined;
  const selectedAssessment = selectedCase ? assessCase(selectedCase) : undefined;

  const restart = () => {
    resetDemo();
    setSceneIndex(0);
    setAutoplay(false);
  };

  return (
    <div className="min-h-[calc(100vh-132px)] bg-muted/20">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="chip bg-[var(--gold-soft)] text-[var(--gold)]">
              Judge Mode · 3-minute guided demo
            </div>
            <h1 className="mt-3 font-display text-3xl font-semibold md:text-4xl">
              Every clinical promise, carried through.
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Use the arrows or autoplay. The live command center remains available at
              any point for deeper inspection.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setAutoplay((value) => !value)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                autoplay
                  ? "bg-[var(--gold-soft)] text-[var(--gold)]"
                  : "border border-border bg-card hover:bg-accent"
              }`}
            >
              {autoplay ? "Pause autoplay" : "Start autoplay"}
            </button>
            <button
              type="button"
              onClick={restart}
              className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold hover:bg-accent"
            >
              Reset demo
            </button>
            <Link
              to="/dashboard"
              className="rounded-lg bg-[var(--lavender)] px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-95"
            >
              Open command center
            </Link>
          </div>
        </header>

        <div className="mb-6 grid gap-2 sm:grid-cols-5">
          {SCENES.map((item, index) => (
            <button
              type="button"
              key={item.id}
              onClick={() => {
                setSceneIndex(index);
                setAutoplay(false);
              }}
              className={`rounded-lg border px-3 py-3 text-left transition ${
                index === sceneIndex
                  ? "border-[var(--lavender)] bg-[var(--lavender-soft)]"
                  : index < sceneIndex
                    ? "border-border bg-card text-foreground"
                    : "border-border bg-card text-muted-foreground hover:bg-accent"
              }`}
            >
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em]">
                Step {index + 1}
              </div>
              <div className="mt-1 text-xs font-semibold">{item.id.replaceAll("-", " ")}</div>
            </button>
          ))}
        </div>

        <main className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <section className="card-clinical flex min-h-[560px] flex-col p-7 md:p-9">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--lavender)]">
              {scene.eyebrow}
            </div>
            <h2 className="mt-5 font-display text-3xl font-semibold leading-tight md:text-4xl">
              {scene.title}
            </h2>
            <p className="mt-5 text-base leading-relaxed text-foreground/75">
              {scene.narrative}
            </p>

            <div className="mt-8 space-y-4">
              <NarrativeCard label="Agent behavior">{scene.behavior}</NarrativeCard>
              <NarrativeCard label="Why it matters">{scene.proof}</NarrativeCard>
            </div>

            <div className="mt-auto flex items-center justify-between gap-3 pt-10">
              <button
                type="button"
                onClick={() => {
                  setSceneIndex((index) => Math.max(0, index - 1));
                  setAutoplay(false);
                }}
                disabled={sceneIndex === 0}
                className="rounded-lg border border-border px-4 py-2 text-sm font-semibold disabled:opacity-35"
              >
                Previous
              </button>
              <div className="text-xs text-muted-foreground">
                {sceneIndex + 1} / {SCENES.length}
              </div>
              <button
                type="button"
                onClick={() => {
                  setSceneIndex((index) => Math.min(SCENES.length - 1, index + 1));
                  setAutoplay(false);
                }}
                disabled={sceneIndex === SCENES.length - 1}
                className="rounded-lg bg-[var(--lavender)] px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-35"
              >
                Next
              </button>
            </div>
          </section>

          <section className="card-clinical min-h-[560px] overflow-hidden">
            {scene.id === "scan" ? (
              <ClinicScan cases={assessedCases} stats={stats} />
            ) : scene.id === "architecture" ? (
              <ArchitectureSummary />
            ) : selectedCase && selectedAssessment ? (
              <CaseScene pathologyCase={selectedCase} assessment={selectedAssessment} />
            ) : (
              <div className="p-8 text-sm text-muted-foreground">Demo case unavailable.</div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}

function NarrativeCard({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-muted/35 p-4">
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 text-sm font-medium leading-relaxed">{children}</div>
    </div>
  );
}

function ClinicScan({
  cases,
  stats,
}: {
  cases: Array<{ pathologyCase: PathologyCase; assessment: CaseAssessment }>;
  stats: { total: number; critical: number; blocked: number; falseClosure: number };
}) {
  return (
    <div className="p-7 md:p-9">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Clinic scan complete
          </div>
          <h3 className="mt-2 font-display text-2xl font-semibold">
            Three obligations require intervention.
          </h3>
        </div>
        <span className="chip bg-[var(--routine-soft)] text-[var(--routine)]">
          Evidence reconciled
        </span>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metric label="Cases scanned" value={stats.total} />
        <Metric label="Critical gaps" value={stats.critical} />
        <Metric label="Unsafe conflicts" value={stats.blocked} />
        <Metric label="False closures" value={stats.falseClosure} />
      </div>

      <div className="mt-7 divide-y divide-border rounded-xl border border-border">
        {cases.map(({ pathologyCase, assessment }) => (
          <div key={pathologyCase.id} className="grid gap-3 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{pathologyCase.patientName}</span>
                <StatePill state={assessment.obligationState} />
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                {pathologyCase.diagnosis} · {pathologyCase.bodySite}
              </div>
              <div className="mt-2 text-xs font-medium">{assessment.headline}</div>
            </div>
            <Link
              to="/cases/$caseId"
              params={{ caseId: pathologyCase.id }}
              className="text-sm font-semibold text-[var(--lavender)] hover:underline"
            >
              Inspect evidence →
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}

function CaseScene({
  pathologyCase,
  assessment,
}: {
  pathologyCase: PathologyCase;
  assessment: CaseAssessment;
}) {
  const keyEvidence = assessment.evidence.filter(
    (item) => item.tone === "danger" || item.tone === "warning",
  );
  const shownEvidence = keyEvidence.length > 0 ? keyEvidence : assessment.evidence.slice(0, 3);

  return (
    <div>
      <div className="border-b border-border bg-muted/35 p-7 md:p-9">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Live case · {pathologyCase.patientName}
            </div>
            <h3 className="mt-2 font-display text-2xl font-semibold">
              {assessment.headline}
            </h3>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {assessment.summary}
            </p>
          </div>
          <StatePill state={assessment.obligationState} />
        </div>
      </div>

      <div className="p-7 md:p-9">
        {assessment.blockers.length > 0 && (
          <div className="mb-6 rounded-xl border border-[var(--urgent)]/25 bg-[var(--urgent-soft)] p-4">
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--urgent)]">
              Automation stopped
            </div>
            {assessment.blockers.map((blocker) => (
              <div key={blocker} className="mt-2 text-sm font-medium">
                {blocker}
              </div>
            ))}
          </div>
        )}

        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Evidence driving the decision
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {shownEvidence.map((item) => (
            <EvidenceCard key={`${item.label}-${item.value}`} item={item} />
          ))}
        </div>

        <div className="mt-7 rounded-xl border border-border bg-muted/30 p-5">
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Next bounded action
          </div>
          <div className="mt-3 text-lg font-semibold">
            {assessment.actions[0]?.label ?? "Continue evidence monitoring"}
          </div>
          <div className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {assessment.actions[0]?.description ??
              "No new action is permitted until additional qualifying evidence appears."}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">
              {assessment.requiresHumanReview
                ? "Human approval required"
                : "Deterministic action permitted"}
            </span>
            <Link
              to="/cases/$caseId"
              params={{ caseId: pathologyCase.id }}
              className="rounded-lg bg-[var(--lavender)] px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              Open live workflow
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function ArchitectureSummary() {
  const layers = [
    {
      number: "1",
      title: "Claude interpretation",
      detail: "Extract risks, ambiguity, and source-linked explanations from fragmented clinical records.",
    },
    {
      number: "2",
      title: "Deterministic policy",
      detail: "Control deadlines, allowed actions, state transitions, conflicts, and closure criteria.",
    },
    {
      number: "3",
      title: "Human authorization",
      detail: "Require clinician or staff approval for outreach, discrepancy resolution, and clinical routing.",
    },
    {
      number: "4",
      title: "Evidence verification",
      detail: "Close only when the communication and required-care evidence chain is complete.",
    },
  ];

  return (
    <div className="p-7 md:p-9">
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        Safety architecture
      </div>
      <h3 className="mt-2 font-display text-2xl font-semibold">
        Agentic where useful. Deterministic where necessary.
      </h3>
      <div className="mt-7 grid gap-4 sm:grid-cols-2">
        {layers.map((layer) => (
          <div key={layer.number} className="rounded-xl border border-border bg-muted/30 p-5">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-[var(--lavender-soft)] text-sm font-bold text-[var(--lavender)]">
              {layer.number}
            </div>
            <div className="mt-4 font-semibold">{layer.title}</div>
            <div className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {layer.detail}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-7 rounded-xl border border-[var(--gold)]/25 bg-[var(--gold-soft)]/45 p-5">
        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--gold)]">
          Expansion thesis
        </div>
        <div className="mt-2 text-lg font-semibold">One obligation engine, many workflows.</div>
        <p className="mt-2 text-sm leading-relaxed text-foreground/75">
          Begin with dermatology pathology, then extend the same monitored-care graph to
          abnormal imaging, referrals, laboratory surveillance, medication monitoring,
          prior authorization, and post-discharge follow-up.
        </p>
      </div>
      <div className="mt-6 flex justify-end">
        <Link
          to="/agent-review"
          className="rounded-lg bg-[var(--lavender)] px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          Open Claude review layer
        </Link>
      </div>
    </div>
  );
}

function EvidenceCard({ item }: { item: EvidenceItem }) {
  const tone = {
    danger: "border-[var(--urgent)]/25 bg-[var(--urgent-soft)]/65",
    warning: "border-[var(--gold)]/25 bg-[var(--gold-soft)]/55",
    good: "border-[var(--routine)]/25 bg-[var(--routine-soft)]/55",
    neutral: "border-border bg-muted/35",
  }[item.tone];

  return (
    <div className={`rounded-xl border p-4 ${tone}`}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {item.label}
      </div>
      <div className="mt-2 text-sm font-semibold">{item.value}</div>
      <div className="mt-2 text-[11px] text-muted-foreground">{item.source}</div>
    </div>
  );
}

function StatePill({ state }: { state: ObligationState }) {
  const tone: Record<ObligationState, string> = {
    "Critical gap": "bg-[var(--urgent-soft)] text-[var(--urgent)]",
    Blocked: "bg-[var(--high-soft)] text-[var(--high)]",
    "In progress": "bg-[var(--gold-soft)] text-[var(--gold)]",
    "Ready to close": "bg-[var(--lavender-soft)] text-[var(--lavender)]",
    Closed: "bg-[var(--routine-soft)] text-[var(--routine)]",
  };
  return <span className={`chip ${tone[state]}`}>{state}</span>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="font-display text-3xl font-semibold">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
