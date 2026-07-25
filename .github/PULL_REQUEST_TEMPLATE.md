## Description

<!-- What does this PR do, and why? Link the relevant issue, ADR, or authority
document. Keep it short and operator-focused. -->

## Type of Change

<!-- Place an `x` in the box that applies; delete the rest. -->

- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds capability)
- [ ] Breaking change (fix or feature that would cause existing functionality to change)
- [ ] Documentation update
- [ ] Refactor (no functional change)
- [ ] Performance improvement
- [ ] Test addition or fix
- [ ] CI / tooling change

## How Has This Been Tested?

<!-- Describe the tests you ran and the environment. List exact commands. -->

- Commands run:
  -
- Results:
  - `pnpm format:check` — pass / fail
  - `pnpm lint` — pass / fail
  - `pnpm typecheck` — pass / fail
  - `pnpm test:coverage` — N tests / N passed; coverage %
  - `pnpm build` — pass / fail
  - `pnpm contracts:verify` — pass / fail
  - `pnpm architecture:check` — pass / fail

## Checklist

<!-- Go through each item; mark completed items with `[x]`. -->

- [ ] My code follows the style guidelines of this project (`pnpm format` /
      `pnpm lint` clean)
- [ ] I have performed a self-review of my own code
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] I have made corresponding changes to the documentation
- [ ] My changes generate no new warnings
- [ ] I have added tests that prove my fix is effective or that my feature works
- [ ] The architecture SHA-256 (`1e79049d9ae5a328556378ff8235525cd0f692bfa317fd7da6dc2bcdb1f27610`) is unchanged
- [ ] `authority-lock.json` has been verified (`pnpm contracts:verify`)
- [ ] `CHANGELOG.md` has been updated (Unreleased section) for any user-visible change
