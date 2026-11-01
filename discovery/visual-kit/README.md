# SRCHN Subcategory Visual Kit

Audited against the live public category pages on 1 November 2026. Contains 172 subcategory illustration SVGs, 172 lightweight line-icon fallback SVGs, a JSON manifest, CSV index and Lucide React icon assignments.

## Live inventory

- **LIVE** — 5 subcategories
- **WORK** — 12 subcategories
- **EAT** — 18 subcategories
- **DRINK** — 15 subcategories
- **PLAY** — 20 subcategories
- **SHOP** — 20 subcategories
- **TRAVEL** — 20 subcategories
- **EVENTS** — 22 subcategories
- **MOVIES** — 20 subcategories
- **CLUBS** — 20 subcategories

**Total: 10 categories / 172 subcategories.** Names are transcribed from the current public category pages. Re-check the production database before deployment if the live inventory changes.

## Important implementation note

The `lucideReactComponent` and `lucideKebabName` fields identify the intended official Lucide icon names. Use the installed `lucide-react` package (or the project's existing Lucide integration) to render canonical Lucide icons in the UI. The files under `icons/` are matching lightweight line-art fallback assets created for this pack; they are not copied official Lucide source files. This avoids bundling third-party icon source without a pinned package version.

The files under `illustrations/` are original, lightweight decorative SVG illustrations in a consistent editorial style. They are not photographs and must not be presented as real venues. They are intended for subcategory tiles, onboarding, category navigation or empty states. Keep the supplied 10 main-category artwork, including the approved LIVE banner, unchanged.

## Integration recommendation

1. Import `manifest.json` into the frontend asset registry.
2. Render the canonical Lucide icon by `lucideReactComponent` for compact subcategory navigation.
3. Use the corresponding illustration SVG for larger subcategory cards where a richer visual is appropriate.
4. Keep individual business listings text-first as requested. Do not place these decorative illustrations on individual business records.
5. Use `categoryColors` as optional soft background tokens; preserve existing SRCHN design tokens where they conflict.
6. Use `loading="lazy"` for below-the-fold images and explicit width/height or aspect-ratio to avoid layout shift.
7. Provide accessible labels from the subcategory name; decorative illustrations can use empty alt text when adjacent text already names the subcategory.
8. Do not modify the existing logo, main category artwork, private comparison screen, or unrelated workflows.

## Suggested sizing

- Compact Lucide icon: 20–24 px.
- Subcategory card icon: 28–36 px.
- Decorative illustration: 4:3 or 3:2 container; SVG scales without raster loss.
- Mobile card: use a 1:1 crop only if the illustration remains legible.

## Sources checked

- https://srchn.in/
- https://srchn.in/live/
- https://srchn.in/work/
- https://srchn.in/eat/
- https://srchn.in/drink/
- https://srchn.in/play/
- https://srchn.in/shop/
- https://srchn.in/travel/
- https://srchn.in/events/
- https://srchn.in/movies/
- https://srchn.in/clubs/

Category inventory is sourced from the public website. The generated SVG assets are original design assets, not scraped website images.
