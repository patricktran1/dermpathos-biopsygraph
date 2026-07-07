import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useDermStore } from "@/lib/derm/store";
import { assessCase } from "@/lib/derm/logic";
import { PriorityBadge } from "@/components/PriorityBadge";
import { CaseBiopsyGraphPanel } from "@/components/CaseBiopsyGraphPanel";
import {
  CaseBackendStatusPanel,
  CaseSyncBadge,
} from "@/components/CaseBackendStatusPanel";

export const Route = createFileRoute("/cases/$caseId")({
  component: CaseDetailPage,
  notFoundComponent: () => (
    <div className="mx-auto max-w-xl px-6 py-20 text-center">
      <h1 className="font-display text-2xl font-semibold">Case not found</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        This case may have been cleared. Load the demo dataset again.
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
  const router = useRouter();
  const { getCase, tasks, completeTask } = useDermStore();
  const c = getCase(caseId);

  if (!c) {
    return (
      <div className="mx-auto max-w-xl px-6 py-20 text-center">
        <h1 className="font-display text-2xl font-semibold">Case not found</h1>
        <div className="mt-6 flex justify-center gap-3">
          <Link
            to="/dashboard"
            className="rounded-lg bg-[var(--lavender)] px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  const a = assessCase(c);
  const task = tasks[c.id];

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <Link
          to="/dashboard"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Dashboard
        </Link>
        <PriorityBadge priority={a.priority} />
      </div>

      <header className="mb-8">
        <h1 className="font-display text-3xl font-semibold">{c.patientName}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Age {c.age} · {c.bodySite} · Biopsy {c.biopsyDate} ({c.biopsyType})
        </p>
        <div className="mt-3">
          <CaseSyncBadge caseId={c.id} />
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card-clinical p-6 lg:col-span-2">
          <SectionTitle>Pathology summary</SectionTitle>
          <p className="mt-3 rounded-lg bg-muted/60 p-4 font-mono text-sm leading-relaxed">
            {c.pathologyResult}
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <KV k="Diagnosis" v={c.diagnosis} />
            <KV k="Margin status" v={c.margins} />
            <KV k="Notification status" v={c.patientNotified} />
            <KV k="Treatment scheduling" v={c.treatmentScheduled} />
            <KV k="Responsible physician" v={c.physician} />
            <KV k="Priority level" v={a.priority} />
          </div>

          <div className="mt-6 rounded-lg border border-[var(--lavender-soft)] bg-[var(--lavender-soft)]/40 p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-[var(--lavender)]">
              Recommended operational action
            </div>
            <div className="mt-1 text-sm font-medium">{a.requiredAction}</div>
          </div>

          {a.flags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {a.flags.map((f) => (
                <span
                  key={f}
                  className="chip bg-[var(--urgent-soft)] text-[var(--urgent)]"
                >
                  ⚠ {f}
                </span>
              ))}
            </div>
          )}

          {(c.clinicalDescription || c.clinicalConcern || c.clinicNoteExcerpt) && (
            <div className="mt-6 rounded-lg border border-border bg-muted/30 p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Clinical context
              </div>
              <div className="mt-3 space-y-3 text-sm">
                {c.clinicalDescription && (
                  <div>
                    <div className="text-xs text-muted-foreground">Clinical description</div>
                    <div className="mt-1">{c.clinicalDescription}</div>
                  </div>
                )}
                {c.clinicalConcern && (
                  <div>
                    <div className="text-xs text-muted-foreground">Clinical concern / rule-out</div>
                    <div className="mt-1">{c.clinicalConcern}</div>
                  </div>
                )}
                {c.clinicNoteExcerpt && (
                  <div>
                    <div className="text-xs text-muted-foreground">Clinic note excerpt</div>
                    <div className="mt-1 whitespace-pre-wrap">{c.clinicNoteExcerpt}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {(c.clinicalPhotoDataUrl || c.pathologyImageDataUrl) && (
            <div className="mt-6 rounded-lg border border-border bg-muted/30 p-4">
              <div className="flex items-baseline justify-between gap-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Visual evidence
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Reference images only. No AI interpretation.
                </div>
              </div>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                {c.clinicalPhotoDataUrl && (
                  <figure>
                    <img
                      src={c.clinicalPhotoDataUrl}
                      alt={c.clinicalPhotoLabel || "Pre-biopsy clinical photo"}
                      className="w-full rounded-md border border-border object-cover"
                    />
                    <figcaption className="mt-1 text-xs text-muted-foreground">
                      Pre-biopsy clinical photo
                      {c.clinicalPhotoLabel ? ` — ${c.clinicalPhotoLabel}` : ""}
                    </figcaption>
                  </figure>
                )}
                {c.pathologyImageDataUrl && (
                  <figure>
                    <img
                      src={c.pathologyImageDataUrl}
                      alt={c.pathologyImageLabel || "Pathology image"}
                      className="w-full rounded-md border border-border object-cover"
                    />
                    <figcaption className="mt-1 text-xs text-muted-foreground">
                      Pathology image
                      {c.pathologyImageLabel ? ` — ${c.pathologyImageLabel}` : ""}
                    </figcaption>
                  </figure>
                )}
              </div>
            </div>
          )}
        </section>

        <aside className="card-clinical p-6">
          <SectionTitle>Follow-up task</SectionTitle>
          {task ? (
            <div className="mt-3 space-y-3">
              <div className="text-base font-semibold">{task.title}</div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="text-muted-foreground">Priority</div>
                  <div className="mt-1"><PriorityBadge priority={task.priority} /></div>
                </div>
                <div>
                  <div className="text-muted-foreground">Assigned</div>
                  <div className="mt-1 font-medium">{task.physician}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Due</div>
                  <div className="mt-1 font-medium">{task.dueTiming}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Status</div>
                  <div className="mt-1">
                    <span
                      className={`chip ${
                        task.status === "Complete"
                          ? "bg-[var(--routine-soft)] text-[var(--routine)]"
                          : "bg-[var(--gold-soft)] text-[var(--gold)]"
                      }`}
                    >
                      {task.status}
                    </span>
                  </div>
                </div>
              </div>
              <div className="rounded-md bg-muted/60 p-3 text-xs leading-relaxed text-muted-foreground">
                <span className="font-semibold text-foreground">Reason: </span>
                {task.reason}
              </div>
              <div className="flex flex-col gap-2 pt-2">
                <button
                  onClick={() => completeTask(c.id)}
                  disabled={task.status === "Complete"}
                  className="rounded-lg bg-[var(--lavender)] px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                >
                  {task.status === "Complete" ? "Completed" : "Mark Complete"}
                </button>
                <a
                  href="#graph"
                  className="rounded-lg border border-border px-3 py-2 text-center text-sm font-semibold hover:bg-accent"
                >
                  View Graph Reasoning
                </a>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">No task yet.</p>
          )}
        </aside>
      </div>

      <section id="graph" className="card-clinical mt-8 p-6">
        <div className="flex items-baseline justify-between">
          <SectionTitle>BiopsyGraph reasoning path</SectionTitle>
          <span className="text-xs text-muted-foreground">
            Neo4j traversal · mock
          </span>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          The path BiopsyGraph traversed to identify this case's required
          follow-up.
        </p>
        <GraphPath nodes={a.graphPath} />
      </section>

      <CaseBackendStatusPanel caseId={c.id} />

      <CaseBiopsyGraphPanel caseId={c.id} patientName={c.patientName} />
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

function KV({ k, v }: { k: string; v: string | number }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">
        {k}
      </div>
      <div className="mt-1 text-sm font-medium">{v}</div>
    </div>
  );
}

function GraphPath({ nodes }: { nodes: string[] }) {
  const nodeTone = (label: string) => {
    const l = label.toLowerCase();
    if (l.includes("task")) return "bg-[var(--gold-soft)] text-[var(--gold)] border-[var(--gold)]/30";
    if (l.includes("melanoma") || l.includes("squamous") || l.includes("basal"))
      return "bg-[var(--urgent-soft)] text-[var(--urgent)] border-[var(--urgent)]/30";
    if (l.includes("not notified") || l.includes("no treatment") || l.includes("required"))
      return "bg-[var(--high-soft)] text-[var(--high)] border-[var(--high)]/30";
    if (l.includes("benign") || l.includes("no treatment required"))
      return "bg-[var(--routine-soft)] text-[var(--routine)] border-[var(--routine)]/30";
    return "bg-[var(--lavender-soft)] text-[var(--lavender)] border-[var(--lavender)]/30";
  };
  return (
    <div className="mt-6 flex flex-wrap items-center gap-x-1 gap-y-3">
      {nodes.map((n, i) => (
        <div key={`${n}-${i}`} className="flex items-center gap-1">
          <div
            className={`rounded-lg border px-3 py-2 text-xs font-semibold ${nodeTone(n)}`}
          >
            {n}
          </div>
          {i < nodes.length - 1 && (
            <span className="text-muted-foreground">→</span>
          )}
        </div>
      ))}
    </div>
  );
}
