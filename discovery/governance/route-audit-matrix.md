# Route audit matrix

Date: 2 November 2026
Baseline evidence: `/downloads/srchn-master-redesign-route-audit-baseline.json` and `.md`.

The live pre-change audit checked 289 routes and deep links: 30 main routes, 23 Open Data routes, 65 locality routes and 172 category/subcategory discovery deep links. All returned HTTP 200. The local internal-link check covered 312 unique non-asset paths and found zero unresolved links. The live discovery JSON matched the local repository byte-for-byte.

| Area | Current status | Existing behaviour | Planned change | Risk | Baseline test |
|---|---|---|---|---|---|
| `/` | Working | Approved monochrome editorial homepage, 10 category cards, locality/plan/Buddy/claim paths | Preserve routes and approved copy; keep natural-colour licensed hero media | Stale media rights or overstated claims | 200 |
| 10 category routes | Working | 172 static subcategory cards with map and starter counts separated | Keep exact taxonomy and links; reconcile source mapping publicly | Count drift between page, JSON and source | 10/10 routes 200; 172/172 cards exact |
| `/discovery/` | Working | Search, filters, local save, optional location, opt-in OSM map, pagination, source notes | Add clearer record-status labels and governance links | JS regressions; map/privacy regression | 200 |
| `/discovery/place/?id=...` | Working | Source detail, save/share, directions and report links | Add explicit status label and preserve actions | Place-ID regressions | 200 sample plus all data IDs unique |
| `/localities/` and 65 locality pages | Working | Source-labelled locality directory and locality-filter links | Preserve labels and aliases; no invented stats | Boundary implication | 65/65 routes 200 |
| `/discovery/profile/` | Working pilot | Signed-in pilot saved cafes, separate from local Plan saves | Preserve separation and explanation | Account/privacy regression | 200 |
| `/plan/` | Working | Browser-local plan from saved places | Preserve local-only explanation | Persistence confusion | 200 |
| `/studio/` | Preview working | Local photo-to-video and simulated economics labelled | Preserve DEMO/PROPOSED labels and local media flow | Simulated value mistaken as live | 200 |
| `/club/` | Preview working | Free membership, eKYC/booking/cashback mockups | Keep non-live labels; apply monochrome brand overrides | Mock state mistaken as live | 200 |
| `/bangalore/` | Working preview route | Source-led Buddy, consent and experimental voice labels | Keep consent, transcript review and privacy controls | Voice/privacy regression | 200 |
| Claim/suggest | Working state | Claim by manual email; submissions paused | Preserve paused/manual states | Fake submission or verification | 200 |
| About/Privacy/Legal/Credits/Contact | Reachable | Existing product/legal content and credits | Apply monochrome UI where stale; preserve disclosures | Content loss or wrong legal claims | 200 |
| `/collections/` | Working empty state | No published collections | Keep honest empty state | Fake editorial | 200 |
| `/discovery/coverage/` | Working | 172-row coverage report | Add submitted/claimed/verified separation and governance links | Count drift | 200 |
| `/open/` | Working | 21 OSM-derived lists, alcohol data withheld | Keep read-only data and add source-mapping transparency | Licence/provenance drift | 23/23 routes 200 |

## Backend dependencies and unavailable endpoints

- No production canonical place database exists yet; the schema and migration plan are proposals.
- Editorial import, merge, translation and audio-approval workflow remains unavailable.
- Claim verification and business tooling are manual/not live.
- Place submissions are paused and nothing is stored.
- Studio commercial economics are simulated.
- Club eKYC, booking, payment and cashback are not live.
- Buddy native-language AI/voices are experimental; only English Talk was previously tested.
