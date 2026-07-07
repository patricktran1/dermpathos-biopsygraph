import { createFileRoute } from "@tanstack/react-router";
import { ButterbaseSetupPanel } from "@/components/ButterbaseSetupPanel";
import { BiopsyGraphPanel } from "@/components/BiopsyGraphPanel";
import { RocketRidePanel } from "@/components/RocketRidePanel";
import { DaytonaPanel } from "@/components/DaytonaPanel";
import { CogneeMemoryExportPanel } from "@/components/CogneeMemoryExportPanel";

export const Route = createFileRoute("/architecture")({
  head: () => ({
    meta: [
      { title: "Integration Architecture · DermPathOS" },
      {
        name: "description",
        content:
          "How DermPathOS BiopsyGraph connects to Butterbase, Neo4j, and RocketRide Cloud.",
      },
    ],
  }),
  component: ArchitecturePage,
});

const cards = [
  {
    tag: "Backend + AI gateway",
    title: "Butterbase",
    items: [
      "App backend",
      "User and clinic records",
      "Pathology case storage",
      "Task records",
      "Notification status",
      "AI model gateway for case summaries",
    ],
    fn: "submitToButterbase() · generateSummaryViaButterbaseGateway()",
    tone: "lavender",
  },
  {
    tag: "Relationship graph",
    title: "Neo4j",
    items: [
      "BiopsyGraph relationship model",
      "Nodes: Patient, Lesion, Biopsy, PathologyResult, Diagnosis, RequiredAction, NotificationStatus, TreatmentPlan, Task, Physician",
      "Relationships: HAS_LESION, WAS_BIOPSIED, RETURNED_RESULT, INDICATES_DIAGNOSIS, REQUIRES_ACTION, HAS_NOTIFICATION_STATUS, HAS_TREATMENT_STATUS, CREATES_TASK, ASSIGNED_TO",
      "Graph traversal to identify missing follow-up steps",
    ],
    fn: "queryBiopsyGraphNeo4j()",
    tone: "gold",
  },
  {
    tag: "Deployed pipeline",
    title: "RocketRide Cloud",
    items: [
      "Deployed pathology follow-up workflow",
      "Extract pathology fields",
      "Classify diagnosis / action required",
      "Query Neo4j BiopsyGraph",
      "Generate explanation",
      "Create operational task",
    ],
    fn: "callRocketRidePipeline() · createFollowUpTask()",
    tone: "moderate",
  },
  {
    tag: "Optional sandbox",
    title: "Daytona",
    items: [
      "Sandbox for testing follow-up rules",
      "Example test: melanoma in situ with no scheduled excision must create urgent physician review task",
    ],
    fn: "—",
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
    <div className="mx-auto max-w-5xl px-6 py-12">
      <div className="mb-10">
        <div className="chip bg-[var(--gold-soft)] text-[var(--gold)]">
          Developer view
        </div>
        <h1 className="mt-4 font-display text-3xl font-semibold">
          Hackathon Integration Architecture
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          The MVP uses live server-side integrations for Butterbase and Neo4j.
          RocketRide and Daytona remain server-side sponsor integrations that
          can be configured without exposing secrets in the browser.
        </p>
      </div>

      <div className="mb-8">
        <div className="mb-3 rounded-md border border-[var(--gold)]/30 bg-[var(--gold-soft)]/40 px-3 py-2 text-xs text-[var(--gold)]">
          Dev-only integration tests. Normal case submissions now auto-save to
          Butterbase and auto-sync to BiopsyGraph — no manual click needed.
        </div>
        <ButterbaseSetupPanel />
        <div className="h-6" />
        <BiopsyGraphPanel />
        <div className="h-6" />
        <RocketRidePanel />
        <div className="h-6" />
        <DaytonaPanel />
        <div className="h-6" />
        <CogneeMemoryExportPanel />
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {cards.map((card) => (
          <div key={card.title} className="card-clinical p-6">
            <div
              className={`chip ${toneMap[card.tone]}`}
            >
              {card.tag}
            </div>
            <h2 className="mt-3 font-display text-2xl font-semibold">
              {card.title}
            </h2>
            <ul className="mt-4 space-y-2 text-sm text-foreground/80">
              {card.items.map((i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--lavender)]" />
                  <span>{i}</span>
                </li>
              ))}
            </ul>
            <div className="mt-5 rounded-md bg-muted/60 px-3 py-2 font-mono text-xs text-muted-foreground">
              {card.fn}
            </div>
          </div>
        ))}
      </div>

      <div className="card-clinical mt-8 p-6">
        <h3 className="font-display text-lg font-semibold">Data flow</h3>
        <div className="mt-4 flex flex-wrap items-center gap-x-1 gap-y-3 text-xs font-semibold">
          {[
            "Intake form",
            "/api/cases/submit",
            "Butterbase biopsy_cases",
            "Butterbase follow_up_tasks",
            "Neo4j BiopsyGraph MERGE",
            "Neo4j verification",
            "RocketRide safety-agent if configured",
            "Dashboard status",
          ].map((n, i, arr) => (
            <div key={n} className="flex items-center gap-1">
              <span className="rounded-lg border border-border bg-card px-3 py-2 font-mono">
                {n}
              </span>
              {i < arr.length - 1 && <span className="text-muted-foreground">→</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
