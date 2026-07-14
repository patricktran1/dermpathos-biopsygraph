import { useState } from "react";
import type { PathologyCase } from "@/lib/derm/types";

interface Interpretation {
  summary: string;
  risks: string[];
  recommendedAction: string;
  confidence: "high" | "medium" | "low";
  unresolvedQuestions: string[];
  sourceCitations: Array<{ field: string; quote: string }>;
}

interface AgentResponse {
  success: boolean;
  mode: "claude" | "deterministic_fallback";
  model: string | null;
  configurationMessage: string | null;
  interpretation: Interpretation;
}

export function ClaudeAgentPanel({ pathologyCase }: { pathologyCase: PathologyCase }) {
  const [result, setResult] = useState<AgentResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/agent/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientName: pathologyCase.patientName,
          diagnosis: pathologyCase.diagnosis,
          pathologyResult: pathologyCase.pathologyResult,
          biopsySite: pathologyCase.bodySite,
          scheduledSite: pathologyCase.scheduledBodySite,
          patientNotified: pathologyCase.patientNotified,
          appointmentStatus:
            pathologyCase.appointmentStatus ??
            (pathologyCase.treatmentScheduled === "Yes"
              ? "Scheduled"
              : "Not scheduled"),
          treatmentCompleted: pathologyCase.treatmentCompleted ?? "No",
        }),
      });
      const body = (await response.json()) as AgentResponse | { message?: string };
      if (!response.ok || !("interpretation" in body)) {
        throw new Error(body.message ?? "Agent review failed.");
      }
      setResult(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Agent review failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="card-clinical p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Claude interpretation layer
          </div>
          <h2 className="mt-2 text-lg font-semibold">
            Separate language interpretation from policy enforcement
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Claude reads the messy clinical record and returns structured risks with
            source quotations. Deterministic rules still control deadlines, allowed
            actions, blocking conditions, and closure.
          </p>
        </div>
        <button
          onClick={run}
          disabled={loading}
          className="rounded-lg bg-[var(--lavender)] px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-95 disabled:opacity-60"
        >
          {loading ? "Reviewing record..." : result ? "Run review again" : "Run Claude review"}
        </button>
      </div>

      {error && (
        <div className="mt-5 rounded-lg border border-[var(--urgent)]/25 bg-[var(--urgent-soft)]/40 p-4 text-sm text-[var(--urgent)]">
          {error}
        </div>
      )}

      {!result && !error && (
        <div className="mt-5 rounded-lg border border-dashed border-border bg-muted/30 p-5 text-sm text-muted-foreground">
          This step is intentionally user-triggered in the demo so the model boundary,
          structured output, and fallback behavior remain visible.
        </div>
      )}

      {result && (
        <div className="mt-6 space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wider ${
                result.mode === "claude"
                  ? "bg-[var(--lavender-soft)] text-[var(--lavender)]"
                  : "bg-[var(--gold-soft)] text-[var(--gold)]"
              }`}
            >
              {result.mode === "claude" ? "Live Claude" : "Deterministic fallback"}
            </span>
            <span className="text-xs text-muted-foreground">
              Confidence: {result.interpretation.confidence}
              {result.model ? ` · ${result.model}` : ""}
            </span>
          </div>

          {result.configurationMessage && (
            <div className="rounded-lg bg-[var(--gold-soft)]/55 p-3 text-xs text-[var(--gold)]">
              {result.configurationMessage}
            </div>
          )}

          <div className="rounded-xl bg-muted/45 p-5">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Structured interpretation
            </div>
            <p className="mt-2 text-sm leading-relaxed">
              {result.interpretation.summary}
            </p>
            <div className="mt-4 rounded-lg border border-border bg-card p-4">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Recommended operational action
              </div>
              <div className="mt-1 text-sm font-semibold">
                {result.interpretation.recommendedAction}
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Risks detected
              </div>
              <div className="mt-2 space-y-2">
                {result.interpretation.risks.length > 0 ? (
                  result.interpretation.risks.map((risk) => (
                    <div
                      key={risk}
                      className="rounded-lg border border-[var(--urgent)]/20 bg-[var(--urgent-soft)]/35 p-3 text-sm"
                    >
                      {risk}
                    </div>
                  ))
                ) : (
                  <div className="rounded-lg bg-[var(--routine-soft)] p-3 text-sm text-[var(--routine)]">
                    No unresolved operational risk identified.
                  </div>
                )}
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Source quotations
              </div>
              <div className="mt-2 space-y-2">
                {result.interpretation.sourceCitations.map((citation, index) => (
                  <div key={`${citation.field}-${index}`} className="rounded-lg border border-border p-3">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {citation.field}
                    </div>
                    <div className="mt-1 text-xs leading-relaxed">“{citation.quote}”</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {result.interpretation.unresolvedQuestions.length > 0 && (
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Questions requiring human resolution
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {result.interpretation.unresolvedQuestions.map((question) => (
                  <span key={question} className="rounded-md bg-muted px-3 py-2 text-xs">
                    {question}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
