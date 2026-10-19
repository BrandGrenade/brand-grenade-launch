import { describe, expect, it, vi } from "vitest";
import { checkedHubColumns } from "./client.server";
import { HUB_SYNC_MESSAGE } from "./context";
import { HubInput } from "./input";

describe("Hub-first arrival", () => {
  it("unknown arrivals never create clients and stop before run creation", async () => {
    const rpc = vi.fn(async () => ({ data: [], error: null }));
    await expect(checkedHubColumns({ rpc }, { client: "unknown", job: null, ctx: null })).rejects.toThrow(HUB_SYNC_MESSAGE);
    expect(rpc.mock.calls).toEqual([["bg_lookup_hub_client", { _hub_client_id: "unknown" }]]);
  });
  it("known clients supply database-resolved Hub tags without needing a job", async () => {
    const rpc = vi.fn(async () => ({ data: [{ client_id: "bg-id", client_name: "JLR" }], error: null }));
    expect(await checkedHubColumns({ rpc }, { client: "hub-id", job: null, ctx: "opaque" })).toEqual({ hub_client: "hub-id", hub_job: null, hub_ctx: "opaque" });
  });
  it("unlinked starts remain unchanged and do not look up a client", async () => {
    const rpc = vi.fn(); expect(await checkedHubColumns({ rpc }, null)).toEqual({}); expect(rpc).not.toHaveBeenCalled();
  });
  it("client names are not accepted as arrival fields", () => {
    const input = HubInput.parse({ client: "hub-id", job: null, ctx: null, name: "JLR" });
    expect(input).not.toHaveProperty("name");
  });
});