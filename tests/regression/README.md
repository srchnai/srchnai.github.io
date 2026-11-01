# SRCHN regression checks

These scripts are read-only production checks. They do not submit forms, create records, send email, sign in, mutate data or call paid services.

Run from a machine with Python 3 and, for browser checks, Chrome/Chromium plus the Python `websocket-client` package:

```bash
python3 tests/regression/security_api_smoke.py
python3 tests/regression/route_inventory_audit.py
python3 tests/regression/browser_matrix_audit.py
python3 tests/regression/focused_functional_audit.py
python3 tests/regression/accessibility_audit.py
```

What they cover:

- `security_api_smoke.py`: key static routes, unauthenticated API responses, hostile-origin POST rejection and current security headers.
- `route_inventory_audit.py`: production page/asset status, metadata and image-alt checks generated from source routes, sitemap URLs, discovery subcategories and internal links.
- `browser_matrix_audit.py`: responsive rendering, horizontal overflow, JavaScript exceptions, failed images and network failures across key routes and widths.
- `focused_functional_audit.py`: Studio local rendering, Club preview disclosures, claim-place honesty, request/submit-place disabled-state behavior, plan/profile local-data disclosure, legal routes and privacy coverage.
- `accessibility_audit.py`: WCAG 2A/2AA axe checks across key routes.

Expected current limitation: browser checks on the Buddy routes may report one blocked `static.cloudflareinsights.com` request because the existing Buddy CSP does not allow Cloudflare Web Analytics. The place-detail heading is loaded asynchronously; browser checks must wait for content, not only `document.readyState`.
