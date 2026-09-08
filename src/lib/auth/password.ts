import { randomBytes } from "crypto";
import { hash as argon2Hash, verify as argon2Verify, Options } from "@node-rs/argon2";

/**
 * Argon2id password hashing with a UNIQUE per-password salt.
 *
 * - Algorithm: Argon2id (side-channel resistant hybrid — OWASP first choice).
 *   @node-rs/argon2 defaults to Argon2id; hashPassword() additionally asserts
 *   the produced PHC string really is $argon2id$ at runtime.
 * - Parameters follow the OWASP Password Storage Cheat Sheet baseline:
 *     memoryCost = 19456 KiB (19 MiB), timeCost = 2, parallelism = 1.
 * - Salt: 128 bits of CSPRNG output generated per hash and passed explicitly
 *   to Argon2, so no two hashes ever share a salt (rainbow tables useless).
 * - Output: standard PHC string ($argon2id$v=19$m=...$salt$hash) that embeds
 *   algorithm + version + params + salt, enabling future param upgrades.
 */

export const ARGON2_MEMORY_COST = 19456;
export const ARGON2_TIME_COST = 2;
export const ARGON2_PARALLELISM = 1;
export const PASSWORD_SCHEMA_VERSION = 1;

const ARGON2_OPTIONS: Options = {
  memoryCost: ARGON2_MEMORY_COST,
  timeCost: ARGON2_TIME_COST,
  parallelism: ARGON2_PARALLELISM,
};

/** 128-bit unique salt per password (hex-encoded, 32 chars). */
export function generateSalt(): string {
  return randomBytes(16).toString("hex");
}

export interface HashedPassword {
  /** Full PHC string — safe to store, embeds salt + parameters. */
  hash: string;
  /** The unique per-password salt (hex). Stored separately for uniqueness + audits. */
  salt: string;
}

export async function hashPassword(password: string): Promise<HashedPassword> {
  const salt = generateSalt();
  const hash = await argon2Hash(password, {
    ...ARGON2_OPTIONS,
    // Pass the raw salt bytes so the PHC string embeds exactly this salt.
    salt: Buffer.from(salt, "hex"),
  });
  if (!hash.startsWith("$argon2id$")) {
    throw new Error("Expected Argon2id PHC string — refusing to store a weaker hash.");
  }
  return { hash, salt };
}

/** Constant-time verification against a stored PHC string. */
export function verifyPassword(storedHash: string, password: string): Promise<boolean> {
  return argon2Verify(storedHash, password);
}

/**
 * Dummy hash used to equalize response timing when the email does not exist,
 * so attackers cannot enumerate accounts by measuring latency.
 * Generated lazily once per process.
 */
let dummyHashPromise: Promise<string> | null = null;
export function getDummyHash(): Promise<string> {
  if (!dummyHashPromise) {
    dummyHashPromise = argon2Hash(randomBytes(24).toString("base64url"), {
      ...ARGON2_OPTIONS,
      salt: randomBytes(16),
    });
  }
  return dummyHashPromise;
}

/** Burn the same CPU cost as a real verification (timing equalization). */
export async function dummyVerify(): Promise<void> {
  try {
    await verifyPassword(await getDummyHash(), randomBytes(24).toString("base64url"));
  } catch {
    /* never surface */
  }
}

/**
 * Password policy: min 8 chars with upper, lower and digit.
 * Returns a Spanish error message, or null when the password is acceptable.
 */
export function validatePassword(password: string): string | null {
  if (typeof password !== "string" || password.length < 8) {
    return "La contraseña debe tener al menos 8 caracteres.";
  }
  if (password.length > 128) {
    return "La contraseña no puede superar los 128 caracteres.";
  }
  if (!/[a-z]/.test(password)) {
    return "La contraseña debe incluir al menos una letra minúscula.";
  }
  if (!/[A-Z]/.test(password)) {
    return "La contraseña debe incluir al menos una letra mayúscula.";
  }
  if (!/[0-9]/.test(password)) {
    return "La contraseña debe incluir al menos un número.";
  }
  return null;
}
