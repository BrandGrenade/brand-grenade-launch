// Run register Documents-link rules.
//
// A run gets its Documents link as soon as ANY deliverable exists — not only
// when Stage 22 or Stage 16 consulting completed. Regression: the JLR run
// (Stage 15 done, Phase 2 through Stage 21, no Stage 16/22) showed
// "No documents yet" on the dashboard even though the Deliverables page
// listed its documents.

import { describe, expect, it } from "vitest";
import { sessionHasDeliverables, toRegisterRuns } from "./run-register";

const baseSession = {
  id: "sess-1",
  brand_name: "JLR",
  status: "running",
  created_at: "2026-10-20T00:00:00Z",
  current_stage: 15,
  bg_client_id: null,
  engagement_id: null,
  brief_type: "campaign",
  run_mode: "full",
  archived_at: null,
};

const empty = { sessions: [], workspaces: [], intelligence: [], synthesiser: [], stimulus: [] };

describe("sessionHasDeliverables", () => {
  it("is false when no document-bearing stage exists", () => {
    expect(sessionHasDeliverables({ ...baseSession })).toBe(false);
  });

  it.each([
    "has_stage_15",
    "has_stage_16",
    "has_stage_16_consulting",
    "has_stage_17",
    "has_stage_17b",
    "has_stage_18",
    "has_stage_19",
    "has_stage_20",
    "has_stage_20b",
    "has_stage_21",
    "has_stage_22",
  ])("is true when %s exists", (flag) => {
    expect(sessionHasDeliverables({ ...baseSession, [flag]: true })).toBe(true);
  });
});

describe("toRegisterRuns documents links", () => {
  it("links a JLR-like run (Stage 15 + Phase 2, no Stage 16/22) to its Deliverables page", () => {
    const runs = toRegisterRuns({
      ...empty,
      sessions: [{ ...baseSession, has_stage_15: true, has_stage_20b: true, has_stage_21: true }],
    });
    expect(runs).toHaveLength(1);
    expect(runs[0].documentsHref).toBe("/complete?session=sess-1");
  });

  it("leaves a run with no deliverables without a Documents link", () => {
    const runs = toRegisterRuns({ ...empty, sessions: [{ ...baseSession }] });
    expect(runs[0].documentsHref).toBeNull();
  });

  it("links a Creative Stimulus run with saved directions to the parent session's Deliverables page", () => {
    const runs = toRegisterRuns(
      {
        ...empty,
        stimulus: [
          {
            id: "stim-1",
            session_id: "sess-1",
            status: "idea_locked",
            run_mode: "big_idea",
            created_at: "2026-10-24T02:24:29Z",
            bg_client_id: null,
            engagement_id: null,
            archived_at: null,
          },
        ],
      },
      new Set(["stim-1"]),
    );
    expect(runs[0].documentsHref).toBe("/complete?session=sess-1");
  });

  it("leaves a Creative Stimulus run with no saved directions without a Documents link", () => {
    const runs = toRegisterRuns(
      {
        ...empty,
        stimulus: [
          {
            id: "stim-2",
            session_id: "sess-1",
            status: "generating",
            run_mode: "big_idea",
            created_at: "2026-10-24T02:24:29Z",
            bg_client_id: null,
            engagement_id: null,
            archived_at: null,
          },
        ],
      },
      new Set(),
    );
    expect(runs[0].documentsHref).toBeNull();
  });
});
