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

export function calendlyBookingUrl(context: string): string {
  const url = new URL(CALENDLY_BOOKING_URL);
  const campaign = context
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  url.searchParams.set("utm_source", "brandgrenade-site");
  url.searchParams.set("utm_medium", "cta");
  url.searchParams.set("utm_campaign", campaign);
  url.searchParams.set("a1", context);
  return url.toString();
}

export function openCalendlyBooking(context: string): void {
  window.open(calendlyBookingUrl(context), "_blank", "noopener,noreferrer");
}
