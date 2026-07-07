import { createFileRoute } from "@tanstack/react-router";

interface Input {
  caseKey?: string;
  patient_name?: string;
  diagnosis?: string;
  margins?: string;
  priority?: string;
  required_action?: string;
  responsible_physician?: string;
  butterbase?: {
    biopsy_case_saved?: boolean;
    follow_up_task_saved?: boolean;
  };
  biopsygraph?: {
    graph_synced?: boolean;
    verified?: boolean;
  };
  rocketride?: unknown;
}

export const Route = createFileRoute("/api/daytona/validate-case")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const input = (await request.json().catch(() => ({}))) as Input;
        const apiKey = process.env.DAYTONA_API_KEY;

        if (!apiKey) {
          return Response.json({
            success: false,
            sandbox: "Daytona",
            sandbox_completed: false,
            status: "not_configured",
            message: "DAYTONA_API_KEY is not configured.",
          });
        }

        // Validation script executed inside the Daytona sandbox. Python (the
        // default Daytona code interpreter language). Reads the case payload
        // from the CASE env var and prints a single-line JSON result.
        const script = `
import os, json
c = json.loads(os.environ.get("CASE", "{}"))
HIGH_RISK_DX = ["melanoma","melanoma in situ","squamous cell carcinoma","scc","basal cell carcinoma","bcc"]
RISKY_MARGINS = ["involved","transected","positive","not clear"]
def includes_any(h, ns):
    s = str(h or "").lower()
    return any(n in s for n in ns)
flags = []
if not c.get("caseKey"): flags.append("Missing caseKey")
if not c.get("patient_name"): flags.append("Missing patient_name")
if not c.get("diagnosis"): flags.append("Missing diagnosis")
if not c.get("required_action"): flags.append("Missing required_action")
if not c.get("responsible_physician"): flags.append("Missing responsible_physician")
bb = c.get("butterbase") or {}
if bb.get("biopsy_case_saved") is not True: flags.append("Butterbase biopsy_case not saved")
if bb.get("follow_up_task_saved") is not True: flags.append("Butterbase follow_up_task not saved")
bg = c.get("biopsygraph") or {}
if bg.get("graph_synced") is not True: flags.append("BiopsyGraph not synced")
if bg.get("verified") is not True: flags.append("BiopsyGraph not verified")
if includes_any(c.get("diagnosis"), HIGH_RISK_DX) and not c.get("priority"):
    flags.append("High-risk diagnosis missing priority")
if includes_any(c.get("margins"), RISKY_MARGINS) and not c.get("required_action"):
    flags.append("Risky margins missing required_action")
checks_passed = len(flags) == 0
validation_summary = ("Case has required follow-up task, responsible physician, required action, Butterbase records, and BiopsyGraph verification."
                      if checks_passed else "Case failed one or more safety validation checks.")
print(json.dumps({"checks_passed": checks_passed, "risk_flags": flags, "validation_summary": validation_summary}))
`.trim();

        let sandbox: unknown = null;
        try {
          const { Daytona } = await import("@daytonaio/sdk");
          const daytona = new Daytona({ apiKey });
          sandbox = (await daytona.create()) as typeof sandbox;
          const sb = sandbox as unknown as {
            process: {
              codeRun: (
                code: string,
                params?: { env?: Record<string, string> },
                timeout?: number,
              ) => Promise<{ result?: string; exitCode?: number; stderr?: string }>;
            };
          };
          const response = await sb.process.codeRun(
            script,
            { env: { CASE: JSON.stringify(input) } },
            60,
          );
          const raw = (response.result ?? "").trim();
          const lastLine = raw.split("\n").filter(Boolean).pop() ?? "{}";
          let parsed: {
            checks_passed?: boolean;
            risk_flags?: string[];
            validation_summary?: string;
          } = {};
          try {
            parsed = JSON.parse(lastLine);
          } catch {
            parsed = {};
          }
          const checks_passed = parsed.checks_passed === true;
          return Response.json({
            success: checks_passed,
            sandbox: "Daytona",
            sandbox_completed: true,
            checks_passed,
            risk_flags: parsed.risk_flags ?? [],
            validation_summary:
              parsed.validation_summary ??
              (checks_passed
                ? "Case has required follow-up task, responsible physician, required action, Butterbase records, and BiopsyGraph verification."
                : "Case failed one or more safety validation checks."),
            sandbox_exit_code: response.exitCode,
            sandbox_raw_output: raw,
          });
        } catch (err) {
          return Response.json({
            success: false,
            sandbox: "Daytona",
            sandbox_completed: false,
            status: "sandbox_error",
            message: err instanceof Error ? err.message : String(err),
          });
        } finally {
          const sb = sandbox as { delete?: () => Promise<unknown> } | null;
          if (sb && typeof sb.delete === "function") {
            try {
              await sb.delete();
            } catch {
              // best-effort cleanup
            }
          }
        }
      },
    },
  },
});
