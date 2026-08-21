// Canonical pipeline checkpoint gate.
//
// Every stage that runs DOWNSTREAM of a human checkpoint MUST call
// `requireConfirmedSelection` as its first DB action. The gate re-reads the
// session row directly and throws a hard, user-visible error if the
// confirming field is NULL / empty / false. This makes silent
// auto-advancement architecturally impossible — even if a UI bug, retry path,
// or stale client state attempts to trigger the stage.
//
// One function, one source of truth. Do not duplicate this check inline.

import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type Checkpoint =
  // Phase 1
  | "A"               // checkpoint_a_confirmed → gates Stage 2
  | "B"               // checkpoint_b_confirmed → gates Stage 9
  | "C"               // checkpoint_c_confirmed + selected_smp → gates Stage 13
  // Phase 2
  | "stage17_selection" // stage_17_selected_territory → gates Stage 17B
  | "D"                  // stage_17_selected_territory → gates Stage 18 (same field, distinct checkpoint name)
  | "stage18_selection"  // stage_18_selected_detonation → gates Stage 19
  | "E"                  // alias for stage18_selection (Checkpoint E in spec)
  | "stage20_approval"   // stage_20_approved → gates Stage 21
  | "F";                 // alias for stage20_approval (Checkpoint F in spec)

type GateSpec = {
  label: string;
  columns: string[];
  // Returns the confirmed value (string) if the gate passes, or throws.
  assert: (row: Record<string, unknown>) => string;
};

function nonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

const SPECS: Record<Checkpoint, GateSpec> = {
  A: {
    label: "Checkpoint A",
    columns: ["checkpoint_a_confirmed"],
    assert: (r) => {
      if (r.checkpoint_a_confirmed !== true) {
        throw new Error(
          "Checkpoint A has not been confirmed by the user. " +
            "The pipeline cannot advance to Stage 2 until the human confirms Checkpoint A.",
        );
      }
      return "confirmed";
    },
  },
  B: {
    label: "Checkpoint B",
    columns: ["checkpoint_b_confirmed"],
    assert: (r) => {
      if (r.checkpoint_b_confirmed !== true) {
        throw new Error(
          "Checkpoint B has not been confirmed by the user. " +
            "The pipeline cannot advance to Stage 9 until the human confirms Checkpoint B.",
        );
      }
      return "confirmed";
    },
  },
  C: {
    label: "Checkpoint C",
    columns: ["checkpoint_c_confirmed", "selected_smp"],
    assert: (r) => {
      if (r.checkpoint_c_confirmed !== true) {
        throw new Error(
          "Checkpoint C has not been confirmed by the user. " +
            "The pipeline cannot advance to Stage 13 until the human confirms Checkpoint C.",
        );
      }
      if (!nonEmptyString(r.selected_smp)) {
        throw new Error(
          "Checkpoint C is marked confirmed but `selected_smp` is empty. " +
            "Stage 13 cannot run without a selected SMP.",
        );
      }
      return r.selected_smp as string;
    },
  },
  stage17_selection: {
    label: "Stage 17 selection",
    columns: ["stage_17_selected_territory"],
    assert: (r) => {
      if (!nonEmptyString(r.stage_17_selected_territory)) {
        throw new Error(
          "No Detonation Territory has been selected. " +
            "Stage 17B cannot run until the human selects a territory at Stage 17.",
        );
      }
      return r.stage_17_selected_territory as string;
    },
  },
  D: {
    label: "Checkpoint D",
    columns: ["stage_17_selected_territory"],
    assert: (r) => {
      if (!nonEmptyString(r.stage_17_selected_territory)) {
        throw new Error(
          "Checkpoint D has not been confirmed. " +
            "Stage 18 cannot run until the human confirms a Detonation Territory at Stage 17.",
        );
      }
      return r.stage_17_selected_territory as string;
    },
  },
  stage18_selection: {
    label: "Stage 18 selection",
    columns: ["stage_18_selected_detonation"],
    assert: (r) => {
      if (!nonEmptyString(r.stage_18_selected_detonation)) {
        throw new Error(
          "No Detonation has been selected. " +
            "Stage 19 cannot run until the human selects a Detonation at Stage 18.",
        );
      }
      return r.stage_18_selected_detonation as string;
    },
  },
  E: {
    label: "Checkpoint E",
    columns: ["stage_18_selected_detonation"],
    assert: (r) => {
      if (!nonEmptyString(r.stage_18_selected_detonation)) {
        throw new Error(
          "Checkpoint E has not been confirmed. " +
            "Stage 19 cannot run until the human confirms a selected Detonation at Stage 18.",
        );
      }
      return r.stage_18_selected_detonation as string;
    },
  },
  stage20_approval: {
    label: "Stage 20 approval",
    columns: ["stage_20_approved"],
    assert: (r) => {
      if (r.stage_20_approved !== true) {
        throw new Error(
          "Stage 20 (Master Detonation Brief) has not been approved by the human. " +
            "Stage 21 cannot run until Stage 20 is approved.",
        );
      }
      return "approved";
    },
  },
  F: {
    label: "Checkpoint F",
    columns: ["stage_20_approved"],
    assert: (r) => {
      if (r.stage_20_approved !== true) {
        throw new Error(
          "Checkpoint F has not been confirmed. " +
            "Stage 21 cannot run until the human approves the Stage 20 Master Detonation Brief.",
        );
      }
      return "approved";
    },
  },
};

/**
 * Hard gate. Re-reads the sessions row from the database and asserts the
 * confirming field for `checkpoint` is set. Throws a descriptive Error if
 * not — never silently returns. Returns the confirmed selection value
 * (string) for callers that want to use it without a second query.
 *
 * This MUST be the first DB action of every downstream stage runner and
 * every retry path that reaches a downstream stage.
 */
export async function requireConfirmedSelection(
  sessionId: string,
  checkpoint: Checkpoint,
): Promise<string> {
  const spec = SPECS[checkpoint];
  if (!spec) {
    throw new Error(`requireConfirmedSelection: unknown checkpoint "${checkpoint}"`);
  }

  const { data, error } = await supabaseAdmin
    .from("sessions")
    .select(spec.columns.join(", "))
    .eq("id", sessionId)
    .single();

  if (error || !data) {
    throw new Error(
      `${spec.label} gate could not verify the session (${sessionId}): ${
        error?.message ?? "no row returned"
      }`,
    );
  }

  return spec.assert(data as unknown as Record<string, unknown>);
}
