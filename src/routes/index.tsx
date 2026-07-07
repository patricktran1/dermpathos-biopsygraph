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
        className="pointer-events-none absolute inset-x-0 top-0 h-[520px] opacity-70"
        style={{
          background:
            "radial-gradient(60% 60% at 50% 0%, var(--lavender-soft) 0%, transparent 70%)",
        }}
      />
      <div className="relative mx-auto flex max-w-5xl flex-col items-center px-6 pt-20 pb-24 text-center">
        <span className="chip bg-[var(--gold-soft)] text-[var(--gold)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--gold)]" />
          BiopsyGraph · Hackathon MVP
        </span>
        <h1 className="mt-6 font-display text-5xl font-semibold tracking-tight text-foreground md:text-6xl">
          DermPathOS
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground md:text-xl">
          A graph-aware pathology follow-up safety net for dermatology clinics.
        </p>
        <p className="mt-6 max-w-2xl text-base leading-relaxed text-foreground/80">
          BiopsyGraph connects patients, lesions, pathology results, diagnoses,
          required actions, notifications, scheduling, and physician review — so
          no biopsy result falls through the cracks.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/intake"
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--lavender)] px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-95"
          >
            Start Case Review
            <span aria-hidden>→</span>
          </Link>
          <button
            onClick={loadAndGo}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-5 py-3 text-sm font-semibold text-foreground transition hover:bg-accent"
          >
            View Demo Cases
          </button>
        </div>

        <div className="mt-20 grid w-full gap-4 md:grid-cols-3">
          {[
            {
              t: "Every biopsy tracked",
              d: "Patient → lesion → biopsy → result modeled as one graph.",
            },
            {
              t: "Follow-up gaps surfaced",
              d: "Missing notifications and unscheduled treatments become tasks.",
            },
            {
              t: "Explainable reasoning",
              d: "Every task links back to the exact BiopsyGraph path that created it.",
            },
          ].map((f) => (
            <div key={t_key(f.t)} className="card-clinical p-6 text-left">
              <div className="h-8 w-8 rounded-md bg-[var(--lavender-soft)]" />
              <h3 className="mt-4 text-base font-semibold">{f.t}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.d}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function t_key(s: string) {
  return s.replace(/\s+/g, "-").toLowerCase();
}
