import { createFileRoute } from "@tanstack/react-router";
import { ButterbaseSetupPanel } from "@/components/ButterbaseSetupPanel";
import { BiopsyGraphPanel } from "@/components/BiopsyGraphPanel";
import { RocketRidePanel } from "@/components/RocketRidePanel";
import { DaytonaPanel } from "@/components/DaytonaPanel";
import { CogneeMemoryExportPanel } from "@/components/CogneeMemoryExportPanel";

export const Route = createFileRoute("/architecture")({
  head: () => ({
    meta: [
      { title: "Architecture · Closed Care Loop" },
      {
        name: "description",
        content:
          "How Closed Care Loop separates clinical-record interpretation, deterministic policy, bounded action, and verified closure.",
      },
    ],
  }),
  component: ArchitecturePage,
});

const layers = [
  {
    number: "01",
    tag: "Interpret",
    title: "Claude model boundary",
    items: [
      "Reads messy pathology and workflow context",
      "Returns schema-validated operational risks",
      "Quotes evidence from the supplied record",
      "Surfaces ambiguity rather than resolving it silently",
    ],
    contract: "POST /api/agent/analyze → validated structured interpretation",
    tone: "lavender",
  },
  {
    number: "02",
    tag: "Govern",
    title: "Deterministic policy engine",
    items: [
      "Controls urgency, deadlines, and permitted actions",
      "Blocks laterality and body-site conflicts",
      "Defines required evidence for each workflow state",
      "Prevents reviewed or scheduled from being mislabeled closed",
    ],
    contract: "assessCase() → state, blockers, actions, closure eligibility",
    tone: "gold",
  },
  {
    number: "03",
    tag: "Act",
    title: "Bounded workflow adapters",
    items: [
      "Drafts patient outreach for human approval",
      "Creates internal follow-up and scheduling work",
      "Reopens canceled or incomplete care",
      "Routes conflicting evidence to a clinician",
    ],
    contract: "applyAgentAction() → audited state transition",
    tone: "moderate",
  },
  {
    number: "04",
    tag: "Verify",
    title: "Clinical obligation graph",
    items: [
      "Links patient, biopsy, diagnosis, communication, scheduling, and treatment",
      "Reconciles new evidence against the open obligation",
      "Keeps the case open while required proof is missing",
      "Creates an auditable verified-closure event",
    ],
    contract: "evidence graph → open obligation or verified closure",
    tone: "routine",
  },
] as const;

const toneMap = {
  lavender: "text-[var(--lavender)] bg-[var(--lavender-soft)]",
  gold: "text-[var(--gold)] bg-[var(--gold-soft)]",
  moderate: "text-[var(--moderate)] bg-[var(--moderate-soft)]",
  routine: "text-[var(--routine)] bg-[var(--routine-soft)]",
} as const;

function ArchitecturePage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="mb-10">
        <div className="chip bg-[var(--gold-soft)] text-[var(--gold)]">
          Safety-first agent architecture
        </div>
        <h1 className="mt-4 max-w-4xl font-display text-3xl font-semibold md:text-4xl">
          Claude interprets the record. Policy governs the workflow. Evidence closes
          the loop.
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          Closed Care Loop does not hand clinical workflow control to a language
          model. The model converts fragmented text into a reviewable structure;
          typed rules determine what the system may do and what evidence is required
          before care can be considered complete.
        </p>
      </div>

      <div className="mb-8 rounded-xl border border-[var(--lavender)]/20 bg-[var(--lavender-soft)]/35 p-5">
        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--lavender)]">
          Fail-safe behavior
        </div>
        <div className="mt-2 text-lg font-semibold">
          Model failure never becomes silent workflow success.
        </div>
        <p className="mt-1 max-w-4xl text-sm leading-relaxed text-foreground/70">
          Missing credentials, API failure, invalid JSON, or schema rejection routes
          to a visibly labeled deterministic fallback. Conflicting evidence blocks
          automation and requires human resolution.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {layers.map((layer) => (
          <div key={layer.number} className="card-clinical p-6">
            <div className="flex items-center justify-between gap-3">
              <div className={`chip ${toneMap[layer.tone]}`}>{layer.tag}</div>
              <div className="font-mono text-xs text-muted-foreground">
                {layer.number}
              </div>
            </div>
            <h2 className="mt-4 font-display text-2xl font-semibold">
              {layer.title}
            </h2>
            <ul className="mt-4 space-y-2 text-sm text-foreground/80">
              {layer.items.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--lavender)]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <div className="mt-5 rounded-md bg-muted/60 px-3 py-2 font-mono text-xs text-muted-foreground">
              {layer.contract}
            </div>
          </div>
        ))}
      </div>

      <div className="card-clinical mt-8 p-6">
        <h3 className="font-display text-lg font-semibold">Runtime data flow</h3>
        <div className="mt-4 flex flex-wrap items-center gap-x-1 gap-y-3 text-xs font-semibold">
          {[
            "Clinical source records",
            "Claude interpretation",
            "Zod validation",
            "Deterministic policy",
            "Human approval or safety block",
            "Bounded action",
            "Evidence reconciliation",
            "Verified closure",
          ].map((node, index, array) => (
            <div key={node} className="flex items-center gap-1">
              <span className="rounded-lg border border-border bg-card px-3 py-2 font-mono">
                {node}
              </span>
              {index < array.length - 1 && (
                <span className="text-muted-foreground">→</span>
              )}
            </div>
          ))}
        </div>
      </div>

      <details className="card-clinical mt-8 p-6">
        <summary className="cursor-pointer text-sm font-semibold">
          Optional integration diagnostics
        </summary>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          These adapters are inherited from the original BiopsyGraph prototype.
          Their panels report actual runtime configuration and should only be
          described as live when the corresponding end-to-end check succeeds.
        </p>
        <div className="mt-6 space-y-6">
          <ButterbaseSetupPanel />
          <BiopsyGraphPanel />
          <RocketRidePanel />
          <DaytonaPanel />
          <CogneeMemoryExportPanel />
        </div>
      </details>
    </div>
  );
}
