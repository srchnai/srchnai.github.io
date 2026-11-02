# Cloudflare deployment and rollback

## Preview deployment

1. Build or validate the static public site from the public repository.
2. Deploy the public site to the existing Cloudflare Pages preview project with a unique branch/deployment name.
3. Deploy the separate Buddy preview directory only to a preview URL.
4. Test the preview URLs directly. Do not update the production Worker `HOME` or `GUIDE` origins until the owner explicitly says "make it live" for that site.

## Production release gate

Production release requires all of these:

- owner's explicit "make it live" for the specific site;
- preview URL, commit hash and worker version recorded;
- route/deep-link QA passed on preview;
- screenshots for mobile, tablet and desktop;
- current production data hash and preview data hash compared;
- rollback target recorded before changing Worker origins;
- mail DNS records untouched;
- no new paid API, key, subscription or service.

## Production switch

1. Keep the current Worker version ID as rollback target.
2. Update only the allowed Worker origin constants to the approved Pages preview URL.
3. Deploy the Worker with the existing approved deploy path.
4. Read production routes back and record status, content markers and Worker version.
5. Test homepage, one category, discovery, one locality, Plan, Studio, Club and Buddy.

## Rollback

1. Restore the previous Worker origin constants and redeploy the recorded Worker version.
2. If Pages content regressed, redeploy the previous Pages deployment from Cloudflare's deployment history.
3. Verify `/`, `/discovery/`, `/discovery/data.json`, `/localities/`, `/club/` and `/bangalore/` return the previous content markers.
4. Report the restored version IDs and any data that remained cached.

## Do not touch

- Mail DNS records.
- Cloudflare account billing.
- New paid APIs or keys.
- Production submission, claim, Club payment, booking or eKYC backends without separate approval and tests.
