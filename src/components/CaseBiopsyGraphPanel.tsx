interface Props {
  caseId: string;
  patientName: string;
}

export function CaseBiopsyGraphPanel({ caseId, patientName }: Props) {
  const nodes = [
    "Abridge encounter",
    "Clinical obligation",
    "EHR evidence search",
    "Approved action",
    "Completed care evidence",
    "Verified closure",
  ];

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        Obligation evidence map
      </div>
      <h3 className="mt-2 text-lg font-semibold">{patientName}</h3>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
        The product does not require a graph database. It preserves the clinically
        important relationship as an auditable evidence chain that can be stored in
        the application database or represented through native EHR resources.
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-x-1 gap-y-3">
        {nodes.map((node, index) => (
          <div key={node} className="flex items-center gap-1">
            <span
              className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
                index < 2
                  ? "border-[var(--lavender)]/25 bg-[var(--lavender-soft)] text-[var(--lavender)]"
                  : index === nodes.length - 1
                    ? "border-[var(--routine)]/25 bg-[var(--routine-soft)] text-[var(--routine)]"
                    : "border-border bg-muted/35"
              }`}
            >
              {node}
            </span>
            {index < nodes.length - 1 && (
              <span className="text-muted-foreground">→</span>
            )}
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-lg bg-muted/45 px-3 py-2 font-mono text-[11px] text-muted-foreground">
        case_id={caseId} · closure_policy=evidence_required
      </div>
    </section>
  );
}
