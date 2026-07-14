# Closed Care Loop

**The clinical obligation agent that carries care from documented to done.**

Closed Care Loop turns encounter intelligence into completed-care workflows. Abridge supplies the clinical conversation and supporting evidence. Anthropic selects typed tools. The application executes those tools through an EHR adapter and keeps the obligation open until the required outcome is verified.

The hackathon MVP focuses on one high-risk dermatology workflow:

> Pathology result → patient notification → correct treatment scheduling → completed treatment → verified closure

## Why this exists

A biopsy result can be reviewed without the patient being contacted. The patient can be notified without treatment being scheduled. Treatment can be scheduled and later canceled while a task still appears handled. A wrong-side order can also move forward unless someone compares the source evidence.

Most systems track activity. Closed Care Loop tracks the clinical obligation until the outcome is proven.

## Event stack

### Abridge encounter intelligence

`src/lib/event-stack/abridge.ts` is the vendor adapter boundary. It accepts unknown JSON and normalizes the event-provided Abridge payload into a stable `EncounterInput` contract.

The exact hackathon schema can be mapped in this one file without changing the agent, approval boundary, EHR adapter, or UI.

### Anthropic tool-use agent

`POST /api/agent/orchestrate` implements the client-tool loop:

1. Claude receives normalized encounter intelligence.
2. Claude must search EHR evidence first.
3. Claude selects one or more typed tools.
4. The application approves, previews, or blocks each call.
5. The EHR adapter executes approved calls.
6. Tool results are returned to Claude.
7. Closure remains open until evidence satisfies deterministic criteria.

The current tools are:

- `ehr_search_evidence`
- `ehr_create_task`
- `ehr_draft_patient_communication`
- `ehr_create_service_request`
- `ehr_verify_closure`

### EHR adapter

`src/lib/event-stack/openemr.ts` implements the reference adapter using configurable FHIR endpoints.

The agent depends on the `EhrAdapter` interface, not OpenEMR itself. A future Epic, Oracle Health, athenahealth, or custom EHR adapter can replace OpenEMR without changing the agent contract.

Reference resources:

- `Task`
- `Communication`
- `ServiceRequest`
- `Procedure`

## Safety boundary

Read-only evidence tools may execute without approval.

Every EHR write is blocked until the application receives explicit approval for the exact tool name. Even approved patient communication is created only as a draft. The prototype does not autonomously send messages, change treatment, or mark an obligation closed.

OpenEMR writes also require the server-side environment flag:

```bash
OPENEMR_ALLOW_WRITES=true
```

Without that flag, the adapter returns a safe write preview.

## Reliable fallback

The full tool trace works without external credentials.

When Anthropic credentials are unavailable or a model request fails, the application runs the identical approval-gated EHR tool path using a deterministic fallback and labels the mode visibly.

When OpenEMR credentials are unavailable, the EHR adapter runs in mock mode with synthetic evidence and resources.

## Routes

- `/` product thesis and event-stack entry
- `/judge-mode` guided three-minute presentation
- `/integration-lab` Abridge → Anthropic → EHR execution trace
- `/dashboard` clinical obligation command center
- `/cases/:caseId` evidence, workflow, actions, and audit history
- `/agent-review` model interpretation boundary
- `/intake` pathology result intake
- `/architecture` event-aligned technical architecture
- `/api/health` deployment readiness and configured runtime modes

## Run locally

```bash
npm install
npm run dev
```

Use `npm run check` before pushing. It runs the production build and TypeScript validation.

The safe deterministic demo requires no external credentials.

## Deploy to Vercel

Use this repository directly. Lovable TanStack projects deploy through Vercel's automatic framework detection.

1. Import `patricktran1/dermpathos-biopsygraph` into Vercel.
2. Keep the repository root as the project root.
3. Leave framework, build, and output settings on automatic detection.
4. Deploy with no environment variables for the first smoke test.
5. Confirm `/api/health`, `/integration-lab`, and `/judge-mode`.

The secret-free deployment runs in deterministic agent fallback mode with a mock EHR. Add the Anthropic variables below and redeploy to activate live Claude tool use.

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for the complete deployment and OpenEMR sandbox checklist.

## Environment variables

### Anthropic

```bash
ANTHROPIC_API_KEY=...
ANTHROPIC_MODEL=...
```

The model is configured through the environment so the event-approved Anthropic model can be used without a code change.

### OpenEMR reference adapter

```bash
OPENEMR_FHIR_BASE_URL=...
OPENEMR_ACCESS_TOKEN=...
OPENEMR_ALLOW_WRITES=false
```

`OPENEMR_FHIR_BASE_URL` should point directly to the configured FHIR base path. Authentication and scopes remain deployment-specific.

## Three failure modes

### Lost melanoma

The agent finds a malignant pathology result with no documented patient contact, treatment request, or completed-care evidence. It proposes urgent outreach and definitive treatment planning while keeping the obligation open.

### Wrong-site conflict

Pathology says left cheek while scheduling says right cheek. The agent blocks the workflow and requires human verification instead of guessing.

### False closure

The patient was notified and scheduled, but the appointment was canceled. The agent reopens the obligation because scheduled is not treated.

## Demo sequence

1. Open `/integration-lab`.
2. Run **Inspect without approval**.
3. Show the EHR search executing while all write tools are blocked.
4. Run **Approve bounded writes**.
5. Show the same tools returning safe EHR resources or previews.
6. Emphasize that patient communication remains a draft and closure remains unverified.
7. Open `/judge-mode` for the three clinical failure stories.
8. Close with: **A reviewed result is not closed care. Closed Care Loop keeps working until the patient receives the intended care.**

## Production pathway

1. Replace the synthetic Abridge payload with the event-provided resource or webhook schema.
2. Connect the EHR adapter to the hackathon OpenEMR instance or another available EHR.
3. Add organization-authored obligation policies and closure criteria.
4. Persist tool traces, approvals, and evidence reconciliation events.
5. Add continuous monitoring for new communication, scheduling, and procedure evidence.

Expansion workflows include abnormal labs, imaging follow-up, referrals, medication monitoring, prior authorization, and post-discharge care.

## Data and clinical disclaimer

All included patients and records are synthetic. This repository is a hackathon prototype, not a deployed medical device or a substitute for clinician judgment. Production use requires security, privacy, clinical governance, integration validation, monitoring, and organization-specific policy configuration.
