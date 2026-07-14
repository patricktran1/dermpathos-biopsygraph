import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useDermStore } from "@/lib/derm/store";

export const Route = createFileRoute("/")({
  component: Welcome,
});

function Welcome() {
  const navigate = useNavigate();
  const { loadDemoCases } = useDermStore();

  const loadAndGo = () => {
    loadDemoCases();
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[620px] opacity-75"
        style={{
          background:
            "radial-gradient(60% 60% at 50% 0%, var(--lavender-soft) 0%, transparent 72%)",
        }}
      />
      <div className="relative mx-auto flex max-w-6xl flex-col items-center px-6 pb-24 pt-20 text-center">
        <span className="chip bg-[var(--gold-soft)] text-[var(--gold)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--gold)]" />
          Clinical obligation agent · Hackathon MVP
        </span>
        <h1 className="mt-7 font-display text-5xl font-semibold tracking-tight text-foreground md:text-7xl">
          Closed Care Loop
        </h1>
        <p className="mt-5 max-w-3xl text-xl leading-relaxed text-muted-foreground md:text-2xl">
          The agent that carries every clinical obligation from documented to done.
        </p>
        <p className="mt-6 max-w-3xl text-base leading-relaxed text-foreground/75">
          Pathology creates an obligation: review the result, reach the patient,
          arrange the right care, and verify that care actually happened. Closed
          Care Loop reconciles evidence across the workflow, proposes bounded
          actions, blocks unsafe automation, and refuses to confuse activity with
          closure.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={loadAndGo}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--lavender)] px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            Run the 3-case demo
            <span aria-hidden>→</span>
          </button>
          <Link
            to="/intake"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-6 py-3 text-sm font-semibold text-foreground transition hover:bg-accent"
          >
            Add a pathology result
          </Link>
        </div>

        <div className="mt-16 grid w-full gap-4 text-left md:grid-cols-3">
          {[
            {
              n: "01",
              t: "Detect the gap",
              d: "Find clinically significant results without documented communication, scheduling, or completed treatment.",
            },
            {
              n: "02",
              t: "Act within bounds",
              d: "Draft outreach, create tasks, and route work while preserving human control over clinical decisions.",
            },
            {
              n: "03",
              t: "Verify the outcome",
              d: "Keep the obligation open until the evidence proves that the patient received the required care.",
            },
          ].map((feature) => (
            <div key={feature.n} className="card-clinical p-6">
              <div className="text-xs font-semibold tracking-[0.18em] text-[var(--lavender)]">
                {feature.n}
              </div>
              <h3 className="mt-4 text-lg font-semibold">{feature.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {feature.d}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-8 w-full rounded-2xl border border-border bg-card/80 p-6 text-left shadow-sm backdrop-blur md:p-8">
          <div className="grid gap-6 md:grid-cols-[1fr_1.2fr] md:items-center">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                The Monday-morning demo
              </div>
              <h2 className="mt-3 font-display text-2xl font-semibold">
                Three failure modes. One closed-loop agent.
              </h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ["Lost melanoma", "No documented contact"],
                ["Wrong-site conflict", "Automation blocked"],
                ["Canceled treatment", "False closure reopened"],
              ].map(([title, detail]) => (
                <div key={title} className="rounded-lg bg-muted/55 p-4">
                  <div className="text-sm font-semibold">{title}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{detail}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
