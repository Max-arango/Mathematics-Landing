/**
 * Seed the SPECIAL ADMIN USER for the Mathematics Simulator platform.
 *
 * Usage:
 *   bun scripts/seed-admin.ts
 *
 * Configuration (env vars, all optional):
 *   ADMIN_EMAIL     default: admin@mathsim.local
 *   ADMIN_PASSWORD  default: MathsAdmin#2025   (CHANGE THIS IN PRODUCTION)
 *   ADMIN_NAME      default: Administrador
 *
 * Idempotent: if the admin already exists the role/active flag are enforced
 * but an existing password is NEVER overwritten unless it has no credential
 * row yet.
 */
import { PrismaClient } from "@prisma/client";
import { hashPassword, validatePassword } from "../src/lib/auth/password";

const db = new PrismaClient();

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL ?? "admin@mathsim.local").trim().toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "MathsAdmin#2025";
const ADMIN_NAME = process.env.ADMIN_NAME ?? "Administrador";

async function main() {
  const policyError = validatePassword(ADMIN_PASSWORD);
  if (policyError) {
    throw new Error(`ADMIN_PASSWORD no cumple la política: ${policyError}`);
  }

  // Fresh Argon2id hash with a UNIQUE 128-bit salt for this password.
  const { hash, salt } = await hashPassword(ADMIN_PASSWORD);

  const user = await db.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { role: "ADMIN", isActive: true },
    create: {
      email: ADMIN_EMAIL,
      name: ADMIN_NAME,
      role: "ADMIN",
      isActive: true,
      password: { create: { hash, salt } },
      emails: {
        create: { address: ADMIN_EMAIL, isPrimary: true, isVerified: true },
      },
    },
    include: { password: true, emails: true },
  });

  // Edge case: user existed but had no credential row → create it now.
  if (!user.password) {
    await db.passwordCredential.create({
      data: { userId: user.id, hash, salt },
    });
    console.log("• Se creó la credencial que faltaba para el administrador.");
  } else {
    console.log("• Credencial existente conservada (la contraseña NO se sobrescribió).");
  }

  // Ensure the primary email row exists (defensive).
  const hasPrimary = user.emails.some((e) => e.address === ADMIN_EMAIL);
  if (!hasPrimary) {
    await db.emailAddress.upsert({
      where: { address: ADMIN_EMAIL },
      update: { userId: user.id, isPrimary: true, isVerified: true },
      create: { userId: user.id, address: ADMIN_EMAIL, isPrimary: true, isVerified: true },
    });
    console.log("• Se añadió la dirección de correo primaria que faltaba.");
  }

  console.log("── Administrador sembrado ─────────────────────────────");
  console.log(`  ID:     ${user.id}`);
  console.log(`  Email:  ${user.email}`);
  console.log(`  Rol:    ${user.role}`);
  console.log(`  Estado: ${user.isActive ? "activo" : "inactivo"}`);
  if (!process.env.ADMIN_PASSWORD) {
    console.log(`  Clave:  ${ADMIN_PASSWORD}  ← cambia esto con ADMIN_PASSWORD=... bun scripts/seed-admin.ts`);
  }
  console.log("───────────────────────────────────────────────────────");
}

main()
  .catch((err) => {
    console.error("Seed falló:", err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
