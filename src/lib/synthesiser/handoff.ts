// Handoff between Room 00 (Research Synthesiser) and Room 01 (Intelligence Lab).
//
// The Synthesiser is optional and skippable, so the handoff is deliberately
// ephemeral: it lives in sessionStorage, is read exactly once by
// /intelligence/new, and is cleared immediately after. Skipping the room
// leaves no handoff at all, so the Intelligence Lab form behaves exactly as it
// did before this room existed.

import type { SynthesiserCategory } from "./types";

const KEY = "bg.synthesiser.handoff.v1";

export interface SynthesiserHandoff {
  brand: string;
  category: string;
  fields: Partial<Record<SynthesiserCategory, string>>;
}

export function writeSynthesiserHandoff(payload: SynthesiserHandoff): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    /* storage unavailable — the Lab still works, just without prefill */
  }
}

/** Reads and clears the handoff. Returns null when the room was skipped. */
export function consumeSynthesiserHandoff(): SynthesiserHandoff | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    window.sessionStorage.removeItem(KEY);
    const parsed = JSON.parse(raw) as SynthesiserHandoff;
    if (!parsed || typeof parsed !== "object") return null;
    return {
      brand: typeof parsed.brand === "string" ? parsed.brand : "",
      category: typeof parsed.category === "string" ? parsed.category : "",
      fields: parsed.fields ?? {},
    };
  } catch {
    return null;
  }
}

export function clearSynthesiserHandoff(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
}
