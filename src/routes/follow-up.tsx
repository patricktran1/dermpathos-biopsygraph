import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/follow-up")({
  head: () => ({
    meta: [
      { title: "Clinical Obligations · Closed Care Loop" },
      {
        name: "description",
        content:
          "The legacy follow-up queue has been consolidated into the evidence-based clinical obligation command center.",
      },
    ],
  }),
  component: FollowUpRedirectPage,
});

function FollowUpRedirectPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-20 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--lavender-soft)] text-[var(--lavender)]">
        ✓
      </div>
      <h1 className="mt-5 font-display text-3xl font-semibold">
        Follow-up is now tracked as a clinical obligation
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        The old task queue allowed activity to be marked complete without proving
        that the patient received the intended care. Closed Care Loop now requires
        source evidence, safe workflow state transitions, and verified closure.
      </p>
      <Link
        to="/dashboard"
        className="mt-7 inline-flex rounded-lg bg-[var(--lavender)] px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-95"
      >
        Open clinical obligations
      </Link>
    </div>
  );
}
