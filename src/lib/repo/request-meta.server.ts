/**
 * Request metadata helper for repository access logging.
 *
 * Lives outside `repo.functions.ts` because a `createServerFn` module must be
 * a thin wrapper: runtime siblings declared next to server functions are
 * removed by the split transform and blow up at runtime.
 */

import { getRequest } from "@tanstack/react-start/server";

export function clientIpAndUa(): { ip: string | null; ua: string | null } {
  try {
    const req = getRequest();
    const h = req.headers;
    const ip =
      h.get("cf-connecting-ip") ??
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      h.get("x-real-ip") ??
      null;
    return { ip, ua: h.get("user-agent") };
  } catch {
    return { ip: null, ua: null };
  }
}
