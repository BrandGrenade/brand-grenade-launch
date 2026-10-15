import { describe, it, expect } from "vitest";
import { hashVisitorPassword, isBcryptHash, verifyVisitorPassword } from "./password-hash.server";
import { hashPassword } from "./session.server";

describe("repository visitor password hashing", () => {
  it("stores a salted bcrypt hash, never the password", () => {
    const h = hashVisitorPassword("correct-horse");
    expect(isBcryptHash(h)).toBe(true);
    expect(h).not.toContain("correct-horse");
    expect(hashVisitorPassword("correct-horse")).not.toBe(h);
  });

  it("accepts the correct password and rejects a wrong one", async () => {
    const h = hashVisitorPassword("correct-horse");
    const row = { password_hash: h, password_hash_bcrypt: h };
    expect(await verifyVisitorPassword("correct-horse", row)).toBe(true);
    expect(await verifyVisitorPassword("wrong-horse", row)).toBe(false);
  });

  it("reset invalidates the old password", async () => {
    const before = { password_hash: hashVisitorPassword("old-pass"), password_hash_bcrypt: null };
    const h2 = hashVisitorPassword("new-pass");
    const after = { password_hash: h2, password_hash_bcrypt: h2 };
    expect(await verifyVisitorPassword("old-pass", before)).toBe(true);
    expect(await verifyVisitorPassword("old-pass", after)).toBe(false);
    expect(await verifyVisitorPassword("new-pass", after)).toBe(true);
  });

  it("prefers bcrypt over a legacy scrypt hash", async () => {
    const row = { password_hash: hashPassword("old-pass"), password_hash_bcrypt: hashVisitorPassword("new-pass") };
    expect(await verifyVisitorPassword("old-pass", row)).toBe(false);
    expect(await verifyVisitorPassword("new-pass", row)).toBe(true);
  });
});
