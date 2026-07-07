import { useDermStore } from "@/lib/derm/store";

export function CaseSyncBadge({ caseId }: { caseId: string }) {
  const { getSyncStatus } = useDermStore();
  const s = getSyncStatus(caseId);
  if (!s) return null;
  if (s.mode === "local_demo") {
    return (
      <span className="chip bg-muted text-muted-foreground">
        Local demo only
      </span>
    );
  }
  const bothSaved = s.butterbaseCaseSaved && s.butterbaseTaskSaved;
  const graphOk = s.graphSynced && s.graphVerified;
  const rr = s.rocketrideStatus;
  const chips: React.ReactNode[] = [];
  if (bothSaved) {
    chips.push(
      <span key="bb" className="chip bg-[var(--routine-soft)] text-[var(--routine)]">Butterbase saved</span>,
    );
  } else {
    chips.push(
      <span key="bb" className="chip bg-[var(--urgent-soft)] text-[var(--urgent)]">Butterbase failed</span>,
    );
  }
  if (bothSaved) {
    if (graphOk) {
      chips.push(
        <span key="g" className="chip bg-[var(--routine-soft)] text-[var(--routine)]">BiopsyGraph synced</span>,
      );
    } else {
      chips.push(
        <span key="g" className="chip bg-[var(--moderate-soft)] text-[var(--moderate)]" title={s.graphError ?? undefined}>BiopsyGraph failed</span>,
      );
    }
  }
  if (bothSaved && graphOk) {
    if (rr === "complete" || rr === "completed") {
      chips.push(
        <span key="rr" className="chip bg-[var(--routine-soft)] text-[var(--routine)]">RocketRide agent completed</span>,
      );
    } else if (rr === "triggered") {
      chips.push(
        <span key="rr" className="chip bg-[var(--routine-soft)] text-[var(--routine)]" title={s.rocketrideMessage}>RocketRide webhook triggered</span>,
      );
    } else if (rr === "failed") {
      chips.push(
        <span key="rr" className="chip bg-[var(--moderate-soft)] text-[var(--moderate)]" title={s.rocketrideMessage}>RocketRide failed</span>,
      );
    } else {
      chips.push(
        <span key="rr" className="chip bg-[var(--gold-soft)] text-[var(--gold)]" title={s.rocketrideMessage}>RocketRide pending</span>,
      );
    }
  }

  return <span className="inline-flex flex-wrap gap-1">{chips}</span>;
}

export function CaseBackendStatusPanel({ caseId }: { caseId: string }) {
  const { getSyncStatus } = useDermStore();
  const s = getSyncStatus(caseId);
  if (!s) return null;
  return (
    <section className="card-clinical mt-8 p-6">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Backend status
        </h2>
        <CaseSyncBadge caseId={caseId} />
      </div>
      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <Row k="caseKey" v={<code className="font-mono text-xs">{s.caseKey}</code>} />
        <Row k="taskKey" v={<code className="font-mono text-xs">{s.taskKey ?? "—"}</code>} />
        <Row k="Butterbase biopsy_cases" v={s.butterbaseCaseSaved ? "Saved" : "Not saved"} />
        <Row k="Butterbase follow_up_tasks" v={s.butterbaseTaskSaved ? "Saved" : "Not saved"} />
        <Row k="Neo4j graph synced" v={s.graphSynced ? "true" : "false"} />
        <Row k="Neo4j verified" v={s.graphVerified ? "true" : "false"} />
        <Row
          k="BiopsyGraph (Neo4j)"
          v={
            s.mode === "local_demo"
              ? "Local demo only"
              : s.graphSynced && s.graphVerified
                ? "Synced and verified"
                : `Not verified${s.graphError ? ` — ${s.graphError}` : ""}`
          }
        />
        <Row
          k="RocketRide safety agent"
          v={
            s.rocketrideStatus === "complete" || s.rocketrideStatus === "completed"
              ? "Agent completed"
              : s.rocketrideStatus === "triggered"
                ? `Webhook triggered${s.rocketrideMessage ? ` — ${s.rocketrideMessage}` : ""}`
                : s.rocketrideStatus === "failed"
                  ? `Failed${s.rocketrideMessage ? ` — ${s.rocketrideMessage}` : ""}`
                  : s.rocketrideStatus === "pending_configuration"
                    ? `Pending configuration${s.rocketrideMessage ? ` — ${s.rocketrideMessage}` : ""}`
                    : "—"
          }
        />

        {(() => {
          const d = (s.lastResponse as { daytona?: { status?: string; message?: string } } | undefined)?.daytona;
          const label =
            d?.status === "configured"
              ? "Configured"
              : d?.status === "not_configured"
                ? "Not configured"
                : "—";
          return <Row k="Daytona sandbox" v={label} />;
        })()}
      </div>
      {s.rocketrideResponse !== undefined && s.rocketrideResponse !== null && (
        <details className="mt-4">
          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            RocketRide raw response
          </summary>
          <pre className="mt-2 max-h-64 overflow-auto rounded-md bg-muted/60 p-3 text-xs">
            {JSON.stringify(s.rocketrideResponse, null, 2)}
          </pre>
        </details>
      )}
      {s.lastResponse !== undefined && (
        <details className="mt-4">
          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Last backend response
          </summary>
          <pre className="mt-2 max-h-64 overflow-auto rounded-md bg-muted/60 p-3 text-xs">
            {JSON.stringify(s.lastResponse, null, 2)}
          </pre>
        </details>
      )}
    </section>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{k}</div>
      <div className="mt-1 text-sm font-medium">{v}</div>
    </div>
  );
}
