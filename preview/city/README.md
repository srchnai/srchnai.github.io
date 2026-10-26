# SRCHN city search preview

Text-only Bangalore source discovery, October 26, 2026. Maintained source is the deployed HTML, CSS and JavaScript, not a compiled-only bundle. No build tooling or dependency install is needed. Serve the repository with any static HTTP server; open `/preview/`. Deployment is GitHub Pages from the main branch.

## Scope

The live homepage, `/club/`, `/legal/`, DNS, email, analytics and API Workers are unchanged. The previous `/preview/index.html` is retained in `previous-preview.html` for recovery; its original assets remain in `/preview/assets/`. To restore the old preview, copy that HTML to `/preview/index.html` (do not relocate it as its asset paths are absolute).

## Features and honest boundaries

- Searches 32,413 existing OSM/Overture rows locally. Does not use the older Google-derived `places-lite.json`.
- Category and neighbourhood matching, with a small explicit multilingual alias dictionary. This is not general natural-language reasoning or translation. Unmatched tokens are not silently dropped to fabricate relevance.
- Wikipedia API retrieval from the selected edition, with city-context filtering and original source links. Shows extracts verbatim, never a model-generated answer. City filtering is a heuristic, not proof that every result is useful.
- Thirteen selectable source/speech languages; completeness varies. UI copy is English. There is no claim to support every language.
- Optional, consent-gated browser speech recognition. Not an open-source implementation or guaranteed on-device; the browser may send audio to its vendor. No speech starts automatically. Recognition fills the field for review, never auto-searches. Browser voices are discovered from actual device availability. No voice cloning.
- Typed search remains usable when speech is missing, blocked or denied. Failed source calls are reported alongside independent results. No booking, payments, accounts, stored queries, location requests or generative model.
- No images/videos in results. Only the supplied SRCHN brand wordmark is displayed.

## External requests

Self-hosted place index and assets; unauthenticated GET requests to the selected `*.wikipedia.org` MediaWiki endpoint. `origin=*`, no cookies. Query and browser IP reach Wikipedia. Optional browser speech has its own vendor's processing. No Gemini or other proprietary model/API calls; no API keys, billing or worker changes.

## Data

`places.json` is generated from the existing `/od/*.json` category files, excluding `index.json`. Fields: id, name, latitude, longitude, area (source address or city), category. Original records are not edited. Dataset imported in October 2026; row-level age and present-day conditions are unknown. Counts include rows across categories; displayed matches deduplicate source IDs.

OSM data: © OpenStreetMap contributors, Open Database License (ODbL), https://www.openstreetmap.org/copyright . Overture attribution: https://docs.overturemaps.org/attribution/ . Consult upstream category files and these attribution terms for data reuse. Wikipedia excerpts: CC BY-SA; each result links to its source article and contributor history. Application license does not relicense data or brand assets.

## License

Application code in `app.js`, `style.css` and the new `/preview/index.html`: MIT. Copyright (c) 2026 SRCHN. Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files to deal in the software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies, and to permit persons to whom the software is furnished to do so, subject to inclusion of this notice. THE SOFTWARE IS PROVIDED AS IS, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY ARISING FROM USE OF THIS SOFTWARE.
