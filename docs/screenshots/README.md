# Portfolio screenshots

These are the screenshots currently captured from the repository homepage.
They are downstream artifacts and must be regenerated when `homepage/` changes.

| File                   | Source                            |  Dimensions | Status                                                                     |
| ---------------------- | --------------------------------- | ----------: | -------------------------------------------------------------------------- |
| `landing-hero.png`     | `homepage/index.html` hero        |  1280 × 800 | Captured before latest homepage copy update; regenerate before publication |
| `landing-fullpage.png` | `homepage/index.html` full page   | 1280 × 4500 | Captured before latest homepage copy update; regenerate before publication |
| `landing-mobile.png`   | `homepage/index.html` mobile page |  420 × 2000 | Captured before latest homepage copy update; regenerate before publication |

## Regeneration

Serve the homepage locally and capture the listed viewports with a browser or headless Chromium:

```sh
python3 -m http.server 8000 -d homepage
```

The screenshots are presentation assets, not executable release evidence. The source HTML, SVG, and repository quality gates remain authoritative.

## Planned captures

Additional architecture, NFR, smoke-output, CLI-demo, and FAQ captures may be added later. They are not claimed as present until the corresponding PNG exists in this directory.
