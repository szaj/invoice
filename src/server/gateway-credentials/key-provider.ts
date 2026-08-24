/**
 * ADR-022 KeyProvider: resolve versioned KEKs for envelope encryption.
 * KEKs must never be logged, audited, returned, or stored in PostgreSQL.
 */

export const GATEWAY_CREDENTIALS_ENCRYPTION_FORMAT_VERSION = 1;

export class GatewayCredentialCryptoError extends Error {
  readonly code:
    | "KEYRING_MISSING"
    | "KEY_VERSION_MISSING"
    | "KEY_INVALID"
    | "DECRYPT_FAILED"
    | "ENCRYPT_FAILED"
    | "UNSUPPORTED_FORMAT";

  constructor(
    code: GatewayCredentialCryptoError["code"],
    message = "Gateway credential cryptography failed.",
  ) {
    super(message);
    this.name = "GatewayCredentialCryptoError";
    this.code = code;
  }
}

export interface KeyProvider {
  /** Active KEK version for new encryption. */
  getActiveKeyVersion(): number;
  /** Resolve a KEK by version. Fail closed when missing/invalid. */
  getKey(version: number): Buffer;
}

export type EnvironmentKeyringSource = {
  readonly GATEWAY_CREDENTIALS_KEY_VERSION?: string | number;
  readonly [key: string]: string | number | undefined;
};

const KEY_ENV_PATTERN = /^GATEWAY_CREDENTIALS_KEY_V(\d+)$/;

function decodeKekBase64(value: string, version: number): Buffer {
  let raw: Buffer;
  try {
    raw = Buffer.from(value, "base64");
  } catch {
    throw new GatewayCredentialCryptoError(
      "KEY_INVALID",
      `Gateway credentials KEK version ${version} is invalid.`,
    );
  }
  if (raw.length !== 32) {
    throw new GatewayCredentialCryptoError(
      "KEY_INVALID",
      `Gateway credentials KEK version ${version} must be a base64-encoded 32-byte key.`,
    );
  }
  return raw;
}

/**
 * Parses the ADR-022 versioned env keyring.
 * Does not invent ephemeral keys. Returns null when no keyring is configured.
 */
export function parseEnvironmentKeyring(
  source: EnvironmentKeyringSource,
): { activeVersion: number; keys: Map<number, Buffer> } | null {
  const versionRaw = source.GATEWAY_CREDENTIALS_KEY_VERSION;
  if (versionRaw === undefined || versionRaw === "") {
    return null;
  }

  const activeVersion =
    typeof versionRaw === "number" ? versionRaw : Number.parseInt(String(versionRaw).trim(), 10);
  if (!Number.isInteger(activeVersion) || activeVersion < 1) {
    throw new GatewayCredentialCryptoError(
      "KEY_INVALID",
      "GATEWAY_CREDENTIALS_KEY_VERSION must be a positive integer.",
    );
  }

  const keys = new Map<number, Buffer>();
  for (const [envKey, envValue] of Object.entries(source)) {
    const match = KEY_ENV_PATTERN.exec(envKey);
    if (!match || envValue === undefined || envValue === "") {
      continue;
    }
    const version = Number.parseInt(match[1]!, 10);
    if (!Number.isInteger(version) || version < 1) {
      continue;
    }
    keys.set(version, decodeKekBase64(String(envValue).trim(), version));
  }

  if (!keys.has(activeVersion)) {
    throw new GatewayCredentialCryptoError(
      "KEY_VERSION_MISSING",
      `Active gateway credentials KEK version ${activeVersion} is not configured.`,
    );
  }

  return { activeVersion, keys };
}

/**
 * Server-only KeyProvider backed by GATEWAY_CREDENTIALS_KEY_VERSION / _Vn.
 */
export class EnvironmentKeyProvider implements KeyProvider {
  private readonly activeVersion: number;
  private readonly keys: Map<number, Buffer>;

  constructor(keyring: { activeVersion: number; keys: Map<number, Buffer> }) {
    this.activeVersion = keyring.activeVersion;
    this.keys = keyring.keys;
  }

  static fromEnv(source: EnvironmentKeyringSource): EnvironmentKeyProvider {
    const keyring = parseEnvironmentKeyring(source);
    if (!keyring) {
      throw new GatewayCredentialCryptoError(
        "KEYRING_MISSING",
        "Gateway credentials keyring is not configured.",
      );
    }
    return new EnvironmentKeyProvider(keyring);
  }

  getActiveKeyVersion(): number {
    return this.activeVersion;
  }

  getKey(version: number): Buffer {
    const key = this.keys.get(version);
    if (!key) {
      throw new GatewayCredentialCryptoError(
        "KEY_VERSION_MISSING",
        `Gateway credentials KEK version ${version} is not available.`,
      );
    }
    return Buffer.from(key);
  }
}
