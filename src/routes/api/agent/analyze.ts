import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const RequestSchema = z.object({
  patientName: z.string().min(1),
  diagnosis: z.string().default(""),
  pathologyResult: z.string().min(1),
  biopsySite: z.string().min(1),
  scheduledSite: z.string().optional(),
  patientNotified: z.string(),
  appointmentStatus: z.string(),
  treatmentCompleted: z.string(),
});

const InterpretationSchema = z.object({
  summary: z.string(),
  risks: z.array(z.string()).max(6),
  recommendedAction: z.string(),
  confidence: z.enum(["high", "medium", "low"]),
  unresolvedQuestions: z.array(z.string()).max(6),
  sourceCitations: z
    .array(
      z.object({
        field: z.string(),
        quote: z.string(),
      }),
    )
    .max(8),
});

type RequestBody = z.infer<typeof RequestSchema>;

function fallback(body: RequestBody, reason: string) {
  const siteConflict = Boolean(
    body.scheduledSite &&
      body.scheduledSite.trim().toLowerCase() !== body.biopsySite.trim().toLowerCase(),
  );
  const risks: string[] = [];
  if (body.patientNotified.toLowerCase() === "no")
    risks.push("No documented patient notification");
  if (body.appointmentStatus.toLowerCase() === "canceled")
    risks.push("Canceled treatment appointment without verified replacement");
  if (siteConflict) risks.push("Biopsy and scheduling sites conflict");
  if (body.treatmentCompleted.toLowerCase() !== "yes")
    risks.push("Definitive treatment is not verified");

  return {
    success: true,
    mode: "deterministic_fallback" as const,
    model: null,
    configurationMessage: reason,
    interpretation: {
      summary:
        risks.length > 0
          ? `The record contains ${risks.length} unresolved operational risk${risks.length === 1 ? "" : "s"}. The case should remain open until the evidence chain is complete.`
          : "The supplied record does not contain an obvious unresolved operational gap.",
      risks,
      recommendedAction: siteConflict
        ? "Stop automation and require clinician verification of the intended treatment site."
        : body.patientNotified.toLowerCase() === "no"
          ? "Route clinician-reviewed patient outreach and keep treatment planning open."
          : body.appointmentStatus.toLowerCase() === "canceled"
            ? "Reopen the obligation and return it to treatment scheduling."
            : "Verify completed treatment before closing the obligation.",
      confidence: "high" as const,
      unresolvedQuestions: siteConflict
        ? ["Which body site did the clinician intend to treat?"]
        : [],
      sourceCitations: [
        { field: "Pathology diagnosis", quote: body.pathologyResult },
        { field: "Biopsy site", quote: body.biopsySite },
        ...(body.scheduledSite
          ? [{ field: "Scheduled site", quote: body.scheduledSite }]
          : []),
      ],
    },
  };
}

function extractJson(text: string): unknown {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  return JSON.parse(cleaned);
}

export const Route = createFileRoute("/api/agent/analyze")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const parsedBody = RequestSchema.safeParse(
          await request.json().catch(() => null),
        );
        if (!parsedBody.success) {
          return Response.json(
            {
              success: false,
              message: "Invalid clinical context payload.",
              issues: parsedBody.error.flatten(),
            },
            { status: 400 },
          );
        }

        const body = parsedBody.data;
        const apiKey = process.env.ANTHROPIC_API_KEY;
        const model = process.env.ANTHROPIC_MODEL;
        if (!apiKey || !model) {
          return Response.json(
            fallback(
              body,
              "Set ANTHROPIC_API_KEY and ANTHROPIC_MODEL to enable live Claude interpretation.",
            ),
          );
        }

        const prompt = `You are the interpretation layer inside a healthcare clinic workflow agent. Analyze only the operational obligation created by this pathology result. Do not diagnose, change treatment, or invent facts.

Return valid JSON with exactly these keys:
{
  "summary": string,
  "risks": string[],
  "recommendedAction": string,
  "confidence": "high" | "medium" | "low",
  "unresolvedQuestions": string[],
  "sourceCitations": [{"field": string, "quote": string}]
}

Rules:
- Separate record interpretation from clinical policy enforcement.
- Identify missing communication, canceled care, site or laterality conflicts, and missing proof of completed treatment.
- Quote only text present in the supplied record.
- When evidence conflicts, recommend stopping automation and escalating to a human.
- Keep the case open unless required care is verifiably complete.

Clinical context:
${JSON.stringify(body, null, 2)}`;

        try {
          const response = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-api-key": apiKey,
              "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify({
              model,
              max_tokens: 900,
              temperature: 0,
              messages: [{ role: "user", content: prompt }],
            }),
          });

          const raw = (await response.json().catch(() => null)) as
            | {
                content?: Array<{ type?: string; text?: string }>;
                error?: { message?: string };
              }
            | null;

          if (!response.ok) {
            return Response.json(
              fallback(
                body,
                raw?.error?.message ?? `Anthropic API returned ${response.status}.`,
              ),
            );
          }

          const text = raw?.content
            ?.filter((item) => item.type === "text" && item.text)
            .map((item) => item.text)
            .join("\n");
          if (!text) {
            return Response.json(
              fallback(body, "Claude returned no text content; deterministic fallback used."),
            );
          }

          const validated = InterpretationSchema.safeParse(extractJson(text));
          if (!validated.success) {
            return Response.json(
              fallback(
                body,
                "Claude output did not pass the structured clinical workflow schema.",
              ),
            );
          }

          return Response.json({
            success: true,
            mode: "claude" as const,
            model,
            configurationMessage: null,
            interpretation: validated.data,
          });
        } catch (error) {
          return Response.json(
            fallback(
              body,
              error instanceof Error
                ? error.message
                : "Claude request failed; deterministic fallback used.",
            ),
          );
        }
      },
    },
  },
});
