import { useState } from "react";

interface Result {
  ok: boolean;
  message: string;
  raw: unknown;
}

export function RocketRidePanel() {
  const [pending, setPending] = useState<"config" | "workflow" | null>(null);
  const [configResult, setConfigResult] = useState<Result | null>(null);
  const [workflowResult, setWorkflowResult] = useState<Result | null>(null);

  const testConfig = async () => {
    setPending("config");
    try {
      const res = await fetch("/api/rocketride/health");
      const raw = (await res.json()) as {
        success: boolean;
        message?: string;
        status?: string;
        error?: string;
      };
      setConfigResult({
        ok: !!raw.success,
        message:
          raw.message ??
          raw.error ??
          (raw.status ? `status: ${raw.status}` : raw.success ? "OK" : "Failed"),
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

  const testWorkflow = async () => {
    setPending("workflow");
    try {
      const res = await fetch("/api/rocketride/health");
      const raw = (await res.json()) as {
        success: boolean;
        message?: string;
        error?: string;
      };
      setWorkflowResult({
        ok: !!raw.success,
        message: raw.message ?? raw.error ?? (raw.success ? "OK" : "Failed"),
        raw,
      });
    } catch (err) {
      setWorkflowResult({
        ok: false,
        message: err instanceof Error ? err.message : String(err),
        raw: null,
      });
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="card-clinical p-6">
      <div className="chip bg-[var(--gold-soft)] text-[var(--gold)]">
        Sponsor workflow (required)
      </div>
      <h2 className="mt-3 font-display text-2xl font-semibold">
        RocketRide Cloud Safety Agent
      </h2>
      <div className="mt-3 rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
        <div>
          <span className="font-semibold text-foreground">Pipeline built:</span>{" "}
          Webhook → Prompt → Nebius → Return Answers
        </div>
        <div className="mt-1">
          <span className="font-semibold text-foreground">
            Connection status:
          </span>{" "}
          Pending workflow URL/API credentials
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Once RocketRide credits/API access are available, add
        {" "}<code className="font-mono">ROCKETRIDE_WORKFLOW_URL</code> or{" "}
        <code className="font-mono">ROCKETRIDE_API_URL</code> +{" "}
        <code className="font-mono">ROCKETRIDE_API_KEY</code> +{" "}
        <code className="font-mono">ROCKETRIDE_PIPELINE_ID</code> as
        server-side secrets. The app will automatically call RocketRide after
        Butterbase and BiopsyGraph complete.
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          onClick={testConfig}
          disabled={pending !== null}
          className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
        >
          {pending === "config" ? "Testing…" : "Test RocketRide Configuration"}
        </button>
        <button
          onClick={testWorkflow}
          disabled={pending !== null}
          className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
        >
          {pending === "workflow" ? "Running…" : "Test RocketRide Workflow"}
        </button>
      </div>

      <div className="mt-5 grid gap-3">
        <Block title="Configuration test" result={configResult} />
        <Block title="Workflow test" result={workflowResult} />
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
  const border = result.ok
    ? "border-[var(--routine)]/40"
    : "border-[var(--gold)]/40";
  const bg = result.ok
    ? "bg-[var(--routine-soft)]/40"
    : "bg-[var(--gold-soft)]/40";
  const text = result.ok ? "text-[var(--routine)]" : "text-[var(--gold)]";
  return (
    <div className={`rounded-md border ${border} ${bg} p-3 text-xs`}>
      <div className="flex items-center justify-between">
        <div className="font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </div>
        <span className={`font-semibold ${text}`}>
          {result.ok ? "reachable" : "pending / failed"}
        </span>
      </div>
      <div className={`mt-1 ${text}`}>{result.message}</div>
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
