// @vitest-environment happy-dom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
const mocks = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/stimulus-manual-edit.functions", () => ({ saveManualIdeaEdit: mocks.save }));
import { ManualIdeaEdit } from "./ManualIdeaEdit";
afterEach(() => { cleanup(); vi.clearAllMocks(); });
const idea = { id: "idea", active_attempt_id: "old", direction: "Original", campaign_line: "Nobody arrived finished.", expression_under_master: "Original expression" };
it("saves exact hand-entered text against the opened version without any regeneration", async () => {
  const onSaved = vi.fn();
  render(<ManualIdeaEdit idea={idea} onSaved={onSaved} />);
  fireEvent.click(screen.getByRole("button", { name: "Edit by hand" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Description" }), { target: { value: " Exact words.\nVoice-over: Morgan Freeman. " } });
  fireEvent.change(screen.getByRole("textbox", { name: "Field 2" }), { target: { value: "The new Jaguars. The species has evolved." } });
  fireEvent.click(screen.getByRole("button", { name: "Save new version" }));
  await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
  expect(mocks.save).toHaveBeenCalledWith({ data: { directionId: "idea", expectedAttemptId: "old", description: " Exact words.\nVoice-over: Morgan Freeman. ", field1: "Nobody arrived finished.", field2: "The new Jaguars. The species has evolved." } });
});
it("cancel does not create a version", () => {
  render(<ManualIdeaEdit idea={idea} onSaved={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Edit by hand" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Field 1" }), { target: { value: "Unwanted change" } });
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(mocks.save).not.toHaveBeenCalled();
});