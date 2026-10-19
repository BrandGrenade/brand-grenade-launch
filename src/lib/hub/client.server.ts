import { HUB_SYNC_MESSAGE, type HubContext } from "./context";

/** Read-only guard before insertion; never creates a client from an arrival. */
export async function checkedHubColumns(sb: any, hub: HubContext | null | undefined) {
  if (!hub) return {};
  const { data, error } = await sb.rpc("bg_lookup_hub_client", { _hub_client_id: hub.client });
  if (error) throw new Error("Client lookup unavailable — try again in a moment");
  if (!data?.[0]) throw new Error(HUB_SYNC_MESSAGE);
  return { hub_client: hub.client, hub_job: hub.job, hub_ctx: hub.ctx };
}