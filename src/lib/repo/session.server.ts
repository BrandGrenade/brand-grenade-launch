import { useSession } from "@tanstack/react-start/server";
import { scryptSync, randomBytes, timingSafeEqual, createHash } from "node:crypto";

const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function sessionSecret(): string {
  const s = process.env.REPO_SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("REPO_SESSION_SECRET is not set (>=32 chars)");
  return s;
}

export type VisitorSession = {
  visitorId?: string;
  visitorName?: string;
  repositorySlug?: string;
};

export type AdminSession = {
  unlocked?: boolean;
};

export function visitorSession(slug: string) {
  return useSession<VisitorSession>({
    password: sessionSecret(),
    name: `repo-${slug}`,
    maxAge: SESSION_MAX_AGE,
    cookie: { httpOnly: true, secure: true, sameSite: "lax", path: "/" },
  });
}

export function adminSession() {
  return useSession<AdminSession>({
    password: sessionSecret(),
    name: "repo-admin",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    cookie: { httpOnly: true, secure: true, sameSite: "lax", path: "/" },
  });
}

// scrypt-based password hashing
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const key = scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const salt = Buffer.from(parts[1], "hex");
  const expected = Buffer.from(parts[2], "hex");
  const derived = scryptSync(password, salt, expected.length);
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

export function verifyAdminPassword(input: string): boolean {
  const expected = process.env.ADMIN_REPO_PASSWORD;
  if (!expected) return false;
  const a = createHash("sha256").update(input, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return a.length === b.length && timingSafeEqual(a, b);
}
