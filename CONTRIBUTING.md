# Contributing to DermPathOS / BiopsyGraph

Thank you for improving the pathology follow-up safety net.

## Good contribution areas

- deterministic clinical fixtures
- pathology parser edge cases
- graph-integrity checks
- accessibility improvements
- integration error handling
- reproducible synthetic demo data
- documentation

Do not include real patient information, protected health information, credentials, private pathology reports, or clinical photographs.

## Development workflow

1. Create a focused branch from `main`.
2. Keep the change narrow enough to review safely.
3. Add or update tests for behavioral changes.
4. Run the complete validation gate.
5. Open a pull request describing the safety and workflow impact.

```bash
npm install
npm run validate
npm run test:coverage
```

## Clinical rule changes

Changes to `src/lib/derm/logic.ts`, pathology parsing, priority, due timing, malignancy handling, or task generation require:

- a representative synthetic fixture
- the previous and proposed behavior
- a clinical rationale
- explicit consideration of false reassurance and missed follow-up
- confirmation that unknown input is not silently dropped

Generative model output must not silently replace deterministic priority or follow-up rules.

## Pull request expectations

A strong pull request includes:

- the problem being solved
- the implementation approach
- tests performed
- screenshots for visible UI changes
- environment or migration impact
- safety impact
- rollback notes when behavior changes

## Scope

This project is a prototype. Contributions must not represent it as a validated medical device, production EHR, or autonomous clinical decision-maker.
