# Deduplication and quality rules

Date: 2 November 2026

## Identity order

1. Match stable source IDs first.
2. Then compare normalized names, address, phone/domain where lawfully available, distance and locality.
3. Hold ambiguous pairs for editorial review. Do not auto-merge merely because names are similar or points are close.
4. Keep every source reference on the canonical place.
5. Keep merge and split actions reversible with audit history.

## Current rules

- The published Open Data list used an 80 m same-name merge for the 27-28 October OSM snapshot. That is a dataset rule, not universal business truth.
- The expanded discovery dataset preserved multiple category labels when duplicate source IDs appeared in more than one source category.
- Seventeen nearby same-name shop features from the 30 October expansion and seven nearby same-name features from the 1 November expansion remain held out pending duplicate review.
- Unique source IDs do not prove distinct business entities.

## Separate identities

Keep these separate unless a human review approves a merge:

- branches of chains;
- malls and tenant businesses;
- multi-tenant buildings and individual businesses;
- campuses and facilities inside them;
- venues and dated events held at those venues;
- clubs, community spaces and nightlife venues;
- screen formats such as IMAX/4DX/Dolby and the physical cinema.

## Boundary and locality quality

- Validate against the current Bengaluru pincode/source polygon.
- Flag uncertain boundary assignment instead of silently assigning a locality.
- Preserve the 65 canonical locality labels and 5 spelling aliases.
- Do not invent neighbourhood boundaries, popularity ranks or stats.

## Public display quality

- Show "Source record", "Official starter", "Claimed by owner" or "Verified by SRCHN" only when the stored status supports it.
- Show zero counts and truthful empty states.
- Do not hide unmapped, rejected, duplicate, missing-coordinate or outside-boundary records in the reconciliation report.
- Never present raw map records as verified, current, open, bookable or owner-approved.
