import { redirect } from "next/navigation";

import { getAuthenticatedIdentity } from "@/server/auth/session";

export const dynamic = "force-dynamic";

export default async function AuthenticatedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const identity = await getAuthenticatedIdentity();

  if (!identity) {
    redirect("/login");
  }

  return children;
}
