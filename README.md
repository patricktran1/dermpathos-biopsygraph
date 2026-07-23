# DermPathOS / BiopsyGraph

[![CI](https://github.com/patricktran1/dermpathos-biopsygraph/actions/workflows/ci.yml/badge.svg)](https://github.com/patricktran1/dermpathos-biopsygraph/actions/workflows/ci.yml)
[![CodeQL](https://github.com/patricktran1/dermpathos-biopsygraph/actions/workflows/codeql.yml/badge.svg)](https://github.com/patricktran1/dermpathos-biopsygraph/actions/workflows/codeql.yml)

**A closed-loop pathology follow-up safety net for dermatology.**

DermPathOS converts a biopsy result into a visible chain of required actions: diagnosis classification, patient notification, treatment planning, physician ownership, and operational follow-up. BiopsyGraph represents that chain as connected clinical and operational entities so missing steps can be surfaced before they become lost-to-follow-up events.

This repository is a hackathon prototype and engineering demonstration. It is not a medical device, an electronic health record, or a substitute for physician review.

## The problem

A pathology result is not complete merely because it exists in a chart. The workflow is only closed when the result has been reviewed, communicated, assigned, scheduled when necessary, and documented.

DermPathOS makes those dependencies explicit. Its deterministic assessment layer maps representative dermatopathology diagnoses to:

- priority
- required action
- due timing
- notification and scheduling gaps
- a graph path showing the unresolved workflow
- an operational follow-up task

## Representative clinical rules

| Diagnosis signal | Priority | Default follow-up |
|---|---|---|
| Melanoma | Urgent | Physician review and excision scheduling within 24 hours |
| Squamous cell carcinoma | High | Physician review and surgical scheduling within 72 hours |
| Basal cell carcinoma | Moderate | Mohs or excision planning within two weeks |
| Benign nevus | Routine | Patient notification within seven days |
| Other diagnosis | Routine baseline | Preserve a visible follow-up task for review |

These rules are deterministic and testable. They do not depend on generative model output.

## Architecture

```text
Case intake
   |
   v
TanStack Start application
   |
   |-- deterministic pathology assessment
   |     `-- priority, action, timing, flags, graph path
   |
   |-- Butterbase
   |     `-- case, task, notification, and optional AI-gateway records
   |
   |-- Neo4j BiopsyGraph
   |     `-- Patient -> Lesion -> Biopsy -> Result -> Diagnosis -> Action -> Task
   |
   |-- RocketRide Cloud, when configured
   |     `-- deployed follow-up workflow and task orchestration
   |
   |-- Daytona, optional
   |     `-- isolated rule-validation sandbox
   |
   `-- Cognee export
         `-- optional structured memory handoff
```

### Graph model

The relationship layer can represent entities such as:

- Patient
- Lesion
- Biopsy
- PathologyResult
- Diagnosis
- RequiredAction
- NotificationStatus
- TreatmentPlan
- Task
- Physician

The graph is designed to answer operational questions such as:

- Has the patient been notified?
- Is treatment required?
- Has treatment been scheduled?
- Is there an open task?
- Who owns the next action?

## Safety boundaries

- Clinical priority is produced by deterministic application logic.
- Malignant results with no scheduled treatment produce an explicit scheduling-gap flag.
- Benign results still require closed-loop notification documentation.
- Unknown diagnoses are not silently discarded; they retain a follow-up path.
- Secrets and sponsor integrations remain server-side.
- Human clinical review remains required.
- No real patient information should be committed to this repository or used in public demonstrations.

## Quality gates

Every pull request runs:

```bash
npm run lint
npm test
npm run test:coverage
npm run check
npm run build
```

The initial regression suite covers melanoma, SCC, BCC, benign nevi, unrecognized diagnoses, open notification gaps, treatment-scheduling gaps, and priority ordering.

CodeQL runs on pull requests, pushes to `main`, and a weekly schedule. Dependabot reviews npm and GitHub Actions maintenance.

## Local development

Requirements:

- Node.js 22
- npm

```bash
npm install
npm run dev
```

Run the complete validation gate:

```bash
npm run validate
```

Environment variables for optional integrations should be configured locally or through the deployment platform. Do not commit credentials.

## Repository map

```text
src/lib/derm/logic.ts                 deterministic case assessment
src/lib/derm/pathologyParser.ts       pathology-field extraction helpers
src/lib/derm/integrations.ts          integration orchestration
src/lib/derm/butterbase.ts            Butterbase persistence
src/routes/api/biopsygraph/           graph synchronization and verification
src/routes/api/daytona/               optional sandbox validation
src/routes/architecture.tsx           in-product architecture view
test/assess-case.test.ts              clinical regression fixtures
.github/workflows/ci.yml               validation gate
.github/workflows/codeql.yml           security analysis
```

## Contributing

Focused improvements are welcome, especially:

- additional deterministic clinical fixtures
- graph-integrity validation
- accessibility improvements
- parser edge cases
- safer integration failure handling
- documentation and reproducible demo data

Read [`CONTRIBUTING.md`](./CONTRIBUTING.md) before opening a pull request. Security-sensitive findings should follow [`SECURITY.md`](./SECURITY.md).

## Origin

Built as a physician-led hackathon prototype exploring how graph relationships and deterministic workflow rules can reduce pathology follow-up gaps in dermatology.
