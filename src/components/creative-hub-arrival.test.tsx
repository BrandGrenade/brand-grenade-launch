// @vitest-environment happy-dom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
const state = vi.hoisted(() => ({ filters: [] as unknown[][] }));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => options,
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));
vi.mock("@/components/TopNav", () => ({ TopNav: () => null }));
vi.mock("@/components/HubClientProvider", () => ({ useHubClient: () => ({ hub: { client: "hub-jlr" }, name: "JLR", clientId: "jlr-id" }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  from: (table: string) => ({ select: () => {
    if (table === "stimulus_runs") return Promise.resolve({ data: [] });
    const q = { order: () => q, eq: (...args: unknown[]) => { state.filters.push(args); return q; }, limit: async () => ({ data: [{ id: "jlr-strategy", brand_name: "JLR", updated_at: null, stage_21_outputs: null }] }) };
    return q;
  } }),
} }));
import { Route } from "@/routes/creative.index";
afterEach(() => { cleanup(); state.filters = []; });
it("Creative queries only the mapped JLR client and preselects its strategy source", async () => {
  const Component = (Route as unknown as { component: React.ComponentType }).component;
  render(<Component />);
  await waitFor(() => expect(state.filters).toEqual([["bg_client_id", "jlr-id"]]));
  const source = await screen.findByRole("combobox", { name: "Project" }) as HTMLSelectElement;
  expect(source.value).toBe("jlr-strategy");
  expect((screen.getByRole("textbox", { name: "Client" }) as HTMLInputElement).value).toBe("JLR");
});