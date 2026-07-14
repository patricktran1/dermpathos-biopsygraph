import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { useDermStore } from "@/lib/derm/store";
import { assessCase, priorityRank } from "@/lib/derm/logic";
import { PriorityBadge } from "@/components/PriorityBadge";
import type { ObligationState } from "@/lib/derm/types";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Clinical Obligations · Closed Care Loop" },
      {
        name: "description",
        content:
          "Detect, act on, and verify clinical obligations created by pathology results.",
      },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { cases, loadDemoCases, resetDemo } = useDermStore();
  const navigate = useNavigate();

  const rows = useMemo(
    () =>
      cases
        .map((c) => ({ c, a: assessCase(c) }))
        .sort((x, y) => {
          const stateRank: Record<ObligationState, number> = {
            "Critical gap": 0,
            Blocked: 1,
            "In progress": 2,
            "Ready to close": 3,
            Closed: 4,
          };
          return (
            stateRank[x.a.obligationState] - stateRank[y.a.obligationState] ||
            priorityRank[x.a.priority] - priorityRank[y.a.priority]
          );
        }),
    [cases],
  );

  const stats = useMemo(() => {
    const count = (state: ObligationState) =>
      rows.filter(({ a }) => a.obligationState === state).length;
    return {
      open: rows.filter(({ a }) => a.obligationState !== "Closed").length,
      critical: count("Critical gap"),
      blocked: count("Blocked"),
      active: count("In progress"),
      ready: count("Ready to close"),
      closed: count("Closed"),
    };
  }, [rows]);

  if (rows.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-20 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--lavender-soft)] text-2xl">
          ⟳
        </div>
        <h1 className="mt-5 font-display text-3xl font-semibold">
          Clinical obligation command center
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          Load the synthetic clinic to see the agent detect a lost melanoma,
          stop a wrong-site workflow, and reopen a canceled treatment case.
        </p>
        <button
          onClick={loadDemoCases}
          className="mt-8 rounded-lg bg-[var(--lavender)] px-5 py-3 text-sm font-semibold text-primary-foreground hover:opacity-95"
        >
          Load Monday-morning clinic
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--lavender)]">
            Closed Care Loop
            <span className="rounded-full bg-[var(--routine-soft)] px-2 py-0.5 text-[10px] tracking-normal text-[var(--routine)]">
              Synthetic demo
            </span>
          </div>
          <h1 className="font-display text-3xl font-semibold">
            Clinical obligations
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ranked by patient-safety risk, not inbox order.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={resetDemo}
            className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold hover:bg-accent"
          >
            Reset demo
          </button>
          <Link
            to="/intake"
            className="rounded-lg bg-[var(--lavender)] px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-95"
          >
            + Add result
          </Link>
        </div>
      </div>

      <div className="mb-7 rounded-xl border border-[var(--urgent)]/20 bg-[var(--urgent-soft)]/45 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--urgent)]">
              Agent surveillance complete
            </div>
            <div className="mt-1 text-lg font-semibold">
              {stats.open} open obligations found. {stats.critical} may represent an
              immediate patient-safety risk.
            </div>
            <p className="mt-1 max-w-3xl text-sm text-foreground/70">
              The agent reconciled pathology, communications, scheduling, and
              procedure evidence. It proposed bounded actions and blocked unsafe
              automation where the record conflicted.
            </p>
          </div>
          <div className="rounded-lg border border-[var(--urgent)]/20 bg-card/80 px-4 py-3 text-right">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Highest-risk case
            </div>
            <div className="mt-1 text-sm font-semibold">Melanoma · no contact</div>
          </div>
        </div>
      </div>

      <div className="mb-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Open obligations" value={stats.open} tone="lavender" />
        <Stat label="Critical gaps" value={stats.critical} tone="urgent" />
        <Stat label="Automation blocked" value={stats.blocked} tone="high" />
        <Stat label="Ready to verify" value={stats.ready} tone="gold" />
        <Stat label="Verified closed" value={stats.closed} tone="routine" />
      </div>

      <div className="card-clinical overflow-hidden">
        <div className="border-b border-border px-5 py-4">
          <div className="text-sm font-semibold">Agent priority queue</div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            Open any case to inspect source evidence, proposed actions, safety
            blockers, and the closure timeline.
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Th>Patient</Th>
                <Th>Clinical obligation</Th>
                <Th>Evidence gap</Th>
                <Th>Risk</Th>
                <Th>State</Th>
                <Th>Next bounded action</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ c, a }) => (
                <tr
                  key={c.id}
                  onClick={() =>
                    navigate({ to: "/cases/$caseId", params: { caseId: c.id } })
                  }
                  className="cursor-pointer border-b border-border/60 transition hover:bg-[var(--lavender-soft)]/35"
                >
                  <Td>
                    <div className="font-semibold text-foreground">{c.patientName}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {c.bodySite} · report {c.reportDate ?? "received"}
                    </div>
                  </Td>
                  <Td className="min-w-[280px]">
                    <div className="font-medium">{a.headline}</div>
                    <div className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                      {a.summary}
                    </div>
                  </Td>
                  <Td className="min-w-[210px]">
                    <div className="flex flex-wrap gap-1.5">
                      {a.flags.slice(0, 2).map((flag) => (
                        <span
                          key={flag}
                          className="rounded-md bg-muted px-2 py-1 text-[11px] text-foreground/75"
                        >
                          {flag}
                        </span>
                      ))}
                      {a.flags.length === 0 && (
                        <span className="text-xs text-[var(--routine)]">
                          Required evidence present
                        </span>
                      )}
                    </div>
                  </Td>
                  <Td>
                    <PriorityBadge priority={a.priority} />
                  </Td>
                  <Td>
                    <StateBadge state={a.obligationState} />
                  </Td>
                  <Td className="min-w-[220px]">
                    <div className="text-xs font-medium">
                      {a.actions[0]?.label ?? "No action pending"}
                    </div>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      {a.requiresHumanReview ? "Human approval required" : "Agent-verifiable"}
                    </div>
                  </Td>
                </tr>
              ))}
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
  return <td className={`px-4 py-4 align-top ${className}`}>{children}</td>;
}

const toneMap = {
  lavender: "text-[var(--lavender)] bg-[var(--lavender-soft)]",
  urgent: "text-[var(--urgent)] bg-[var(--urgent-soft)]",
  high: "text-[var(--high)] bg-[var(--high-soft)]",
  gold: "text-[var(--gold)] bg-[var(--gold-soft)]",
  routine: "text-[var(--routine)] bg-[var(--routine-soft)]",
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
      <div
        className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${toneMap[tone]}`}
      >
        {label}
      </div>
      <div className="mt-3 font-display text-3xl font-semibold text-foreground">
        {value}
      </div>
    </div>
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
  return <span className={`chip whitespace-nowrap ${cls[state]}`}>{state}</span>;
}
