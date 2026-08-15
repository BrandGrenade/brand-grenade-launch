// BRAND GRENADE — CONSULTING DELIVERY (canonical Minto template)
// ============================================================================
// The working delivery document handed to the agency/consulting team: the
// same ten-section argument as the board recommendation, with a deeper
// appendix and the delivery-side framing in the front matter.

import { callout } from "./doc-system";
import { buildMintoDocument } from "./minto";
import { DOCUMENT_SPECS } from "./document-spec";
import { deriveMintoContent, type MintoSession } from "./minto-content";

export function buildConsultingDeliveryDocument(
  session: MintoSession,
  opts: { screen?: boolean; appendix?: "condensed" | "full" } = {},
): string {
  const derived = deriveMintoContent(session, {
    appendix: { mode: opts.appendix === "full" ? "full" : "condensed" },
    extraWhyHtml: callout(
      "What this means for delivery",
      `<p>Every downstream artefact — territory, activation architecture, channel briefs — is generated against this proposition. Work that does not carry it is out of scope.</p>`,
    ),
  });

  return buildMintoDocument({
    canonical: DOCUMENT_SPECS.consulting_delivery,
    title: `Consulting Delivery — ${derived.brand}`,
    screen: opts.screen,
    cover: {
      brand: "BRAND GRENADE",
      label: "Consulting Delivery",
      title: `${derived.brand} — Consulting Delivery`,
      subtitle: derived.category || undefined,
      confidential: true,
    },
    headlineStats: derived.headlineStats,
    content: derived.content,
    footerHtml:
      `Brand Grenade Strategy Intelligence System — Confidential. ` +
      `Consulting Delivery document for ${derived.brand}. Review before commercial deployment.`,
  });
}
