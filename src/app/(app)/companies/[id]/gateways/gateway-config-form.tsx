"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import { StatusBadge } from "@/components/data/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import type {
  CompanyGatewayConfiguration,
  GatewayEnvironment,
  GatewayMethodSafeView,
} from "@/domain/gateway-config/types";
import { methodRequiresCredentials } from "@/domain/gateway-config/types";
import type { PaymentMethodCode } from "@/domain/settlement/types";
import {
  replaceGatewayCredentialsAction,
  updateGatewayMethodConfigAction,
} from "@/server/gateway-config/actions";

const METHOD_LABELS: Record<PaymentMethodCode, string> = {
  STRIPE: "Stripe",
  PAYPAL: "PayPal",
  BANK_PROCESSOR: "Bank processor",
  MANUAL: "Manual",
};

function MethodPanel({ companyId, method }: { companyId: string; method: GatewayMethodSafeView }) {
  const [methodEnabled, setMethodEnabled] = useState(method.methodEnabled);
  const [environment, setEnvironment] = useState<GatewayEnvironment | "">(method.environment ?? "");
  const [webhookUrl, setWebhookUrl] = useState(
    typeof method.providerConfig?.webhookUrl === "string" ? method.providerConfig.webhookUrl : "",
  );
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [credentialsConfigured, setCredentialsConfigured] = useState(method.credentialsConfigured);
  const [status, setStatus] = useState(method.status);

  const needsCredentials = methodRequiresCredentials(method.methodCode);

  async function onSaveConfig(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setPending(true);

    const providerConfig: Record<string, string> = {};
    if (webhookUrl.trim().length > 0) {
      providerConfig.webhookUrl = webhookUrl.trim();
    }

    const result = await updateGatewayMethodConfigAction(companyId, method.methodCode, {
      methodEnabled,
      environment: environment === "" ? null : environment,
      providerConfig: Object.keys(providerConfig).length > 0 ? providerConfig : null,
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    const next = result.data.methods.find((row) => row.methodCode === method.methodCode);
    if (next) {
      setMethodEnabled(next.methodEnabled);
      setEnvironment(next.environment ?? "");
      setCredentialsConfigured(next.credentialsConfigured);
      setStatus(next.status);
      setWebhookUrl(
        typeof next.providerConfig?.webhookUrl === "string" ? next.providerConfig.webhookUrl : "",
      );
    }
    setMessage("Configuration saved. Existing credentials were preserved.");
  }

  async function onReplaceCredentials(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setPending(true);

    const credentials: Record<string, string> = {};
    if (apiKey.trim()) {
      credentials.apiKey = apiKey.trim();
    }
    if (apiSecret.trim()) {
      credentials.apiSecret = apiSecret.trim();
    }
    if (webhookSecret.trim()) {
      credentials.webhookSecret = webhookSecret.trim();
    }

    const result = await replaceGatewayCredentialsAction(companyId, method.methodCode, {
      credentials,
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    const next = result.data.methods.find((row) => row.methodCode === method.methodCode);
    if (next) {
      setCredentialsConfigured(next.credentialsConfigured);
      setStatus(next.status);
    }
    setApiKey("");
    setApiSecret("");
    setWebhookSecret("");
    setMessage("Credentials saved (encrypted). Values are never shown again.");
  }

  return (
    <div className="grid gap-4 rounded-md border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">{METHOD_LABELS[method.methodCode]}</h2>
        <StatusBadge status={status} />
      </div>

      <p className="text-muted-foreground text-xs">
        Settlement currencies:{" "}
        {method.enabledSettlementCurrencyCodes.length > 0
          ? method.enabledSettlementCurrencyCodes.join(", ")
          : "none enabled"}{" "}
        ·{" "}
        <Link className="underline" href={`/companies/${companyId}/settlement`}>
          Manage settlement
        </Link>
      </p>

      <form className="grid gap-4" onSubmit={onSaveConfig}>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={methodEnabled}
            onChange={(event) => setMethodEnabled(event.target.checked)}
          />
          Method enabled
        </label>

        <div className="grid gap-2">
          <Label htmlFor={`environment-${method.methodCode}`}>Environment</Label>
          <NativeSelect
            id={`environment-${method.methodCode}`}
            value={environment}
            onChange={(event) => setEnvironment(event.target.value as GatewayEnvironment | "")}
          >
            <option value="">Not set</option>
            <option value="SANDBOX">Sandbox / Test</option>
            <option value="LIVE">Live</option>
          </NativeSelect>
        </div>

        {needsCredentials ? (
          <div className="grid gap-2">
            <Label htmlFor={`webhook-url-${method.methodCode}`}>Webhook URL (non-secret)</Label>
            <Input
              id={`webhook-url-${method.methodCode}`}
              value={webhookUrl}
              onChange={(event) => setWebhookUrl(event.target.value)}
              placeholder="https://…"
              autoComplete="off"
            />
          </div>
        ) : null}

        <div className="text-muted-foreground text-xs">
          Credentials configured: {credentialsConfigured ? "yes" : "no"}
          {method.providerRegistered ? "" : " · Adapter not registered yet (later task)"}
          {method.methodCode === "STRIPE" && method.providerRegistered
            ? " · Stripe adapter active (request/status + webhooks)"
            : ""}
          {method.methodCode === "PAYPAL" && method.providerRegistered
            ? " · PayPal adapter active (request/status + webhooks)"
            : ""}
        </div>

        <Button type="submit" disabled={pending} size="sm">
          Save configuration
        </Button>
      </form>

      {needsCredentials ? (
        <form className="grid gap-3 border-t pt-4" onSubmit={onReplaceCredentials}>
          <p className="text-sm font-medium">
            {credentialsConfigured ? "Replace credentials" : "Set credentials"}
          </p>
          <p className="text-muted-foreground text-xs">
            Explicit secret replace only. Leave blank fields out of the payload by not filling them.
            Saved values are never displayed.
          </p>
          <div className="grid gap-2">
            <Label htmlFor={`api-key-${method.methodCode}`}>
              {method.methodCode === "STRIPE"
                ? "Publishable key"
                : method.methodCode === "PAYPAL"
                  ? "Client ID"
                  : "API key"}
            </Label>
            <Input
              id={`api-key-${method.methodCode}`}
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`api-secret-${method.methodCode}`}>
              {method.methodCode === "STRIPE"
                ? "Secret key"
                : method.methodCode === "PAYPAL"
                  ? "Client secret"
                  : "API secret"}
            </Label>
            <Input
              id={`api-secret-${method.methodCode}`}
              type="password"
              value={apiSecret}
              onChange={(event) => setApiSecret(event.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`webhook-secret-${method.methodCode}`}>
              {method.methodCode === "PAYPAL" ? "Webhook ID" : "Webhook secret"}
            </Label>
            <Input
              id={`webhook-secret-${method.methodCode}`}
              type="password"
              value={webhookSecret}
              onChange={(event) => setWebhookSecret(event.target.value)}
              autoComplete="off"
            />
          </div>
          <Button type="submit" disabled={pending} variant="secondary" size="sm">
            {credentialsConfigured ? "Replace credentials" : "Save credentials"}
          </Button>
        </form>
      ) : (
        <p className="text-muted-foreground border-t pt-4 text-xs">
          Manual payments do not store gateway credentials.
        </p>
      )}

      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      {message ? <p className="text-success text-sm">{message}</p> : null}
    </div>
  );
}

export function GatewayConfigForm({
  configuration,
}: {
  configuration: CompanyGatewayConfiguration;
}) {
  return (
    <div className="grid gap-4">
      {configuration.methods.map((method) => (
        <MethodPanel key={method.methodCode} companyId={configuration.companyId} method={method} />
      ))}
    </div>
  );
}
