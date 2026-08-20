"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  companyBrandingWriteSchema,
  type CompanyBrandingWriteFormValues,
  type CompanyBrandingWriteInput,
} from "@/domain/companies/branding-schema";
import type { CompanyBrandingRecord } from "@/domain/companies/branding-types";
import { LOGO_MAX_BYTES } from "@/domain/companies/branding-types";
import {
  removeCompanyLogoAction,
  updateCompanyBrandingAction,
  uploadCompanyLogoAction,
} from "@/server/companies/branding-actions";

export function CompanyBrandingForm({ branding }: { branding: CompanyBrandingRecord }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [logoBusy, setLogoBusy] = useState(false);
  const form = useForm<CompanyBrandingWriteFormValues, unknown, CompanyBrandingWriteInput>({
    resolver: zodResolver(companyBrandingWriteSchema),
    defaultValues: {
      email: branding.email ?? "",
      phone: branding.phone ?? "",
      website: branding.website ?? "",
      invoicePrefix: branding.invoicePrefix ?? "",
      termsAndConditions: branding.termsAndConditions ?? "",
      emailTemplateReference: branding.emailTemplateReference ?? "",
    },
  });

  async function onSubmit(values: CompanyBrandingWriteInput) {
    setError(null);
    setMessage(null);
    const result = await updateCompanyBrandingAction(branding.companyId, values);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMessage(result.message ?? "Saved.");
    router.refresh();
  }

  async function onUploadLogo(formData: FormData) {
    setError(null);
    setMessage(null);
    setLogoBusy(true);
    try {
      const result = await uploadCompanyLogoAction(branding.companyId, formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage(result.message ?? "Logo uploaded.");
      router.refresh();
    } finally {
      setLogoBusy(false);
    }
  }

  async function onRemoveLogo() {
    setError(null);
    setMessage(null);
    setLogoBusy(true);
    try {
      const result = await removeCompanyLogoAction(branding.companyId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage(result.message ?? "Logo removed.");
      router.refresh();
    } finally {
      setLogoBusy(false);
    }
  }

  return (
    <div className="grid gap-8">
      <form className="grid gap-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <div className="grid gap-2 sm:grid-cols-3 sm:gap-4">
          <div className="grid gap-2">
            <Label htmlFor="email">Brand email</Label>
            <Input id="email" type="email" {...form.register("email")} />
            {form.formState.errors.email ? (
              <p className="text-destructive text-sm">{form.formState.errors.email.message}</p>
            ) : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="phone">Brand phone</Label>
            <Input id="phone" {...form.register("phone")} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="website">Brand website</Label>
            <Input id="website" type="url" placeholder="https://" {...form.register("website")} />
            {form.formState.errors.website ? (
              <p className="text-destructive text-sm">{form.formState.errors.website.message}</p>
            ) : null}
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 sm:gap-4">
          <div className="grid gap-2">
            <Label htmlFor="invoicePrefix">Invoice prefix</Label>
            <Input id="invoicePrefix" placeholder="VX-" {...form.register("invoicePrefix")} />
            {form.formState.errors.invoicePrefix ? (
              <p className="text-destructive text-sm">
                {form.formState.errors.invoicePrefix.message}
              </p>
            ) : (
              <p className="text-muted-foreground text-xs">
                Company-specific prefix used later for invoice numbers (e.g. VX-). Sequence issuance
                is not configured here.
              </p>
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="emailTemplateReference">Email template reference</Label>
            <Input
              id="emailTemplateReference"
              placeholder="invoice-default"
              {...form.register("emailTemplateReference")}
            />
            {form.formState.errors.emailTemplateReference ? (
              <p className="text-destructive text-sm">
                {form.formState.errors.emailTemplateReference.message}
              </p>
            ) : (
              <p className="text-muted-foreground text-xs">
                Reference key for the brand invoice email template. Sending email is not enabled
                yet.
              </p>
            )}
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="termsAndConditions">Terms &amp; conditions</Label>
          <textarea
            id="termsAndConditions"
            rows={8}
            className="border-input bg-background min-h-32 w-full rounded-md border px-3 py-2 text-sm"
            {...form.register("termsAndConditions")}
          />
          {form.formState.errors.termsAndConditions ? (
            <p className="text-destructive text-sm">
              {form.formState.errors.termsAndConditions.message}
            </p>
          ) : null}
        </div>

        {error ? <p className="text-destructive text-sm">{error}</p> : null}
        {message ? <p className="text-sm text-emerald-700">{message}</p> : null}

        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Saving…" : "Save branding"}
          </Button>
          <Button asChild variant="outline">
            <Link href={`/companies/${branding.companyId}`}>Back to company</Link>
          </Button>
        </div>
      </form>

      <section className="grid gap-4 border-t pt-6">
        <div className="grid gap-1">
          <h2 className="text-sm font-semibold">Company logo</h2>
          <p className="text-muted-foreground text-xs">
            PNG, JPEG, or WebP up to {Math.floor(LOGO_MAX_BYTES / (1024 * 1024))} MB. Used later on
            invoice PDFs.
          </p>
        </div>

        {branding.logo ? (
          <div className="grid gap-3 sm:grid-cols-[auto_1fr] sm:items-start">
            {/* eslint-disable-next-line @next/next/no-img-element -- authenticated binary logo endpoint */}
            <img
              src={`/api/companies/${branding.companyId}/branding/logo`}
              alt={`${branding.displayName} logo`}
              className="border-border h-24 w-24 rounded-md border bg-white object-contain"
            />
            <div className="grid gap-1 text-sm">
              <p>
                {branding.logo.originalFilename ?? "logo"} · {branding.logo.mimeType} ·{" "}
                {branding.logo.byteSize} bytes
              </p>
              <p className="text-muted-foreground text-xs">
                Uploaded{" "}
                {branding.logo.uploadedAt instanceof Date
                  ? branding.logo.uploadedAt.toISOString()
                  : String(branding.logo.uploadedAt)}
              </p>
              <div>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={logoBusy}
                  onClick={() => void onRemoveLogo()}
                >
                  Remove logo
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">No logo uploaded.</p>
        )}

        <form
          className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"
          action={(formData) => {
            void onUploadLogo(formData);
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="logo">Upload logo</Label>
            <Input id="logo" name="logo" type="file" accept="image/png,image/jpeg,image/webp" />
          </div>
          <Button type="submit" disabled={logoBusy}>
            {logoBusy ? "Uploading…" : "Upload"}
          </Button>
        </form>
      </section>
    </div>
  );
}
