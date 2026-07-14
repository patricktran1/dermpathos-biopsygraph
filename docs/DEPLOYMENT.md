# Deploy Closed Care Loop to Vercel

The existing repository is the deployment source. Do not create a duplicate repository.

## Fast public demo

1. Sign in to Vercel with GitHub.
2. Choose **Add New → Project**.
3. Import `patricktran1/dermpathos-biopsygraph`.
4. Keep the root directory at the repository root.
5. Leave framework, build, and output settings on automatic detection.
6. Deploy without environment variables.

The first deployment runs safely in:

- deterministic agent fallback mode
- mock EHR mode
- EHR writes disabled

This mode is sufficient to test the landing page, Judge Mode, clinical obligation dashboard, Claude Review fallback, Integration Lab, and server routes.

## Confirm the deployment

Open these routes after Vercel finishes:

- `/` product landing page
- `/judge-mode` guided three-minute demo
- `/integration-lab` Abridge → Anthropic → EHR workflow trace
- `/api/health` deployment and configuration status

The health response must report `ok: true`.

## Enable live Anthropic tool use

In **Vercel → Project → Settings → Environment Variables**, add:

```text
ANTHROPIC_API_KEY=<event or personal API key>
ANTHROPIC_MODEL=<approved Claude model identifier>
```

Apply the values to Preview and Production, then redeploy. `/api/health` should change `agentMode` from `deterministic_fallback` to `claude_tool_use`.

Do not commit keys to GitHub.

## Optional OpenEMR sandbox

Add these only when a reachable OpenEMR FHIR sandbox is available:

```text
OPENEMR_FHIR_BASE_URL=<FHIR base URL>
OPENEMR_ACCESS_TOKEN=<sandbox OAuth access token>
OPENEMR_ALLOW_WRITES=false
```

With the first two variables present, `/api/health` reports `ehrMode: openemr_fhir`. Keep writes disabled while validating reads and generated resource previews.

Enable actual sandbox writes only after testing:

```text
OPENEMR_ALLOW_WRITES=true
```

The application still requires explicit approval for each write tool. This flag does not bypass the approval boundary.

## Deployment policy

- Production branch: `main`
- Preview deployments: pull-request branches
- Never use real protected health information in this hackathon deployment
- Keep patient communication in draft status
- Keep OpenEMR writes disabled unless using a dedicated synthetic sandbox
- Test `/api/health`, `/judge-mode`, and `/integration-lab` after every major deployment
