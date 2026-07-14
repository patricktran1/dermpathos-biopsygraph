import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ClaudeAgentPanel } from "@/components/ClaudeAgentPanel";
import { DEMO_CASES } from "@/lib/derm/store";

export const Route = createFileRoute("/agent-review")({
  head: () => ({
    meta: [{ title: "Claude Review · Closed Care Loop" }],
  }),
  component: AgentReviewPage,
});

function AgentReviewPage() {
  const [selectedId, setSelectedId] = useState(DEMO_CASES[0].id);
  const pathologyCase =
    DEMO_CASES.find((item) => item.id === selectedId) ?? DEMO_CASES[0];

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-7">
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--lavender)]">
          Model boundary demo
        </div>
        <h1 className="mt-2 font-display text-3xl font-semibold">
          Claude reads the mess. Policy controls the action.
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          Select a synthetic case and run the interpretation layer. Claude returns
          structured operational risks and source quotations. The deterministic
          workflow engine remains responsible for safety gates and closure rules.
        </p>
      </div>

      <div className="mb-6 grid gap-3 md:grid-cols-3">
        {DEMO_CASES.slice(0, 3).map((item) => (
          <button
            key={item.id}
            onClick={() => setSelectedId(item.id)}
            className={`rounded-xl border p-4 text-left transition ${
              selectedId === item.id
                ? "border-[var(--lavender)] bg-[var(--lavender-soft)]/55"
                : "border-border bg-card hover:bg-accent"
            }`}
          >
            <div className="text-sm font-semibold">{item.patientName}</div>
            <div className="mt-1 text-xs text-muted-foreground">{item.diagnosis}</div>
            <div className="mt-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {item.demoScenario?.replaceAll("-", " ")}
            </div>
          </button>
        ))}
      </div>

      <ClaudeAgentPanel key={pathologyCase.id} pathologyCase={pathologyCase} />

      <section className="mt-6 rounded-xl border border-border bg-card p-5">
        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Production guardrail
        </div>
        <div className="mt-2 grid gap-4 text-sm md:grid-cols-3">
          <Guardrail
            title="Validated structure"
            detail="Model output must pass a strict schema before the application can use it."
          />
          <Guardrail
            title="Evidence required"
            detail="The model must quote the supplied record rather than rely on unsupported inference."
          />
          <Guardrail
            title="Fail safe"
            detail="API, parsing, or schema failure routes to deterministic workflow logic instead of silent degradation."
          />
        </div>
      </section>
    </div>
  );
}

function Guardrail({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-lg bg-muted/45 p-4">
      <div className="font-semibold">{title}</div>
      <div className="mt-1 text-xs leading-relaxed text-muted-foreground">{detail}</div>
    </div>
  );
}
