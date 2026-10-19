// @vitest-environment happy-dom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
const state = vi.hoisted(() => ({ known: false, admin: true, calls: [] as string[], attached: [] as unknown[], project: null as string | null }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@tanstack/react-router", () => ({ useRouterState: ({ select }: { select: (s: unknown) => unknown }) => select({ location: { href: "/brief/?client=hub-jlr", pathname: "/brief/" } }) }));
vi.mock("@/context/AuthContext", () => ({ useAuth: () => ({ user: { id: "user" }, isAuthReady: true }) }));
vi.mock("@/lib/demo-mode", () => ({ useIsAdmin: () => state.admin }));
vi.mock("@/lib/hub.functions", () => ({ lookupHubClient: async () => { state.calls.push("lookup"); return state.known ? { name: "JLR", clientId: "client-id" } : null; } }));
vi.mock("@/lib/bg-clients.functions", () => ({
  getClientOptions: async () => [{ client_id: "client-id", client_name: "JLR" }],
  getProjectClient: async () => ({ clientId: state.project }),
  attachProjectClient: async (args: unknown) => { state.attached.push(args); },
}));
vi.mock("@/components/ui/select", () => ({
  Select: ({ children, onValueChange }: { children: React.ReactNode; onValueChange: (s: string) => void }) => <div onClick={() => onValueChange("client-id")}>{children}</div>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: () => null, SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
}));
import { HubClientProvider, HubArrivalGate } from "./HubClientProvider";
import { ProjectClient } from "./ProjectClient";
beforeEach(() => { state.known = false; state.admin = true; state.calls = []; state.attached = []; state.project = null; window.history.replaceState(null, "", "/brief/?client=hub-jlr"); sessionStorage.clear(); });
afterEach(cleanup);
describe("shared client interactions", () => {
  it("unknown arrival blocks starting; Retry only looks up and releases the start after sync", async () => {
    render(<HubClientProvider><HubArrivalGate><button>Start run</button></HubArrivalGate></HubClientProvider>);
    await screen.findByText("This client is still syncing from the Hub — try again");
    expect(screen.queryByText("Start run")).toBeNull();
    expect(state.calls).toEqual(["lookup"]);
    state.known = true; fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await screen.findByRole("button", { name: "Start run" });
    expect(state.calls).toEqual(["lookup", "lookup"]);
    expect(new URL(window.location.href).searchParams.has("name")).toBe(false);
  });
  it("admin selects a client for the exact legacy project once", async () => {
    render(<ProjectClient table="sessions" id="legacy-id" />);
    fireEvent.click(await screen.findByRole("button", { name: "JLR" }));
    await waitFor(() => expect(state.attached).toEqual([{ data: { table: "sessions", runId: "legacy-id", clientId: "client-id" } }]));
    await waitFor(() => expect(screen.queryByRole("button", { name: "JLR" })).toBeNull());
  });
  it("partners have no client attachment controls", () => {
    state.admin = false; const { container } = render(<ProjectClient table="sessions" id="legacy-id" />);
    expect(container.innerHTML).toBe(""); expect(state.attached).toEqual([]);
  });
});