import "server-only";

import {
  CredentialCipher,
  type CredentialEnvelope,
  type CredentialEnvelopeAad,
} from "@/server/gateway-credentials/credential-cipher";
import {
  EnvironmentKeyProvider,
  GatewayCredentialCryptoError,
  parseEnvironmentKeyring,
  type KeyProvider,
} from "@/server/gateway-credentials/key-provider";
import type { EnvSource } from "@/config/env-schema";

/**
 * Opaque gateway credential payload encrypted at rest (ADR-022).
 * Provider adapters receive this only through controlled server-side paths (later tasks).
 */
export type GatewayCredentialPayload = Readonly<Record<string, string>>;

export type EncryptedCredentialRecord = CredentialEnvelope;

/**
 * Server-only credential encryption/decryption boundary (ADR-022).
 *
 * GatewayCredentialService → CredentialCipher → KeyProvider
 *
 * Routes, Server Actions, RSC/client components, audit writers, and generic serializers
 * must not call decrypt. PaymentProvider adapters may receive resolved credentials only
 * through a controlled server-side credential provider (TASK-052+).
 */
export class GatewayCredentialService {
  private readonly cipher: CredentialCipher;

  constructor(keyProvider: KeyProvider) {
    this.cipher = new CredentialCipher(keyProvider);
  }

  static fromEnv(source: EnvSource = process.env): GatewayCredentialService {
    return new GatewayCredentialService(EnvironmentKeyProvider.fromEnv(source));
  }

  /**
   * Encrypts opaque credential JSON. Fail closed when the keyring is missing/invalid.
   * Production must not silently invent KEKs.
   */
  encryptCredentials(
    payload: GatewayCredentialPayload,
    aad: CredentialEnvelopeAad,
  ): EncryptedCredentialRecord {
    const plaintext = JSON.stringify(payload);
    return this.cipher.encrypt(plaintext, aad);
  }

  /**
   * Decrypts an envelope. Fail closed on auth/tamper/AAD mismatch.
   * Do not call from routes, RSC, audit, or serializers.
   */
  decryptCredentials(
    envelope: EncryptedCredentialRecord,
    aad: CredentialEnvelopeAad,
  ): GatewayCredentialPayload {
    const plaintext = this.cipher.decrypt(envelope, aad);
    let parsed: unknown;
    try {
      parsed = JSON.parse(plaintext);
    } catch {
      throw new GatewayCredentialCryptoError("DECRYPT_FAILED");
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new GatewayCredentialCryptoError("DECRYPT_FAILED");
    }
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value !== "string") {
        throw new GatewayCredentialCryptoError("DECRYPT_FAILED");
      }
      result[key] = value;
    }
    return result;
  }
}

let cachedService: GatewayCredentialService | undefined;

/**
 * Default app singleton. Constructs from env on first use (fail closed if keyring invalid).
 */
export function getGatewayCredentialService(): GatewayCredentialService {
  if (!cachedService) {
    // Read full process.env so GATEWAY_CREDENTIALS_KEY_Vn beyond schema keys remain available.
    cachedService = GatewayCredentialService.fromEnv(process.env);
  }
  return cachedService;
}

export function resetGatewayCredentialServiceCache(): void {
  cachedService = undefined;
}

/**
 * Production fail-closed helper: encryption required but no valid active KEK.
 */
export function assertGatewayCredentialsKeyringForProduction(
  appEnv: string,
  source: EnvSource = process.env,
): void {
  if (appEnv !== "production" && appEnv !== "staging") {
    return;
  }
  const keyring = parseEnvironmentKeyring(source);
  if (!keyring) {
    throw new GatewayCredentialCryptoError(
      "KEYRING_MISSING",
      "Gateway credentials keyring is required in production/staging.",
    );
  }
}

export { GatewayCredentialCryptoError };
