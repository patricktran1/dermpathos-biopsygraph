import { useState } from "react";

interface Props {
  caseId: string;
  patientName: string;
}

type JsonValue = unknown;

async function callJson(url: string, init?: RequestInit): Promise<JsonValue> {
  const res = await fetch(url, init);
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { rawText: text, status: res.status };
  }
}

function ResultBlock({ label, value }: { label: string; value: JsonValue }) {
  if (value === null || value === undefined) return null;
  return (
    <div className="mt-3">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <pre className="mt-1 max-h-64 overflow-auto rounded-md bg-muted/60 p-3 text-xs">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

export function CaseBiopsyGraphPanel({ caseId, patientName }: Props) {
  const [syncing, setSyncing] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [syncResult, setSyncResult] = useState<JsonValue>(null);
  const [verifyResult, setVerifyResult] = useState<JsonValue>(null);

  const isSuccess = (r: JsonValue) =>
    r !== null && typeof r === "object" && (r as { success?: boolean }).success === true;

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    const payload = { caseKey: caseId, case_id: caseId, patient_name: patientName };
    console.log("[BiopsyGraph] sync request", payload);
    const result = await callJson("/api/biopsygraph/sync-case", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    console.log("[BiopsyGraph] sync response", result);
    setSyncResult(result);
    setSyncing(false);
  };

  const handleVerify = async () => {
    setVerifying(true);
    setVerifyResult(null);
    const payload = { caseKey: caseId, case_id: caseId, patient_name: patientName };
    const result = await callJson("/api/biopsygraph/verify-case", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    console.log("[BiopsyGraph] verify response", result);
    setVerifyResult(result);
    setVerifying(false);
  };

  const syncMsg =
    syncResult && typeof syncResult === "object"
      ? (syncResult as { message?: string }).message
      : undefined;
  const verifyMsg =
    verifyResult && typeof verifyResult === "object"
      ? (verifyResult as { message?: string }).message
      : undefined;

  return (
    <section className="card-clinical mt-8 p-6">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          BiopsyGraph (Neo4j) sync
        </h2>
        <span className="text-xs text-muted-foreground">
          case_id: <code className="font-mono">{caseId}</code>
        </span>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Reads this case from Butterbase server-side and writes it into Neo4j.
        Secrets stay on the server.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={handleSync}
          disabled={syncing}
          className="rounded-lg bg-[var(--lavender)] px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {syncing ? "Syncing…" : "Sync This Case to BiopsyGraph"}
        </button>
        <button
          onClick={handleVerify}
          disabled={verifying}
          className="rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:bg-accent disabled:opacity-50"
        >
          {verifying ? "Verifying…" : "Verify This Case in BiopsyGraph"}
        </button>
      </div>

      {(syncMsg || verifyMsg) && (
        <div className="mt-4 space-y-2">
          {syncMsg && (
            <div
              className={`rounded-md p-3 text-sm ${
                isSuccess(syncResult)
                  ? "bg-[var(--routine-soft)] text-[var(--routine)]"
                  : "bg-[var(--urgent-soft)] text-[var(--urgent)]"
              }`}
            >
              {syncMsg}
            </div>
          )}
          {verifyMsg && (
            <div
              className={`rounded-md p-3 text-sm ${
                isSuccess(verifyResult)
                  ? "bg-[var(--routine-soft)] text-[var(--routine)]"
                  : "bg-[var(--urgent-soft)] text-[var(--urgent)]"
              }`}
            >
              {verifyMsg}
            </div>
          )}
        </div>
      )}

      <ResultBlock label="Last sync response" value={syncResult} />
      <ResultBlock label="Last verify response" value={verifyResult} />
    </section>
  );
}
