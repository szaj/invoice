"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { useForm, type UseFormRegister } from "react-hook-form";

import { FormActions, FormSection } from "@/components/forms/form-section";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  notificationSettingsUpdateSchema,
  type NotificationSettingsUpdateFormValues,
  type NotificationSettingsUpdateInput,
} from "@/domain/notifications/schema";
import { updateNotificationSettingsAction } from "@/server/settings/actions";

type ToggleFieldProps = {
  id: keyof NotificationSettingsUpdateFormValues;
  label: string;
  description: string;
  disabled?: boolean;
  register: UseFormRegister<NotificationSettingsUpdateFormValues>;
};

function ToggleField({ id, label, description, disabled, register }: ToggleFieldProps) {
  return (
    <div className="flex items-start gap-3">
      <input
        id={id}
        type="checkbox"
        disabled={disabled}
        className="border-input mt-1 h-4 w-4 rounded disabled:opacity-50"
        {...register(id)}
      />
      <div className="grid gap-1">
        <Label htmlFor={id}>{label}</Label>
        <p className="text-muted-foreground text-xs">{description}</p>
      </div>
    </div>
  );
}

export function NotificationSettingsForm({
  defaultValues,
}: {
  defaultValues: NotificationSettingsUpdateFormValues;
}) {
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const form = useForm<
    NotificationSettingsUpdateFormValues,
    unknown,
    NotificationSettingsUpdateInput
  >({
    resolver: zodResolver(notificationSettingsUpdateSchema),
    defaultValues,
  });

  const overdueEnabled = form.watch("notifyInvoiceOverdue");

  async function onSubmit(values: NotificationSettingsUpdateInput) {
    setError(null);
    setMessage(null);
    const result = await updateNotificationSettingsAction(values);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMessage(result.message ?? "Saved.");
  }

  return (
    <form className="grid gap-8" onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <FormSection
        title="Invoice email"
        description="Internal alerts when customer invoice emails succeed or fail."
      >
        <ToggleField
          id="notifyInvoiceEmailSent"
          label="Invoice email sent"
          description="Notify Admin when an invoice email is delivered successfully."
          register={form.register}
        />
        <ToggleField
          id="notifyInvoiceEmailFailed"
          label="Invoice email failed"
          description="Notify Admin when an invoice email delivery attempt fails."
          register={form.register}
        />
      </FormSection>

      <FormSection
        title="Payments"
        description="Optional internal alerts for payment lifecycle events."
      >
        <ToggleField
          id="notifyPaymentSuccess"
          label="Payment successful"
          description="Notify Admin when a payment is confirmed successfully."
          register={form.register}
        />
        <ToggleField
          id="notifyPaymentFailed"
          label="Payment failed"
          description="Notify Admin when a payment is marked failed."
          register={form.register}
        />
      </FormSection>

      <FormSection
        title="Overdue invoices"
        description="Configurable recipients for overdue invoice alerts."
      >
        <ToggleField
          id="notifyInvoiceOverdue"
          label="Invoice overdue alerts"
          description="Send internal email when an invoice becomes overdue."
          register={form.register}
        />
        <div className="border-border ml-7 grid gap-3 border-l pl-4">
          <ToggleField
            id="notifyInvoiceOverdueToAdmin"
            label="Notify Admin"
            description="Include all active Admin users."
            disabled={!overdueEnabled}
            register={form.register}
          />
          <ToggleField
            id="notifyInvoiceOverdueToAssignedStaff"
            label="Notify assigned staff"
            description="Include the staff member assigned to the invoice company, when set."
            disabled={!overdueEnabled}
            register={form.register}
          />
        </div>
      </FormSection>

      <FormSection title="Compliance and gateway">
        <ToggleField
          id="notifyComplianceFlagged"
          label="Compliance flagged"
          description="Notify Admin and assigned Compliance users when an item is flagged."
          register={form.register}
        />
        <ToggleField
          id="notifyGatewayFailure"
          label="Gateway failure"
          description="Notify Admin on gateway webhook or configuration failures."
          register={form.register}
        />
      </FormSection>

      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      {message ? <p className="text-sm text-green-700">{message}</p> : null}

      <FormActions>
        <Button type="submit" disabled={form.formState.isSubmitting}>
          Save notification settings
        </Button>
        <Link href="/" className="text-primary text-sm underline-offset-4 hover:underline">
          Back to home
        </Link>
      </FormActions>
    </form>
  );
}
