# OperatorOS Platform homepage

A self-contained static landing page for the OperatorOS Platform v1.0 release candidate.

## Serve locally

Open `homepage/index.html` in a browser, OR run:

```bash
cd homepage/
python3 -m http.server 8000
```

Then visit http://localhost:8000.

## Hosting

`.github/workflows/pages.yml` deploys the `homepage/` directory after an owner-authorized push to `main`. The same directory can be hosted by any static server; no build step or dependencies are required. The presence of these files does not itself prove that a public deployment is live.
