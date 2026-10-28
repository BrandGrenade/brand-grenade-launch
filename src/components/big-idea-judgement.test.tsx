// @vitest-environment happy-dom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
const state = vi.hoisted(() => ({ load: vi.fn(), revise: vi.fn(), triage: vi.fn(), edit: vi.fn() }));
vi.mock("@/lib/stimulus-manual-edit.functions", () => ({ saveManualIdeaEdit: state.edit }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/stimulus.functions", () => ({ loadStimulusRun: state.load, reviseStimulusDirection: state.revise, triageStimulusDirection: state.triage }));
vi.mock("@/lib/stimulus-bigidea.functions", () => ({
  startBigIdeaRun: vi.fn(), resumeBigIdeaSweep: vi.fn(), advanceBigIdeaSweep: vi.fn(),
  bigIdeaSweepProgress: async () => ({ pending: 0, running: false, hasLedger: true }),
  buildIdeaConvergenceLedger: vi.fn(), checkBigIdeaLines: vi.fn(), lockWinningIdea: vi.fn(), unlockWinningIdea: vi.fn(), retryBigIdeaLens: vi.fn(),
  listBigIdeaRuns: async () => ({ runs: [{ id: "run", generated: 2, pending: 0, total: 2, createdAt: "2026-10-24T02:24:29Z" }] }),
}));
vi.mock("@/components/StimulusGateOne", () => ({ StimulusGateOne: () => null }));
vi.mock("@/components/RawIdeaExportButton", () => ({ RawIdeaExportButton: () => null }));
import { BigIdeaSweep } from "./BigIdeaSweep";
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it("Step 2 retains kept cards and independent winner picks through repeated rewrites until explicitly killed", async () => {
  let directions = [
    { id: "idea", lens_id: "silent_proof", lens_name: "Idea Five", sort_order: 4, status: "keep", direction: "Original", campaign_line: "First line", rating_status: "unrated" },
    { id: "line", lens_id: "living_series", lens_name: "Idea Seventeen", sort_order: 16, status: "keep_in_play", direction: "Other", campaign_line: "Independent line", rating_status: "unrated" },
  ];
  state.load.mockImplementation(async () => ({ run: { winning_direction_id: null, winning_line_direction_id: null }, directions }));
  state.revise.mockImplementation(async () => { directions = directions.map(d => d.id === "idea" ? { ...d, direction: "Revised" } : d); return { ok: true }; });
  state.triage.mockImplementation(async ({ data }: { data: { directionId: string; status: string } }) => { directions = directions.map(d => d.id === data.directionId ? { ...d, status: data.status } : d); });
  render(<BigIdeaSweep sessionId="session" mode="shortlist" />);
  await screen.findByText("Idea Five");
  fireEvent.click(screen.getAllByRole("button", { name: "Choose as winning idea" })[0]);
  fireEvent.click(screen.getAllByRole("button", { name: "Choose this master line" }).at(-1) as HTMLElement);
  for (let i = 0; i < 2; i += 1) {
    fireEvent.click(screen.getAllByRole("button", { name: "Rewrite this idea" })[0]);
    fireEvent.change(screen.getByPlaceholderText("What to change — the lens stays, the idea and line get rewritten."), { target: { value: "Revise the idea" } });
    fireEvent.click(screen.getByRole("button", { name: "Rewrite through this lens" }));
    await waitFor(() => expect(state.revise).toHaveBeenCalledTimes(i + 1));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Rewrite through this lens" })).toBeNull());
    expect(screen.getByText("Idea Five")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Chosen as winning idea" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Chosen as winning line" })).toBeTruthy();
    expect(directions.map(d => d.status)).toEqual(["keep", "keep_in_play"]);
  }
  state.edit.mockImplementation(async ({ data }: { data: { description: string; field1: string; field2: string } }) => {
    directions = directions.map(d => d.id === "idea" ? { ...d, direction: data.description, campaign_line: data.field1 } : d);
  });
  fireEvent.click(screen.getAllByRole("button", { name: "Edit by hand" })[0]);
  fireEvent.change(screen.getByRole("textbox", { name: "Description" }), { target: { value: "Hand corrected" } });
  fireEvent.click(screen.getByRole("button", { name: "Save new version" }));
  await waitFor(() => expect(screen.getByText("Hand corrected")).toBeTruthy());
  expect(screen.getByRole("button", { name: "Chosen as winning idea" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Chosen as winning line" })).toBeTruthy();
  expect(directions.map(d => d.status)).toEqual(["keep", "keep_in_play"]);
  fireEvent.click(screen.getAllByRole("button", { name: "Kill this idea" })[0]);
  await waitFor(() => expect(screen.queryByText("Idea Five")).toBeNull());
  expect(state.triage).toHaveBeenCalledWith({ data: { directionId: "idea", status: "kill", instinctBrief: "" } });
});