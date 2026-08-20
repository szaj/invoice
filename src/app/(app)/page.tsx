import { LogoutButton } from "@/app/(app)/logout-button";
import { getAuthenticatedIdentity } from "@/server/auth/session";

export const dynamic = "force-dynamic";

export default async function Home() {
  const identity = await getAuthenticatedIdentity();

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-lg flex-col justify-center gap-6 p-8">
      <div className="grid gap-2">
        <h1 className="text-xl font-semibold">Signed in</h1>
        <p className="text-muted-foreground text-sm">
          Authenticated as {identity?.email}. This page only confirms identity. Application
          authorization is not implemented yet.
        </p>
      </div>
      <LogoutButton />
    </main>
  );
}
