import { Link } from "@tanstack/react-router";

export function CaseSyncBadge({ caseId: _caseId }: { caseId: string }) {
  return (
    <span className="chip bg-[var(--lavender-soft)] text-[var(--lavender)]">
      EHR adapter ready
    </span>
  );
}

export function CaseBackendStatusPanel({ caseId }: { caseId: string }) {
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Event stack integration
          </div>
          <h3 className="mt-2 text-lg font-semibold">Abridge → Anthropic → EHR</h3>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            This case can be converted into normalized encounter intelligence, evaluated
            through Anthropic tool use, and executed through the approval-gated EHR
            adapter. OpenEMR FHIR is the current reference implementation.
          </p>
        </div>
        <Link
          to="/integration-lab"
          className="rounded-lg bg-[var(--lavender)] px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          Run tool trace
        </Link>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <StatusItem label="Encounter adapter" value="Abridge-ready" />
        <StatusItem label="Agent runtime" value="Claude + fallback" />
        <StatusItem label="EHR boundary" value="OpenEMR FHIR / mock" />
      </div>

      <div className="mt-4 rounded-lg bg-muted/45 px-3 py-2 font-mono text-[11px] text-muted-foreground">
        obligation_case={caseId}
      </div>
    </section>
  );
}

function StatusItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/25 p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold">{value}</div>
    </div>
  );
}
