/**
 * Central Calendly booking-link builder for all conversation CTAs.
 *
 * The event-type slug ("brand-grenade") must match the event type configured
 * in the Brand Grenade Calendly account. If the slug changes in Calendly,
 * update CALENDLY_BOOKING_URL here — every CTA on the site reads from this constant.
 *
 * Context (which CTA/tier was clicked) travels with the booking via:
 *  - `a1` → pre-fills the first custom question on the Calendly booking form
 *  - utm_campaign / utm_source / utm_medium → tracked on the scheduled event
 */
export const CALENDLY_BOOKING_URL = "https://calendly.com/brandgrenade/brand-grenade";

export function calendlyBookingUrl(
  context: string,
  opts?: {
    name?: string;
    email?: string;
    campaign?: string;
    hideGdprBanner?: boolean;
  },
): string {
  const url = new URL(CALENDLY_BOOKING_URL);
  const campaign = (opts?.campaign ?? context)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  url.searchParams.set("utm_source", "brandgrenade-site");
  url.searchParams.set("utm_medium", "cta");
  url.searchParams.set("utm_campaign", campaign);
  url.searchParams.set("a1", context);
  if (opts?.name) url.searchParams.set("name", opts.name);
  if (opts?.email) url.searchParams.set("email", opts.email);
  if (opts?.hideGdprBanner) url.searchParams.set("hide_gdpr_banner", "1");
  return url.toString();
}

export function openCalendlyBooking(
  context: string,
  opts?: {
    name?: string;
    email?: string;
    campaign?: string;
    hideGdprBanner?: boolean;
  },
): void {
  window.open(calendlyBookingUrl(context, opts), "_blank", "noopener,noreferrer");
}
