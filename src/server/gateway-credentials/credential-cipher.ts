import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import {
  GATEWAY_CREDENTIALS_ENCRYPTION_FORMAT_VERSION,
  GatewayCredentialCryptoError,
  type KeyProvider,
} from "@/server/gateway-credentials/key-provider";

const GCM_NONCE_BYTES = 12;
const DEK_BYTES = 32;

export type CredentialEnvelopeAad = {
  readonly companyId: string;
  readonly methodCode: string;
};

/**
 * Persisted ADR-022 envelope material. Never return these through normal APIs.
 */
export type CredentialEnvelope = {
  readonly credentialsCiphertext: Buffer;
  readonly credentialsNonce: Buffer;
  readonly credentialsAuthTag: Buffer;
  readonly wrappedDek: Buffer;
  readonly dekWrapNonce: Buffer;
  readonly dekWrapAuthTag: Buffer;
  readonly kekKeyVersion: number;
  readonly encryptionFormatVersion: number;
};

function buildCredentialAad(aad: CredentialEnvelopeAad): Buffer {
  return Buffer.from(`cred|${aad.companyId}|${aad.methodCode}`, "utf8");
}

function buildDekWrapAad(aad: CredentialEnvelopeAad): Buffer {
  return Buffer.from(`dek|${aad.companyId}|${aad.methodCode}`, "utf8");
}

function aesGcmEncrypt(
  key: Buffer,
  plaintext: Buffer,
  aad: Buffer,
): { ciphertext: Buffer; nonce: Buffer; authTag: Buffer } {
  const nonce = randomBytes(GCM_NONCE_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  cipher.setAAD(aad);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return { ciphertext, nonce, authTag };
}

function aesGcmDecrypt(
  key: Buffer,
  ciphertext: Buffer,
  nonce: Buffer,
  authTag: Buffer,
  aad: Buffer,
): Buffer {
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, nonce);
    decipher.setAAD(aad);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch {
    throw new GatewayCredentialCryptoError("DECRYPT_FAILED");
  }
}

/**
 * Low-level envelope cipher (ADR-022).
 * Encrypts opaque credential payloads with a random DEK wrapped by the active KEK.
 */
export class CredentialCipher {
  constructor(private readonly keyProvider: KeyProvider) {}

  encrypt(plaintextUtf8: string, aad: CredentialEnvelopeAad): CredentialEnvelope {
    try {
      const dek = randomBytes(DEK_BYTES);
      const kekVersion = this.keyProvider.getActiveKeyVersion();
      const kek = this.keyProvider.getKey(kekVersion);
      const credentialAad = buildCredentialAad(aad);
      const dekAad = buildDekWrapAad(aad);

      const encrypted = aesGcmEncrypt(dek, Buffer.from(plaintextUtf8, "utf8"), credentialAad);
      const wrapped = aesGcmEncrypt(kek, dek, dekAad);

      return {
        credentialsCiphertext: encrypted.ciphertext,
        credentialsNonce: encrypted.nonce,
        credentialsAuthTag: encrypted.authTag,
        wrappedDek: wrapped.ciphertext,
        dekWrapNonce: wrapped.nonce,
        dekWrapAuthTag: wrapped.authTag,
        kekKeyVersion: kekVersion,
        encryptionFormatVersion: GATEWAY_CREDENTIALS_ENCRYPTION_FORMAT_VERSION,
      };
    } catch (error) {
      if (error instanceof GatewayCredentialCryptoError) {
        throw error;
      }
      throw new GatewayCredentialCryptoError("ENCRYPT_FAILED");
    }
  }

  decrypt(envelope: CredentialEnvelope, aad: CredentialEnvelopeAad): string {
    if (envelope.encryptionFormatVersion !== GATEWAY_CREDENTIALS_ENCRYPTION_FORMAT_VERSION) {
      throw new GatewayCredentialCryptoError("UNSUPPORTED_FORMAT");
    }

    const kek = this.keyProvider.getKey(envelope.kekKeyVersion);
    const credentialAad = buildCredentialAad(aad);
    const dekAad = buildDekWrapAad(aad);

    const dek = aesGcmDecrypt(
      kek,
      envelope.wrappedDek,
      envelope.dekWrapNonce,
      envelope.dekWrapAuthTag,
      dekAad,
    );

    const plaintext = aesGcmDecrypt(
      dek,
      envelope.credentialsCiphertext,
      envelope.credentialsNonce,
      envelope.credentialsAuthTag,
      credentialAad,
    );

    return plaintext.toString("utf8");
  }
}
