/**
 * Lazy accessors for the visitor session helpers.
 *
 * `session.server.ts` imports `node:crypto`, so nothing may reference it
 * statically from a module that a `createServerFn` file imports — the split
 * transform is not a boundary we want to depend on. Loading it inside function
 * bodies keeps it out of every static client graph.
 */

export async function visitorSession(slug: string) {
  return (await import("./session.server")).visitorSession(slug);
}

export async function verifyPassword(): Promise<(password: string, hash: string) => boolean> {
  return (await import("./session.server")).verifyPassword;
}
