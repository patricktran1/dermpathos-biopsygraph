import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { useDermStore } from "@/lib/derm/store";
import { assessCase, priorityRank } from "@/lib/derm/logic";
import { PriorityBadge } from "@/components/PriorityBadge";
import { CaseSyncBadge } from "@/components/CaseBackendStatusPanel";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Action Dashboard · DermPathOS" },
      {
        name: "description",
        content:
          "Every biopsy case, its priority, and the follow-up action BiopsyGraph recommends.",
      },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { cases, tasks, loadDemoCases } = useDermStore();
  const navigate = useNavigate();

  const rows = useMemo(() => {
    return cases
      .map((c) => ({ c, a: assessCase(c) }))
      .sort((x, y) => priorityRank[x.a.priority] - priorityRank[y.a.priority]);
  }, [cases]);

  const stats = useMemo(() => {
    let urgent = 0,
      notifyPending = 0,
      treatmentGap = 0,
      benign = 0;
    for (const { c, a } of rows) {
      if (a.priority === "Urgent") urgent++;
      if (c.patientNotified === "No") notifyPending++;
      if (a.isMalignant && c.treatmentScheduled === "No") treatmentGap++;
      if (a.priority === "Routine") benign++;
    }
    return {
      total: rows.length,
      urgent,
      notifyPending,
      treatmentGap,
      benign,
      tasksCreated: Object.keys(tasks).length,
    };
  }, [rows, tasks]);

  if (rows.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-20 text-center">
        <h1 className="font-display text-3xl font-semibold">Action Dashboard</h1>
        <p className="mt-3 text-muted-foreground">
          No pathology cases yet. Load the demo dataset to see BiopsyGraph in action.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <button
            onClick={loadDemoCases}
            className="rounded-lg bg-[var(--lavender)] px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-95"
          >
            Load Demo Cases
          </button>
          <Link
            to="/intake"
            className="rounded-lg border border-border px-5 py-2.5 text-sm font-semibold hover:bg-accent"
          >
            Enter a case manually
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">Action Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cases sorted by BiopsyGraph priority. Click a row to open the case.
          </p>
        </div>
        <Link
          to="/intake"
          className="rounded-lg bg-[var(--lavender)] px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-95"
        >
          + New Case
        </Link>
      </div>

      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Stat label="Biopsy cases" value={stats.total} tone="lavender" />
        <Stat label="Urgent action" value={stats.urgent} tone="urgent" />
        <Stat label="Notify pending" value={stats.notifyPending} tone="high" />
        <Stat label="Tx not scheduled" value={stats.treatmentGap} tone="moderate" />
        <Stat label="Benign queue" value={stats.benign} tone="routine" />
        <Stat label="Tasks created" value={stats.tasksCreated} tone="gold" />
      </div>

      <div className="card-clinical overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Th>Patient</Th>
                <Th>Body site</Th>
                <Th>Diagnosis</Th>
                <Th>Notified</Th>
                <Th>Tx scheduled</Th>
                <Th>Priority</Th>
                <Th>Required action</Th>
                <Th>Task</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ c, a }) => {
                const task = tasks[c.id];
                return (
                  <tr
                    key={c.id}
                    onClick={() =>
                      navigate({ to: "/cases/$caseId", params: { caseId: c.id } })
                    }
                    className="cursor-pointer border-b border-border/60 transition hover:bg-[var(--lavender-soft)]/40"
                  >
                    <Td>
                      <div className="font-medium text-foreground">{c.patientName}</div>
                      <div className="text-xs text-muted-foreground">
                        Age {c.age} · {c.biopsyDate}
                      </div>
                      <div className="mt-1">
                        <CaseSyncBadge caseId={c.id} />
                      </div>
                    </Td>
                    <Td>{c.bodySite}</Td>
                    <Td>{c.diagnosis}</Td>
                    <Td>
                      <YesNoDot v={c.patientNotified} />
                    </Td>
                    <Td>
                      <YesNoDot v={c.treatmentScheduled} />
                    </Td>
                    <Td>
                      <PriorityBadge priority={a.priority} />
                    </Td>
                    <Td className="max-w-[240px] text-muted-foreground">
                      {a.requiredAction}
                    </Td>
                    <Td>
                      <span
                        className={`chip ${
                          task?.status === "Complete"
                            ? "bg-[var(--routine-soft)] text-[var(--routine)]"
                            : "bg-[var(--gold-soft)] text-[var(--gold)]"
                        }`}
                      >
                        {task?.status ?? "Open"}
                      </span>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3">{children}</th>;
}
function Td({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-4 py-3 align-top ${className}`}>{children}</td>;
}

const toneMap = {
  lavender: "text-[var(--lavender)] bg-[var(--lavender-soft)]",
  urgent: "text-[var(--urgent)] bg-[var(--urgent-soft)]",
  high: "text-[var(--high)] bg-[var(--high-soft)]",
  moderate: "text-[var(--moderate)] bg-[var(--moderate-soft)]",
  routine: "text-[var(--routine)] bg-[var(--routine-soft)]",
  gold: "text-[var(--gold)] bg-[var(--gold-soft)]",
} as const;

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: keyof typeof toneMap;
}) {
  return (
    <div className="card-clinical p-4">
      <div className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${toneMap[tone]}`}>
        {label}
      </div>
      <div className="mt-3 font-display text-3xl font-semibold text-foreground">
        {value}
      </div>
    </div>
  );
}

function YesNoDot({ v }: { v: string }) {
  const cls =
    v === "Yes"
      ? "bg-[var(--routine-soft)] text-[var(--routine)]"
      : v === "No"
        ? "bg-[var(--urgent-soft)] text-[var(--urgent)]"
        : "bg-muted text-muted-foreground";
  return <span className={`chip ${cls}`}>{v}</span>;
}
