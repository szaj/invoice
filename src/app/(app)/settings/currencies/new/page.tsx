import Link from "next/link";
import { redirect } from "next/navigation";

import { authorizePermission } from "@/domain/authz/authorize";
import { CurrencyForm } from "@/app/(app)/settings/currencies/currency-form";
import { getRequestAuthorizationPrincipal } from "@/server/authz/require-permission";

export const dynamic = "force-dynamic";

export default async function NewCurrencyPage() {
  const actor = await getRequestAuthorizationPrincipal();
  if (!authorizePermission(actor, "currency.manage").allowed) {
    redirect("/");
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-8">
      <div className="grid gap-1">
        <h1 className="text-xl font-semibold">Add currency</h1>
        <p className="text-muted-foreground text-sm">
          Create a global ISO-style currency record. Company enablement is a later task.
        </p>
      </div>
      <CurrencyForm
        submitLabel="Create currency"
        defaultValues={{
          code: "",
          name: "",
          symbol: "",
          decimalPrecision: 2,
          status: "ACTIVE",
        }}
      />
      <p className="text-sm">
        <Link
          href="/settings/currencies"
          className="text-primary underline-offset-4 hover:underline"
        >
          Back to currencies
        </Link>
      </p>
    </main>
  );
}
