import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/architecture")({
  head: () => ({
    meta: [
      { title: "Architecture · Closed Care Loop" },
      {
        name: "description",
        content:
          "How Closed Care Loop connects Abridge encounter intelligence, Anthropic tool use, deterministic safety policy, and EHR adapters.",
      },
    ],
  }),
  component: ArchitecturePage,
});

const layers = [
  {
    number: "01",
    tag: "Understand",
    title: "Abridge encounter adapter",
    items: [
      "Receives the event-provided conversation, note, or encounter payload",
      "Preserves linked evidence and source quotations",
      "Converts vendor fields into one stable obligation contract",
      "Keeps the exact Abridge schema isolated to one adapter file",
    ],
    contract: "unknown Abridge payload → EncounterInput",
    tone: "lavender",
  },
  {
    number: "02",
    tag: "Reason",
    title: "Anthropic tool-use agent",
    items: [
      "Searches the EHR before proposing an action",
      "Selects typed tools rather than returning unstructured instructions",
      "Receives tool results and continues the reasoning loop",
      "Falls back visibly when model access or validation fails",
    ],
    contract: "POST /api/agent/orchestrate → tool calls + auditable trace",
    tone: "gold",
  },
  {
    number: "03",
    tag: "Govern",
    title: "Approval and policy boundary",
    items: [
      "Allows read-only evidence searches without approval",
      "Blocks EHR writes until the user approves the exact tool",
      "Never sends patient communication autonomously",
      "Prevents a task or appointment from being mislabeled completed care",
    ],
    contract: "tool call + approval set → execute, preview, or block",
    tone: "moderate",
  },
  {
    number: "04",
    tag: "Execute",
    title: "EHR adapter layer",
    items: [
      "Uses OpenEMR FHIR as the reference implementation",
      "Creates Task, Communication, and ServiceRequest resources",
      "Reads Procedure and workflow evidence for closure verification",
      "Can be replaced by another EHR adapter without changing the agent",
    ],
    contract: "EhrAdapter → OpenEMR FHIR or safe mock mode",
    tone: "routine",
  },
] as const;

const toneMap = {
  lavender: "text-[var(--lavender)] bg-[var(--lavender-soft)]",
  gold: "text-[var(--gold)] bg-[var(--gold-soft)]",
  moderate: "text-[var(--moderate)] bg-[var(--moderate-soft)]",
  routine: "text-[var(--routine)] bg-[var(--routine-soft)]",
} as const;

function ArchitecturePage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="mb-10">
        <div className="chip bg-[var(--gold-soft)] text-[var(--gold)]">
          Event-aligned architecture
        </div>
        <h1 className="mt-4 max-w-4xl font-display text-3xl font-semibold md:text-4xl">
          Abridge supplies intelligence. Claude operates tools. The EHR supplies proof.
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          The prior hackathon sponsor stack has been removed from the active product
          architecture. Closed Care Loop now has three clean external boundaries:
          Abridge for encounter intelligence, Anthropic for agentic tool selection,
          and a replaceable EHR adapter for reads and writes.
        </p>
      </div>

      <div className="mb-8 rounded-xl border border-[var(--lavender)]/20 bg-[var(--lavender-soft)]/35 p-5">
        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--lavender)]">
          Integration rule
        </div>
        <div className="mt-2 text-lg font-semibold">
          Vendor payloads stop at adapters. Clinical safety rules stay inside the product.
        </div>
        <p className="mt-1 max-w-4xl text-sm leading-relaxed text-foreground/70">
          The exact Abridge resources provided on Saturday can be mapped in one file.
          OpenEMR can be exchanged for another EHR without rewriting Claude prompts,
          approval controls, obligation states, or closure criteria.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {layers.map((layer) => (
          <div key={layer.number} className="card-clinical p-6">
            <div className="flex items-center justify-between gap-3">
              <div className={`chip ${toneMap[layer.tone]}`}>{layer.tag}</div>
              <div className="font-mono text-xs text-muted-foreground">
                {layer.number}
              </div>
            </div>
            <h2 className="mt-4 font-display text-2xl font-semibold">
              {layer.title}
            </h2>
            <ul className="mt-4 space-y-2 text-sm text-foreground/80">
              {layer.items.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--lavender)]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <div className="mt-5 rounded-md bg-muted/60 px-3 py-2 font-mono text-xs text-muted-foreground">
              {layer.contract}
            </div>
          </div>
        ))}
      </div>

      <div className="card-clinical mt-8 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-display text-lg font-semibold">Runtime data flow</h3>
          <Link
            to="/integration-lab"
            className="rounded-lg bg-[var(--lavender)] px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Run live trace
          </Link>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-x-1 gap-y-3 text-xs font-semibold">
          {[
            "Abridge encounter payload",
            "Normalized obligation",
            "Claude tool selection",
            "EHR evidence search",
            "Approval gate",
            "OpenEMR adapter",
            "Tool result",
            "Closure verification",
          ].map((node, index, array) => (
            <div key={node} className="flex items-center gap-1">
              <span className="rounded-lg border border-border bg-card px-3 py-2 font-mono">
                {node}
              </span>
              {index < array.length - 1 && (
                <span className="text-muted-foreground">→</span>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <ConfigCard
          title="Safe demo mode"
          detail="No external credentials required. The full agent tool trace runs against a deterministic mock EHR, and writes remain approval-gated."
          values={["forceMockEhr=true", "ANTHROPIC_API_KEY optional"]}
        />
        <ConfigCard
          title="OpenEMR reference mode"
          detail="Point the adapter at the OpenEMR FHIR base URL and token. Writes remain previews unless they are approved and explicitly enabled server-side."
          values={[
            "OPENEMR_FHIR_BASE_URL",
            "OPENEMR_ACCESS_TOKEN",
            "OPENEMR_ALLOW_WRITES=true",
          ]}
        />
      </div>
    </div>
  );
}

function ConfigCard({
  title,
  detail,
  values,
}: {
  title: string;
  detail: string;
  values: string[];
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{detail}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {values.map((value) => (
          <code key={value} className="rounded-md bg-muted px-2.5 py-1.5 text-xs">
            {value}
          </code>
        ))}
      </div>
    </div>
  );
}
