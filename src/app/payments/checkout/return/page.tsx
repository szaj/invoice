import Link from "next/link";

/**
 * Provider return landing for hosted checkout (TASK-058).
 * Not a customer portal — confirmation remains webhook/status driven.
 */
export default async function CheckoutReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; invoiceId?: string }>;
}) {
  const params = await searchParams;
  const status = params.status === "cancel" ? "cancel" : "success";
  const cancelled = status === "cancel";

  return (
    <main className="bg-background text-foreground flex min-h-svh items-center justify-center px-4">
      <div className="border-border bg-card w-full max-w-md rounded-lg border p-6 shadow-xs">
        <h1 className="text-lg font-semibold">
          {cancelled ? "Checkout cancelled" : "Payment submitted"}
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          {cancelled
            ? "You cancelled the payment checkout. No payment was confirmed."
            : "If payment completed successfully, confirmation will appear after the payment provider notifies us. You can close this window."}
        </p>
        <p className="text-muted-foreground mt-4 text-sm">
          This page is not a customer account portal.
        </p>
        <div className="mt-6">
          <Link href="/" className="text-primary text-sm underline-offset-4 hover:underline">
            Return home
          </Link>
        </div>
      </div>
    </main>
  );
}
