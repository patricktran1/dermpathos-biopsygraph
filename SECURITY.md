# Security Policy

## Reporting a vulnerability

Do not open a public issue for a vulnerability that could expose credentials, patient information, private records, or unsafe clinical workflow behavior.

Report the finding privately to `patrick@trandermatology.com` with:

- affected file, route, or integration
- reproduction steps
- expected and observed behavior
- potential clinical, privacy, or operational impact
- a proposed mitigation, when available

Do not include real patient information in the report.

## High-priority findings

Please report these promptly:

- exposed Butterbase, Neo4j, RocketRide, Daytona, Cognee, or deployment credentials
- server-side secrets delivered to the browser
- unauthorized access to pathology cases or tasks
- patient or case data leaking between users
- malignant cases incorrectly downgraded or dropped
- treatment-scheduling gaps not producing a visible flag
- graph synchronization that falsely indicates follow-up completion
- injection vulnerabilities in pathology or integration inputs
- unsafe model output overriding deterministic clinical rules

## Supported version

Security fixes target the current `main` branch.

## Clinical safety

This repository is a prototype and is not authorized for unsupervised clinical use. A security fix must not weaken physician review, closed-loop documentation, or deterministic follow-up safeguards.
