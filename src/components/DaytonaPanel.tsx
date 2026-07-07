import { useState } from "react";
import { useDermStore } from "@/lib/derm/store";
import { assessCase } from "@/lib/derm/logic";

interface Result {
  ok: boolean;
  message: string;
  raw: unknown;
}

const SARAH_PAYLOAD = {
  caseKey: "demo_sarah_miller_001",
  patient_name: "Sarah Miller",
  diagnosis: "Melanoma in situ",
  margins: "Involved",
  priority: "Urgent",
  required_action:
    "Excision scheduling and documented patient notification",
  responsible_physician: "Dr. Tran",
  butterbase: { biopsy_case_saved: true, follow_up_task_saved: true },
  biopsygraph: { graph_synced: true, verified: true },
  rocketride: { agent_completed: false, status: "pending_configuration" },
};

export function DaytonaPanel() {
  const { cases, getSyncStatus } = useDermStore();
  const [pending, setPending] = useState<
    "config" | "sarah" | "latest" | null
  >(null);
  const [configResult, setConfigResult] = useState<Result | null>(null);
  const [sarahResult, setSarahResult] = useState<Result | null>(null);
  const [latestResult, setLatestResult] = useState<Result | null>(null);
  const [noLatestMsg, setNoLatestMsg] = useState<string | null>(null);

  const call = async (
    body: unknown,
    setter: (r: Result) => void,
    key: "sarah" | "latest",
  ) => {
    setPending(key);
    try {
      const res = await fetch("/api/daytona/validate-case", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const raw = (await res.json()) as {
        success: boolean;
        message?: string;
        validation_summary?: string;
      };
      setter({
        ok: !!raw.success,
        message:
          raw.validation_summary ??
          raw.message ??
          (raw.success ? "OK" : "Failed"),
        raw,
      });
    } catch (err) {
      setter({
        ok: false,
        message: err instanceof Error ? err.message : String(err),
        raw: null,
      });
    } finally {
      setPending(null);
    }
  };

  const testConfig = async () => {
    setPending("config");
    try {
      const res = await fetch("/api/daytona/health");
      const raw = (await res.json()) as {
        success: boolean;
        message?: string;
      };
      setConfigResult({
        ok: !!raw.success,
        message: raw.message ?? (raw.success ? "OK" : "Failed"),
        raw,
      });
    } catch (err) {
      setConfigResult({
        ok: false,
        message: err instanceof Error ? err.message : String(err),
        raw: null,
      });
    } finally {
      setPending(null);
    }
  };

  const runSarah = () => call(SARAH_PAYLOAD, setSarahResult, "sarah");

  const runLatest = () => {
    setNoLatestMsg(null);
    const latest = cases[0];
    if (!latest) {
      setNoLatestMsg("No latest case available. Submit a case first.");
      return;
    }
    const a = assessCase(latest);
    const s = getSyncStatus(latest.id);
    const payload = {
      caseKey: latest.id,
      patient_name: latest.patientName,
      diagnosis: latest.diagnosis,
      margins: latest.margins,
      priority: a.priority,
      required_action: a.requiredAction,
      responsible_physician: latest.physician,
      butterbase: {
        biopsy_case_saved: s?.butterbaseCaseSaved === true,
        follow_up_task_saved: s?.butterbaseTaskSaved === true,
      },
      biopsygraph: {
        graph_synced: s?.graphSynced === true,
        verified: s?.graphVerified === true,
      },
      rocketride: {
        agent_completed: s?.rocketrideStatus === "complete",
        status: s?.rocketrideStatus ?? "pending_configuration",
      },
    };
    return call(payload, setLatestResult, "latest");
  };

  return (
    <div className="card-clinical p-6">
      <div className="chip bg-[var(--routine-soft)] text-[var(--routine)]">
        Optional sandbox
      </div>
      <h2 className="mt-3 font-display text-2xl font-semibold">
        Daytona Sandbox Safety Check
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Runs a sandboxed validation script against a pathology case to confirm
        required follow-up safety fields are present. Dev-only bonus
        integration — not required for normal case submission.
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          onClick={testConfig}
          disabled={pending !== null}
          className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
        >
          {pending === "config" ? "Testing…" : "Test Daytona Configuration"}
        </button>
        <button
          onClick={runSarah}
          disabled={pending !== null}
          className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
        >
          {pending === "sarah"
            ? "Running…"
            : "Run Daytona Safety Check on Sarah Miller"}
        </button>
        <button
          onClick={runLatest}
          disabled={pending !== null}
          className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
        >
          {pending === "latest"
            ? "Running…"
            : "Run Daytona Safety Check on Latest Case"}
        </button>
      </div>

      {noLatestMsg && (
        <div className="mt-3 rounded-md border border-[var(--gold)]/40 bg-[var(--gold-soft)]/40 p-3 text-xs text-[var(--gold)]">
          {noLatestMsg}
        </div>
      )}

      <div className="mt-5 grid gap-3">
        <Block title="Configuration test" result={configResult} />
        <Block title="Sarah Miller safety check" result={sarahResult} />
        <Block title="Latest case safety check" result={latestResult} />
      </div>
    </div>
  );
}

function Block({ title, result }: { title: string; result: Result | null }) {
  if (!result) {
    return (
      <div className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
        <div className="font-semibold uppercase tracking-wide">{title}</div>
        <div className="mt-1">Not run yet.</div>
      </div>
    );
  }
  const raw = (result.raw ?? {}) as {
    sandbox_completed?: boolean;
    checks_passed?: boolean;
    risk_flags?: string[];
    validation_summary?: string;
    status?: string;
    local_preview?: {
      checks_passed?: boolean;
      risk_flags?: string[];
      validation_summary?: string;
    };
  };
  const border = result.ok
    ? "border-[var(--routine)]/40"
    : "border-[var(--gold)]/40";
  const bg = result.ok
    ? "bg-[var(--routine-soft)]/40"
    : "bg-[var(--gold-soft)]/40";
  const text = result.ok ? "text-[var(--routine)]" : "text-[var(--gold)]";
  const flags = raw.risk_flags ?? raw.local_preview?.risk_flags ?? [];
  return (
    <div className={`rounded-md border ${border} ${bg} p-3 text-xs`}>
      <div className="flex items-center justify-between">
        <div className="font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </div>
        <span className={`font-semibold ${text}`}>
          {result.ok ? "passed" : raw.status ?? "pending / failed"}
        </span>
      </div>
      <div className={`mt-1 ${text}`}>{result.message}</div>
      <div className="mt-2 grid gap-1 text-[11px] text-foreground/80">
        <div>
          <span className="text-muted-foreground">Sandbox completed:</span>{" "}
          {String(raw.sandbox_completed === true)}
        </div>
        <div>
          <span className="text-muted-foreground">Checks passed:</span>{" "}
          {String(
            raw.checks_passed === true ||
              raw.local_preview?.checks_passed === true,
          )}
        </div>
        {flags.length > 0 && (
          <div>
            <span className="text-muted-foreground">Risk flags:</span>{" "}
            {flags.join(", ")}
          </div>
        )}
      </div>
      <details className="mt-2">
        <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Raw Daytona response
        </summary>
        <pre className="mt-1 max-h-64 overflow-auto rounded bg-background/70 p-2 font-mono text-[11px] text-foreground/80">
          {safeStringify(result.raw)}
        </pre>
      </details>
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
