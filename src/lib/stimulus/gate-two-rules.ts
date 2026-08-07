// Gate Two admission rules, kept out of the server-function file so they can be
// executed and proven directly rather than only through an authenticated RPC.

export interface GateTwoPromptRow {
  channel_name?: string | null;
  gate_two_approved?: boolean | null;
  mandate_compliance?: string | null;
}

/**
 * Returns an error message when the set may not be confirmed, or null when it
 * may. A mandate is binding: if the compliance check found the mandated element
 * absent from a channel, no amount of human sign-off unblocks the set.
 */
export function gateTwoBlockReason(active: GateTwoPromptRow[], approvedCount: number): string | null {
  if (approvedCount === 0) return "Sign off at least one prompt before confirming Gate Two.";

  const nonCompliant = active.filter((p) => p.mandate_compliance === "absent");
  if (nonCompliant.length > 0)
    return `The mandated element is ABSENT from ${nonCompliant.length} channel(s): ${nonCompliant
      .map((p) => p.channel_name ?? "unnamed")
      .join(", ")}. Re-apply the mandate or amend those prompts before confirming Gate Two.`;

  const outstanding = active.filter((p) => !p.gate_two_approved);
  if (outstanding.length > 0)
    return `${outstanding.length} prompt(s) still awaiting a Gate Two decision — approve, send back, or reject each one first.`;

  return null;
}
