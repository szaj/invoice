import { randomBytes } from "node:crypto";

import { describe, expect, it } from "vitest";

import { deriveGatewayConfigStatus } from "@/domain/gateway-config/types";
import {
  gatewayCredentialsReplaceSchema,
  gatewayMethodConfigWriteSchema,
} from "@/domain/gateway-config/schema";
import { CredentialCipher } from "@/server/gateway-credentials/credential-cipher";
import {
  GatewayCredentialService,
  assertGatewayCredentialsKeyringForProduction,
} from "@/server/gateway-credentials/gateway-credential-service";
import {
  EnvironmentKeyProvider,
  GatewayCredentialCryptoError,
  parseEnvironmentKeyring,
} from "@/server/gateway-credentials/key-provider";
import { toPublicGatewayConfiguration } from "@/server/gateway-config/gateway-config-service";
import { maskSensitiveAuditValues } from "@/domain/audit/mask";
import { loadEnv } from "@/config/env";

function testKek(): string {
  return randomBytes(32).toString("base64");
}

describe("ADR-022 gateway credential envelope", () => {
  const kekV1 = testKek();
  const kekV2 = testKek();
  const keyringSource = {
    GATEWAY_CREDENTIALS_KEY_VERSION: "1",
    GATEWAY_CREDENTIALS_KEY_V1: kekV1,
    GATEWAY_CREDENTIALS_KEY_V2: kekV2,
  };

  it("encrypts and decrypts a credential payload (round trip)", () => {
    const service = GatewayCredentialService.fromEnv(keyringSource);
    const aad = { companyId: "11111111-1111-4111-8111-111111111111", methodCode: "STRIPE" };
    const payload = {
      apiKey: "sk_test_example",
      apiSecret: "secret-value",
      webhookSecret: "whsec_example",
    };

    const envelope = service.encryptCredentials(payload, aad);
    expect(envelope.kekKeyVersion).toBe(1);
    expect(envelope.encryptionFormatVersion).toBe(1);
    expect(envelope.credentialsCiphertext.equals(Buffer.from(JSON.stringify(payload)))).toBe(false);

    const decrypted = service.decryptCredentials(envelope, aad);
    expect(decrypted).toEqual(payload);
  });

  it("fails closed on tampered ciphertext", () => {
    const service = GatewayCredentialService.fromEnv(keyringSource);
    const aad = { companyId: "11111111-1111-4111-8111-111111111111", methodCode: "STRIPE" };
    const envelope = service.encryptCredentials({ apiKey: "k" }, aad);
    const tampered = {
      ...envelope,
      credentialsCiphertext: Buffer.from(envelope.credentialsCiphertext),
    };
    tampered.credentialsCiphertext[0] = tampered.credentialsCiphertext[0]! ^ 0xff;

    expect(() => service.decryptCredentials(tampered, aad)).toThrow(GatewayCredentialCryptoError);
  });

  it("fails closed on company/provider AAD mismatch", () => {
    const service = GatewayCredentialService.fromEnv(keyringSource);
    const envelope = service.encryptCredentials(
      { apiKey: "k" },
      { companyId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", methodCode: "STRIPE" },
    );

    expect(() =>
      service.decryptCredentials(envelope, {
        companyId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        methodCode: "STRIPE",
      }),
    ).toThrow(GatewayCredentialCryptoError);

    expect(() =>
      service.decryptCredentials(envelope, {
        companyId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        methodCode: "PAYPAL",
      }),
    ).toThrow(GatewayCredentialCryptoError);
  });

  it("retains key-version metadata for rotation", () => {
    const provider = EnvironmentKeyProvider.fromEnv({
      GATEWAY_CREDENTIALS_KEY_VERSION: "2",
      GATEWAY_CREDENTIALS_KEY_V1: kekV1,
      GATEWAY_CREDENTIALS_KEY_V2: kekV2,
    });
    const cipher = new CredentialCipher(provider);
    const aad = { companyId: "11111111-1111-4111-8111-111111111111", methodCode: "PAYPAL" };
    const envelope = cipher.encrypt(JSON.stringify({ token: "x" }), aad);
    expect(envelope.kekKeyVersion).toBe(2);
    expect(JSON.parse(cipher.decrypt(envelope, aad))).toEqual({ token: "x" });

    // Historical V1 ciphertext still decrypts while V1 remains in keyring.
    const v1Provider = EnvironmentKeyProvider.fromEnv(keyringSource);
    const v1Envelope = new CredentialCipher(v1Provider).encrypt(
      JSON.stringify({ token: "old" }),
      aad,
    );
    expect(v1Envelope.kekKeyVersion).toBe(1);
    expect(JSON.parse(cipher.decrypt(v1Envelope, aad))).toEqual({ token: "old" });
  });

  it("fails closed when keyring is missing or active key invalid", () => {
    expect(parseEnvironmentKeyring({})).toBeNull();
    expect(() =>
      EnvironmentKeyProvider.fromEnv({
        GATEWAY_CREDENTIALS_KEY_VERSION: "1",
      }),
    ).toThrow(GatewayCredentialCryptoError);
    expect(() =>
      parseEnvironmentKeyring({
        GATEWAY_CREDENTIALS_KEY_VERSION: "1",
        GATEWAY_CREDENTIALS_KEY_V1: Buffer.from("too-short").toString("base64"),
      }),
    ).toThrow(GatewayCredentialCryptoError);
    expect(() => assertGatewayCredentialsKeyringForProduction("production", {})).toThrow(
      GatewayCredentialCryptoError,
    );
  });
});

describe("gateway config schemas and safe views", () => {
  it("requires explicit credentials payload for replace", () => {
    expect(gatewayCredentialsReplaceSchema.safeParse({ credentials: {} }).success).toBe(false);
    expect(
      gatewayCredentialsReplaceSchema.safeParse({
        credentials: { apiKey: "sk_live_x" },
      }).success,
    ).toBe(true);
  });

  it("allows non-secret PATCH without credentials", () => {
    expect(
      gatewayMethodConfigWriteSchema.safeParse({
        methodEnabled: true,
        environment: "SANDBOX",
      }).success,
    ).toBe(true);
  });

  it("derives status without decrypting", () => {
    expect(
      deriveGatewayConfigStatus({
        methodEnabled: false,
        methodCode: "STRIPE",
        credentialsConfigured: true,
        environment: "LIVE",
      }),
    ).toBe("DISABLED");
    expect(
      deriveGatewayConfigStatus({
        methodEnabled: true,
        methodCode: "STRIPE",
        credentialsConfigured: false,
        environment: "SANDBOX",
      }),
    ).toBe("CONFIGURATION_ERROR");
    expect(
      deriveGatewayConfigStatus({
        methodEnabled: true,
        methodCode: "MANUAL",
        credentialsConfigured: false,
        environment: null,
      }),
    ).toBe("HEALTHY");
  });

  it("public configuration never includes envelope or secret fields", () => {
    const publicConfig = toPublicGatewayConfiguration({
      companyId: "11111111-1111-4111-8111-111111111111",
      companyDisplayName: "Acme",
      methods: [
        {
          methodCode: "STRIPE",
          methodEnabled: true,
          environment: "SANDBOX",
          credentialsConfigured: true,
          providerConfig: { webhookUrl: "https://example.com/hook" },
          enabledSettlementCurrencyCodes: ["USD"],
          status: "HEALTHY",
          providerRegistered: false,
        },
      ],
    });
    const serialized = JSON.stringify(publicConfig);
    expect(serialized).toContain("credentialsConfigured");
    expect(serialized).not.toMatch(/ciphertext|wrappedDek|nonce|authTag|apiKey|sk_|whsec_/i);
  });

  it("audit mask redacts credential-like keys", () => {
    const masked = maskSensitiveAuditValues({
      methodCode: "STRIPE",
      credentials: { apiKey: "sk_live_secret" },
      webhookSecret: "whsec_x",
      credentialsConfigured: true,
    });
    expect(masked).toEqual({
      methodCode: "STRIPE",
      credentials: "[Redacted]",
      webhookSecret: "[Redacted]",
      credentialsConfigured: true,
    });
  });

  it("loads optional gateway keyring fields through typed env", () => {
    const kek = testKek();
    const env = loadEnv({
      NODE_ENV: "test",
      GATEWAY_CREDENTIALS_KEY_VERSION: "1",
      GATEWAY_CREDENTIALS_KEY_V1: kek,
    });
    expect(env.GATEWAY_CREDENTIALS_KEY_VERSION).toBe(1);
    expect(env.GATEWAY_CREDENTIALS_KEY_V1).toBe(kek);
  });
});
