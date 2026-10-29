import { expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { rpc: vi.fn() } }));
vi.mock("@/lib/auth-helpers.server", () => ({ assertSessionAccess: vi.fn() }));
vi.mock("@/lib/background.server", () => ({ scheduleBackground: vi.fn() }));
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { claimPrompt } from "./orchestration-core.server";
it("two simultaneous copy attempts invoke the exclusive lease RPC and only one claims work", async () => {
  let held = false;
  vi.mocked(supabaseAdmin.rpc).mockImplementation(async () => {
    const claimed = !held; held = true;
    return { data: claimed, error: null } as never;
  });
  const claims = await Promise.all([claimPrompt({ id:"p",channel_name:"Podcast",copy_guard:true }),claimPrompt({ id:"p",channel_name:"Podcast",copy_guard:true })]);
  expect(claims.filter(Boolean)).toHaveLength(1);
  expect(supabaseAdmin.rpc).toHaveBeenCalledTimes(2);
  expect(vi.mocked(supabaseAdmin.rpc).mock.calls[0][0]).toBe("bg_claim_creative_prompt");
});