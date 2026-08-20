import { loadEnvFiles } from "../src/config/load-env-files";
import { bootstrapAdmin, parseBootstrapAdminEmailArg } from "../src/domain/ops/bootstrap-admin";
import {
  createOpsPrismaClient,
  PrismaBootstrapAdminStore,
  requireOpsDatabaseUrl,
} from "../src/ops/bootstrap-admin-store";

async function main(): Promise<number> {
  loadEnvFiles();

  const emailArg = parseBootstrapAdminEmailArg(process.argv.slice(2));
  if (!emailArg) {
    console.error("Usage: pnpm bootstrap:admin -- --email <existing-user@example.com>");
    console.error("Assigns the system ADMIN role in the application database only.");
    console.error("Does not create Auth users, accept passwords, or write Auth metadata.");
    return 1;
  }

  let databaseUrl: string;
  try {
    databaseUrl = requireOpsDatabaseUrl();
  } catch (error) {
    console.error(error instanceof Error ? error.message : "DATABASE_URL is required");
    return 1;
  }

  const prisma = createOpsPrismaClient(databaseUrl);
  try {
    const result = await bootstrapAdmin(emailArg, new PrismaBootstrapAdminStore(prisma));

    if (!result.ok) {
      console.error(`bootstrap:admin failed (${result.code}): ${result.message}`);
      return 1;
    }

    if (result.outcome === "already_admin") {
      console.log(
        `bootstrap:admin ok — ${result.email} is already ADMIN (user.manage=${result.userManageResolved}).`,
      );
      return 0;
    }

    console.log(
      `bootstrap:admin ok — assigned ADMIN to ${result.email} (user.manage=${result.userManageResolved}).`,
    );
    console.log("Use authorized User Management for all later role changes.");
    return 0;
  } catch (error) {
    console.error(
      `bootstrap:admin failed: ${error instanceof Error ? error.message : "unexpected error"}`,
    );
    return 1;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .then((exitCode) => {
    process.exit(exitCode);
  })
  .catch((error: unknown) => {
    console.error(
      `bootstrap:admin failed: ${error instanceof Error ? error.message : "unexpected error"}`,
    );
    process.exit(1);
  });
