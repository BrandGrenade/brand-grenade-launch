# Fix Document 00A PDF layout

## Goal
Correct the shared Document 00A print template, then regenerate and visually verify Nissan revision 2.

## Changes
- Restore a consistent printable top margin whenever content continues onto a new page.
- Balance the recommendation summary by separating the long first-mover explanation from the two short numeric call-outs.
- Give the White Space Assessment a document-specific column layout based on its content, allow long rows to flow naturally, and prevent isolated short validation tables.
- Keep the changes scoped to Document 00A where possible so unrelated deliverables retain their current layout.

## Verification
- Generate Nissan Document 00A revision 2 from the current stored report and genuine reconciliation run reference.
- Render the resulting PDF to page images and inspect every page.
- Confirm consistent top margins, balanced recommendation modules, a compact/scannable White Space table, and no mostly-empty validation-summary page.
- Run the relevant document tests and print-layout audit.

## Deliverable
Provide the actual visually verified Nissan revision 2 PDF.
