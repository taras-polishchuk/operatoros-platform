# README badges

The README uses only badges whose meaning is valid before GitHub publication.

```markdown
[![Release candidate](https://img.shields.io/badge/release%20candidate-local%20validation-informational)](docs/RELEASE-PROCESS.md)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Coverage gates](https://img.shields.io/badge/coverage%20gates-80%2F80%2F80%2F70-informational)](artifacts/release-candidates/v1.0/QUALITY-GATE.md)
```

## Meaning

- **Release candidate:** the current working tree has passed local release validation; it is not a GitHub release or tag.
- **License:** the repository contains the canonical MIT license text.
- **Coverage gates:** enforced minimum thresholds for lines/functions/statements/branches, not the latest measured values. Current measured coverage is recorded in the v1.0 quality-gate evidence.

After a public GitHub repository and immutable tag exist, a real CI badge and tagged-release badge may replace the release-candidate badge.
