import bcrypt from "bcryptjs";

/** bcrypt cost: sign-in checks every active visitor of a repository, so keep it Worker-friendly. */
export const BCRYPT_COST = 10;

export function hashVisitorPassword(password: string): string {
  return bcrypt.hashSync(password, BCRYPT_COST);
}

export function isBcryptHash(stored: string | null | undefined): boolean {
  return !!stored && /^\$2[aby]\$\d{2}\$/.test(stored);
}

/** bcrypt only: any non-bcrypt stored value never matches. */
export async function verifyVisitorPassword(
  password: string,
  row: { password_hash: string; password_hash_bcrypt?: string | null },
): Promise<boolean> {
  const bc = isBcryptHash(row.password_hash_bcrypt) ? row.password_hash_bcrypt! : isBcryptHash(row.password_hash) ? row.password_hash : null;
  return bc ? bcrypt.compareSync(password, bc) : false;
}
