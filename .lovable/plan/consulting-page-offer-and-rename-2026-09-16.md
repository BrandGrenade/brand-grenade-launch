# Consulting page offer and rename

## Changes
- Rename the page route from `/done-for-you` to `/consulting` and update its route declaration.
- Keep `/done-for-you` as a permanent redirect to `/consulting` so existing links continue to work.
- Update the homepage navigation label and destination from “Done-For-You” to “Consulting”.
- Add self-referencing canonical and Open Graph URL metadata for `/consulting`; retain the existing Consulting title and description wording.
- Promote the full-run offer into a high-contrast headline callout directly below the opening hero copy.
- Repeat the same prominent offer above the three pricing tiers, while retaining each tier’s $4,000 price and removing the buried Tier 3 footnote treatment.

## Verification
- Search the current source for every remaining “Done-For-You”, “Done For You”, and `/done-for-you` reference; only the intentional legacy redirect may remain.
- Verify `/consulting` renders with the correct title, metadata, two prominent full-run offers, three $4,000 tier prices, and exact $10,000/$12,000/$2,000 figures.
- Verify `/done-for-you` redirects to `/consulting` and internal navigation points directly to the new route.
- Check desktop and mobile layouts, then run the relevant tests and type check.

## Publishing
- Do not publish automatically. The live public URL will receive the rename and metadata changes only after the next publish.
