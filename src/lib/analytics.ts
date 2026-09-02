/**
 * PostHog analytics with owner-visit exclusion.
 *
 * How self-exclusion works:
 * - Visit any page on the live site once with `?bg_owner=1` in the URL.
 *   This sets a persistent `bg_owner` flag in that browser's localStorage.
 * - Every event (pageviews, autocapture) is tagged with `is_owner: true/false`.
 * - In PostHog, filter insights with `is_owner ≠ true` (or `is_owner = false`)
 *   to see genuine outside visitor traffic only.
 * - Visit with `?bg_owner=0` to clear the flag on that browser.
 *
 * Set the flag on every device/browser you use to check the site
 * (home, work, phone). It survives IP changes, so it's more reliable
 * than IP-based exclusion.
 */

import posthog from "posthog-js";

const OWNER_KEY = "bg_owner";
let initialized = false;

function syncOwnerFlag(): boolean {
  try {
    const params = new URLSearchParams(window.location.search);
    const flag = params.get(OWNER_KEY);
    if (flag === "1") {
      window.localStorage.setItem(OWNER_KEY, "1");
    } else if (flag === "0") {
      window.localStorage.removeItem(OWNER_KEY);
    }
    return window.localStorage.getItem(OWNER_KEY) === "1";
  } catch {
    return false;
  }
}

export function initAnalytics(): void {
  if (initialized || typeof window === "undefined") return;

  const projectToken = import.meta.env.VITE_LOVABLE_CONNECTOR_POSTHOG_API_KEY;
  if (!projectToken) return; // not configured in this environment (e.g. local dev)

  const region = import.meta.env.VITE_LOVABLE_CONNECTOR_POSTHOG_REGION || "eu";
  const apiHost =
    region === "us" ? "https://us.i.posthog.com" : "https://eu.i.posthog.com";

  const isOwner = syncOwnerFlag();

  posthog.init(projectToken, {
    api_host: apiHost,
    autocapture: true,
    capture_pageview: false, // we send pageviews manually on route changes (SPA)
    capture_pageleave: true,
    person_profiles: "identified_only",
    loaded: (ph) => {
      ph.register({ is_owner: isOwner });
    },
  });

  initialized = true;
}

export function trackPageView(path: string): void {
  if (!initialized) return;
  posthog.capture("$pageview", { $current_url: window.location.href, page_path: path });
}
