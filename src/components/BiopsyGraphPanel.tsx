import { useState } from "react";

interface StepResult {
  ok: boolean;
  message: string;
  raw: unknown;
}

type StepKey = "sync" | "verify";

type InspectKey = "health" | "patients";

export function BiopsyGraphPanel() {
  const [pending, setPending] = useState<StepKey | null>(null);
  const [results, setResults] = useState<Record<StepKey, StepResult | null>>({
    sync: null,
    verify: null,
  });
  const [inspectPending, setInspectPending] = useState<InspectKey | null>(null);
  const [inspectResults, setInspectResults] = useState<
    Record<InspectKey, StepResult | null>
  >({
    health: null,
    patients: null,
  });

  const run = async (step: StepKey) => {
    setPending(step);
    try {
      const url =
        step === "sync"
          ? "/api/biopsygraph/sync-sarah"
          : "/api/biopsygraph/verify-sarah";
      const init: RequestInit =
        step === "sync" ? { method: "POST" } : { method: "GET" };
      const res = await fetch(url, init);
      const raw = (await res.json()) as {
        success: boolean;
        message: string;
      };
      setResults((prev) => ({
        ...prev,
        [step]: {
          ok: !!raw.success,
          message: raw.message ?? (raw.success ? "OK" : "Failed"),
          raw,
        },
      }));
    } catch (err) {
      setResults((prev) => ({
        ...prev,
        [step]: {
          ok: false,
          message: err instanceof Error ? err.message : String(err),
          raw: null,
        },
      }));
    } finally {
      setPending(null);
    }
  };

  const inspect = async (step: InspectKey) => {
    setInspectPending(step);
    try {
      const url =
        step === "health"
          ? "/api/biopsygraph/health"
          : "/api/biopsygraph/list-patients";
      const res = await fetch(url);
      const raw = (await res.json()) as {
        success: boolean;
        message?: string;
        error?: string;
      };
      setInspectResults((prev) => ({
        ...prev,
        [step]: {
          ok: !!raw.success,
          message:
            raw.message ?? raw.error ?? (raw.success ? "OK" : "Failed"),
          raw,
        },
      }));
    } catch (err) {
      setInspectResults((prev) => ({
        ...prev,
        [step]: {
          ok: false,
          message: err instanceof Error ? err.message : String(err),
          raw: null,
        },
      }));
    } finally {
      setInspectPending(null);
    }
  };

  return (
    <div className="card-clinical p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="chip bg-[var(--gold-soft)] text-[var(--gold)]">
            Relationship graph
          </div>
          <h2 className="mt-3 font-display text-2xl font-semibold">
            BiopsyGraph / Neo4j
          </h2>
        </div>
      </div>

      <div className="mt-4 rounded-md border border-[var(--routine)]/30 bg-[var(--routine-soft)]/40 px-3 py-2 text-xs text-[var(--routine)]">
        Reads Sarah Miller from Butterbase server-side, then MERGEs the graph
        into Neo4j. Neo4j credentials stay server-side.
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          onClick={() => run("sync")}
          disabled={pending !== null}
          className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
        >
          {pending === "sync"
            ? "Syncing…"
            : "Sync Sarah Miller from Butterbase to BiopsyGraph"}
        </button>
        <button
          onClick={() => run("verify")}
          disabled={pending !== null}
          className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
        >
          {pending === "verify" ? "Verifying…" : "Verify BiopsyGraph"}
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
        <button
          onClick={() => inspect("patients")}
          disabled={inspectPending !== null}
          className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
        >
          {inspectPending === "patients"
            ? "Listing…"
            : "List BiopsyGraph Patients"}
        </button>
        <button
          onClick={() => inspect("health")}
          disabled={inspectPending !== null}
          className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
        >
          {inspectPending === "health" ? "Testing…" : "Test Neo4j Connection"}
        </button>
      </div>

      {results.verify?.ok && (
        <div className="mt-4 rounded-md border border-[var(--routine)]/40 bg-[var(--routine-soft)]/40 px-3 py-2 text-sm font-semibold text-[var(--routine)]">
          BiopsyGraph verified: Sarah Miller → biopsy → melanoma in situ →
          urgent follow-up task.
        </div>
      )}

      <div className="mt-5 grid gap-3">
        <ResultBlock title="Sync" result={results.sync} />
        <ResultBlock title="Verify" result={results.verify} />
        <ResultBlock title="Neo4j health" result={inspectResults.health} />
        <ResultBlock
          title="BiopsyGraph patients"
          result={inspectResults.patients}
        />
      </div>
    </div>
  );
}

function ResultBlock({
  title,
  result,
}: {
  title: string;
  result: StepResult | null;
}) {
  if (!result) {
    return (
      <div className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
        <div className="font-semibold uppercase tracking-wide">{title}</div>
        <div className="mt-1">Not run yet.</div>
      </div>
    );
  }
  const toneBorder = result.ok
    ? "border-[var(--routine)]/40"
    : "border-[var(--moderate)]/50";
  const toneBg = result.ok
    ? "bg-[var(--routine-soft)]/40"
    : "bg-[var(--moderate-soft)]/40";
  const toneText = result.ok
    ? "text-[var(--routine)]"
    : "text-[var(--moderate)]";
  return (
    <div className={`rounded-md border ${toneBorder} ${toneBg} p-3 text-xs`}>
      <div className="flex items-center justify-between">
        <div className="font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </div>
        <span className={`font-semibold ${toneText}`}>
          {result.ok ? "success" : "failed"}
        </span>
      </div>
      <div className={`mt-1 ${toneText}`}>{result.message}</div>
      <pre className="mt-2 max-h-64 overflow-auto rounded bg-background/70 p-2 font-mono text-[11px] text-foreground/80">
        {safeStringify(result.raw)}
      </pre>
    </div>
  );
}

function safeStringify(v: unknown): string {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}
