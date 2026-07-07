import { useMemo, useState } from "react";
import { useDermStore } from "@/lib/derm/store";
import { buildCogneeMemory } from "@/lib/derm/cognee";

export function CogneeMemoryExportPanel() {
  const { cases, tasks, syncStatus } = useDermStore();
  const submittedCases = useMemo(
    () =>
      cases.filter((c) => {
        const s = syncStatus[c.id];
        return s && s.mode === "butterbase_and_graph";
      }),
    [cases, syncStatus],
  );

  const [selectedId, setSelectedId] = useState<string>("");
  const activeId = selectedId || submittedCases[0]?.id || "";
  const activeCase = submittedCases.find((c) => c.id === activeId);
  const payload = activeCase
    ? buildCogneeMemory(activeCase, syncStatus[activeCase.id], tasks[activeCase.id])
    : null;
  const json = payload ? JSON.stringify(payload, null, 2) : "";

  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const copy = async () => {
    if (!json) return;
    let copied = false;
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
        await navigator.clipboard.writeText(json);
        copied = true;
      }
    } catch {
      copied = false;
    }
    if (!copied) {
      try {
        const textarea = document.createElement("textarea");
        textarea.value = json;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        textarea.setSelectionRange(0, json.length);
        copied = document.execCommand("copy");
        document.body.removeChild(textarea);
      } catch {
        copied = false;
      }
    }
    if (copied) {
      setCopyMessage("Copied Cognee memory JSON.");
    } else {
      setCopyMessage("Copy failed. Use Download JSON instead.");
    }
    setTimeout(() => setCopyMessage(null), 2500);
  };
  const download = () => {
    if (!json || !activeCase) return;
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cognee-memory-${activeCase.id}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="card-clinical p-6">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <div className="chip bg-[var(--lavender-soft)] text-[var(--lavender)]">
            Sponsor · Cognee-ready export
          </div>
          <h2 className="mt-3 font-display text-xl font-semibold">
            Cognee Memory Export
          </h2>
        </div>
        <span className="chip bg-muted text-muted-foreground">
          {payload ? "Cognee memory payload prepared" : "No submitted case yet"}
        </span>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Cognee integration is prepared as an AI memory layer. This export can be
        ingested by Cognee Open Source or a Cognee REST/MCP server when
        configured. No Cognee ingestion is performed from the browser and no
        Cognee API key is required.
      </p>

      {submittedCases.length === 0 ? (
        <div className="mt-4 rounded-md border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
          Submit a case from Intake to generate a Cognee-ready memory payload
          from real Butterbase + BiopsyGraph status.
        </div>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Case
            </label>
            <select
              value={activeId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            >
              {submittedCases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.patientName} — {c.diagnosis || "Case"}
                </option>
              ))}
            </select>
            <div className="ml-auto flex gap-2">
              <button
                onClick={copy}
                className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-semibold hover:bg-accent"
              >
                Copy Cognee Memory JSON
              </button>
              <button
                onClick={download}
                className="rounded-lg bg-[var(--lavender)] px-3 py-1.5 text-sm font-semibold text-primary-foreground"
              >
                Download Cognee Memory JSON
              </button>
            </div>
            {copyMessage && (
              <div className="w-full text-right text-xs text-muted-foreground">
                {copyMessage}
              </div>
            )}
          </div>

          <pre className="mt-4 max-h-96 overflow-auto rounded-md bg-muted/60 p-3 text-xs leading-relaxed">
            {json}
          </pre>
        </>
      )}
    </section>
  );
}
