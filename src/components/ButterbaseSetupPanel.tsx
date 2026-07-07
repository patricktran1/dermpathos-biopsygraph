import { useState } from "react";
import {
  BUTTERBASE_PUBLIC_INFO,
  submitSarah,
  testBackend,
  verifySarah,
} from "@/lib/derm/butterbase";

type StepKey = "test" | "submit" | "verify";

interface StepResult {
  ok: boolean;
  message: string;
  raw: unknown;
}

/**
 * Backend Integration Panel.
 *
 * Talks only to internal /api/butterbase/* endpoints. The Butterbase API key
 * lives server-side; the browser never sends or receives it.
 */
export function ButterbaseSetupPanel() {
  const [pending, setPending] = useState<StepKey | null>(null);
  const [results, setResults] = useState<Record<StepKey, StepResult | null>>({
    test: null,
    submit: null,
    verify: null,
  });

  const run = async (step: StepKey) => {
    setPending(step);
    try {
      let raw: unknown;
      let ok = false;
      let message = "";
      if (step === "test") {
        const r = await testBackend();
        raw = r;
        ok = r.success;
        message = r.message;
      } else if (step === "submit") {
        const r = await submitSarah();
        raw = r;
        ok = r.success;
        message = r.message;
      } else {
        const r = await verifySarah();
        raw = r;
        ok = r.success;
        message = r.message;
      }
      setResults((prev) => ({ ...prev, [step]: { ok, message, raw } }));
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

  return (
    <div className="card-clinical p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="chip bg-[var(--lavender-soft)] text-[var(--lavender)]">
            Backend integration
          </div>
          <h2 className="mt-3 font-display text-2xl font-semibold">
            Butterbase Backend
          </h2>
        </div>
      </div>

      <div className="mt-4 grid gap-1 rounded-md border border-border bg-card/60 p-3 text-xs">
        <InfoRow label="API URL" value={BUTTERBASE_PUBLIC_INFO.apiUrl} />
        <InfoRow label="App ID" value={BUTTERBASE_PUBLIC_INFO.appId} />
        <InfoRow label="API key" value="stored server-side (BUTTERBASE_API_KEY)" />
      </div>

      <div className="mt-4 rounded-md border border-[var(--routine)]/30 bg-[var(--routine-soft)]/40 px-3 py-2 text-xs text-[var(--routine)]">
        Secrets are server-side only. The browser never receives the Butterbase
        API key. All calls go through internal <code className="font-mono">/api/butterbase/*</code> routes.
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <ActionButton
          onClick={() => run("test")}
          pending={pending === "test"}
          disabled={pending !== null}
        >
          Test Butterbase Backend
        </ActionButton>
        <ActionButton
          onClick={() => run("submit")}
          pending={pending === "submit"}
          disabled={pending !== null}
        >
          Submit Sarah Miller to Butterbase
        </ActionButton>
        <ActionButton
          onClick={() => run("verify")}
          pending={pending === "verify"}
          disabled={pending !== null}
        >
          Verify Sarah Miller Rows
        </ActionButton>
      </div>

      <div className="mt-5 grid gap-3">
        <ResultBlock title="1. Test" result={results.test} />
        <ResultBlock title="2. Submit Sarah Miller" result={results.submit} />
        <ResultBlock title="3. Verify Sarah Miller" result={results.verify} />
      </div>
    </div>
  );
}

function ActionButton({
  onClick,
  disabled,
  pending,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  pending?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
    >
      {pending ? "Running…" : children}
    </button>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="min-w-[7rem] text-muted-foreground">{label}</dt>
      <dd className="break-all font-mono">{value}</dd>
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
