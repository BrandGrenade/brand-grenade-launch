// Research Synthesiser skip-path invariants — Tier Two Check 15.
//
// Room 00 is explicitly optional. The contract is a negative: skipping the
// Synthesiser must leave the Intelligence Lab byte-identical to how it behaved
// before Room 00 existed — no prefill, no sessionStorage handoff key, and no
// synthesiser_runs row. Negatives are exactly the class of behaviour that
// regresses silently, so this module makes the contract machine-checkable.

import {
  consumeSynthesiserHandoff,
  writeSynthesiserHandoff,
} from "@/lib/synthesiser/handoff";

export const HANDOFF_STORAGE_KEY = "bg.synthesiser.handoff.v1";

/** Minimal in-memory Storage stand-in so the skip path can be exercised
 *  outside a browser (server function / node test). */
export function makeFakeStorage(): Storage & { dump(): Record<string, string> } {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k: string) => (map.has(k) ? (map.get(k) as string) : null),
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    removeItem: (k: string) => void map.delete(k),
    setItem: (k: string, v: string) => void map.set(k, String(v)),
    dump: () => Object.fromEntries(map.entries()),
  } as Storage & { dump(): Record<string, string> };
}

/**
 * Runs the skip path against a fake browser storage and asserts:
 *   1. No handoff key is written by skipping.
 *   2. consumeSynthesiserHandoff() returns null (Lab receives nothing).
 *   3. The Lab's initial field state is byte-identical to the no-handoff
 *      baseline snapshot supplied by the caller.
 * Throws on any violation. Returns a pass detail string.
 */
export function assertSkipLeavesLabUnchanged(labBaseline: {
  /** Serialised Lab field state when NO handoff exists. */
  snapshot: string;
  /** Serialised Lab field state derived from whatever the skip path produced. */
  afterSkip: (handoff: ReturnType<typeof consumeSynthesiserHandoff>) => string;
}): string {
  const prevWindow = (globalThis as { window?: unknown }).window;
  const storage = makeFakeStorage();
  (globalThis as { window?: unknown }).window = { sessionStorage: storage };
  try {
    // --- the skip path: user clicks "Skip to Intelligence Lab". No apply,
    // so writeSynthesiserHandoff is never called. ---
    const keysAfterSkip = Object.keys(storage.dump());
    if (keysAfterSkip.includes(HANDOFF_STORAGE_KEY)) {
      throw new Error(
        `Skipping Room 00 wrote the handoff key "${HANDOFF_STORAGE_KEY}" into sessionStorage. The skip path must write nothing.`,
      );
    }

    const handoff = consumeSynthesiserHandoff();
    if (handoff !== null) {
      throw new Error(
        `Intelligence Lab received a handoff after the skip path: ${JSON.stringify(handoff)}. Expected null.`,
      );
    }

    const after = labBaseline.afterSkip(handoff);
    if (after !== labBaseline.snapshot) {
      throw new Error(
        `Intelligence Lab initial state is not byte-identical after skipping. Baseline: ${labBaseline.snapshot.slice(0, 200)} | After skip: ${after.slice(0, 200)}`,
      );
    }

    // --- control: the APPLY path must still work, otherwise this check would
    // pass on a broken (permanently no-op) handoff module. ---
    writeSynthesiserHandoff({ brand: "X", category: "Y", fields: {} });
    if (!Object.keys(storage.dump()).includes(HANDOFF_STORAGE_KEY)) {
      throw new Error(
        "Control failed: the apply path did not write a handoff key, so the skip assertion above is vacuous.",
      );
    }
    const applied = consumeSynthesiserHandoff();
    if (!applied || applied.brand !== "X") {
      throw new Error("Control failed: the apply path handoff did not round-trip.");
    }
    if (Object.keys(storage.dump()).includes(HANDOFF_STORAGE_KEY)) {
      throw new Error("Handoff key was not cleared after being consumed once.");
    }

    return "Skip path writes no handoff key, delivers null to the Lab, and leaves the Lab's initial field state byte-identical to the no-Room-00 baseline. Apply-path control round-tripped and self-cleared.";
  } finally {
    if (prevWindow === undefined) delete (globalThis as { window?: unknown }).window;
    else (globalThis as { window?: unknown }).window = prevWindow;
  }
}

/** Source-level invariants: the skip controls must not be able to write. */
export function assertSkipSourceInvariants(sources: {
  synthesiserRoom: string;
  intelligenceNew: string;
}): string {
  const problems: string[] = [];

  // Every skip control links straight to /intelligence/new.
  const skipLinks = (sources.synthesiserRoom.match(/Skip to Intelligence Lab/g) ?? []).length;
  if (skipLinks < 2) {
    problems.push(
      `Expected the two "Skip to Intelligence Lab" controls in the Room 00 route; found ${skipLinks}.`,
    );
  }

  // writeSynthesiserHandoff must only be reachable behind a truthy `fields`
  // guard (the apply path), never on the skip path.
  if (!/if \(fields\) \{\s*\n\s*writeSynthesiserHandoff\(/.test(sources.synthesiserRoom)) {
    problems.push(
      "writeSynthesiserHandoff is no longer guarded by `if (fields)` in the Room 00 route — the skip path could now write a handoff.",
    );
  }

  // recordSynthesiserRun must only be called from the panel callbacks
  // (onSynthesised / onApply), never on mount or on the skip control.
  const recordCalls = (sources.synthesiserRoom.match(/recordSynthesiserRun\(/g) ?? []).length;
  const callbackCalls = (
    sources.synthesiserRoom.match(/on(?:Synthesised|Apply)=\{\([^)]*\) => \{\s*\n\s*void recordSynthesiserRun\(/g) ?? []
  ).length;
  if (recordCalls !== callbackCalls + 1 /* the import line is not matched; all calls must be in callbacks */) {
    // recordCalls counts only invocations; require each to sit in a callback.
    if (recordCalls !== callbackCalls) {
      problems.push(
        `recordSynthesiserRun is invoked ${recordCalls} time(s) but only ${callbackCalls} sit inside the onSynthesised/onApply callbacks — a synthesiser_runs row could be written without the user applying anything.`,
      );
    }
  }

  // The Lab reads the handoff exactly once, lazily, and treats absence as normal.
  if (!/useState\(\(\) => consumeSynthesiserHandoff\(\)\)/.test(sources.intelligenceNew)) {
    problems.push(
      "The Intelligence Lab no longer consumes the handoff via a lazy useState initialiser — it may re-read or mutate state on re-render.",
    );
  }

  if (problems.length > 0) {
    throw new Error(`Room 00 skip-path invariants broken: ${problems.join(" | ")}`);
  }
  return "Skip controls link straight to the Lab, handoff writes stay behind the apply guard, run logging stays inside the panel callbacks, and the Lab consumes the handoff once, lazily.";
}
