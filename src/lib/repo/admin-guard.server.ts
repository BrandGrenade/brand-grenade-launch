/**
 * Admin/session guards for the repository server functions.
 *
 * These used to live as runtime siblings inside `repo-admin.functions.ts` and
 * pulled `repo/session.server.ts` (which imports `node:crypto`) in through a
 * dynamic import from module scope — a client-graph edge that only survived
 * because the server-function split happened to remove it. Keeping them in a
 * `*.server.ts` module makes the boundary explicit: filename-based import
 * protection blocks this file from every client bundle.
 */

// `session.server.ts` imports `node:crypto`; it is loaded lazily, inside function
// bodies only, so it can never appear in a client bundle's static graph.
async function session() {
  return (await import("./session.server")).adminSession();
}

export async function requireAdmin(): Promise<void> {
  const s = await session();
  if (!s.data.unlocked) throw new Error("Unauthorized");
}

export async function requirePlatformAdminByEmail(
  email: string | undefined,
  supabase: unknown,
): Promise<void> {
  if (!email) throw new Error("Unauthorized");
  const client = supabase as {
    from: (table: string) => {
      select: (columns: string) => {
        eq: (column: string, value: string) => {
          eq: (
            column: string,
            value: boolean,
          ) => { maybeSingle: () => Promise<{ data: unknown; error: { message: string } | null }> };
        };
      };
    };
  };
  const { data, error } = await client
    .from("users")
    .select("id")
    .eq("email", email)
    .eq("is_admin", true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Unauthorized");
}

export async function unlockAdminSession(): Promise<void> {
  const s = await session();
  await s.update({ unlocked: true });
}

export async function verifyAdminPasswordSafe(password: string): Promise<boolean> {
  const { verifyAdminPassword } = await import("./session.server");
  return verifyAdminPassword(password);
}

export async function hashPasswordSafe(password: string): Promise<string> {
  const { hashPassword } = await import("./session.server");
  return hashPassword(password);
}
