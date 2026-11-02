# Canonical place schema migration plan

Date: 2 November 2026
Status: proposed only. No production database migration has been run.

## Current state

- Public discovery reads `/discovery/data.json`.
- The current JSON has 12,973 canonical IDs: 12,955 raw OpenStreetMap records and 18 official-source starter records.
- Public verified, submitted and claimed-pending counts are zero.
- The saved-cafes pilot, Club preview, Studio preview and submission intake are separate systems and are not merged into public place identity.
- Open Data remains read-only and keeps its existing public JSON resources.

## Proposed migration

1. Freeze the current public JSON and record its SHA-256 in the release evidence.
2. Load `discovery/data.json` into a staging `places` table with one row per current `id`.
3. Load OpenStreetMap IDs into `place_source_records`, preserving original tags, retrieval notes and coordinate precision.
4. Load official starters as `editorial_starter` records with source references and evidence URLs. Do not mark them verified.
5. Populate `place_category_contexts` from the approved 10-category, 172-subcategory taxonomy. Keep multiple contexts on one canonical place only when justified.
6. Add locality IDs from the 65 current canonical locality labels and retain the 5 spelling aliases as search aliases, not extra localities.
7. Add media rows only for media with explicit rights, attribution and moderation state.
8. Keep absent facts null. Render "Not confirmed" or "Not provided"; never fill missing hours, fees, prices, phone numbers or amenities.
9. Build dedupe candidates after source IDs are loaded. Merge only approved exact or high-confidence matches; keep held-out pairs reversible.
10. Regenerate public search indexes and provenance from the migrated data, then compare category, subcategory and locality counts against the pre-migration report.
11. Roll back by restoring the frozen public JSON and previous Pages deployment if counts or routes regress.

## Data not migrated

- Simulated Studio coins, referrals, subscriptions, brand approvals and payouts.
- Club mock checkout, membership, booking or cashback data.
- Buddy audio, query text, precise location or interaction events.
- Personal contact details from paused submissions.

## Rollback trigger

Rollback is required if any public place loses provenance, a raw source record becomes presented as verified, a route/query parameter breaks, or the public search index and provenance no longer agree.
