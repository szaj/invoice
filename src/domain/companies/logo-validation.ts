import {
  LOGO_ALLOWED_MIME_TYPES,
  LOGO_MAX_BYTES,
  type LogoAllowedMimeType,
} from "@/domain/companies/branding-types";

export type LogoValidationSuccess = {
  readonly ok: true;
  readonly mimeType: LogoAllowedMimeType;
  readonly byteSize: number;
  readonly originalFilename: string | null;
  readonly bytes: Uint8Array;
};

export type LogoValidationFailure = {
  readonly ok: false;
  readonly error: string;
};

export type LogoValidationResult = LogoValidationSuccess | LogoValidationFailure;

function hasPrefix(bytes: Uint8Array, prefix: readonly number[]): boolean {
  if (bytes.length < prefix.length) {
    return false;
  }
  return prefix.every((value, index) => bytes[index] === value);
}

function detectMimeType(bytes: Uint8Array): LogoAllowedMimeType | null {
  if (hasPrefix(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "image/png";
  }
  if (hasPrefix(bytes, [0xff, 0xd8, 0xff])) {
    return "image/jpeg";
  }
  if (
    hasPrefix(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    bytes.length >= 12 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

function normalizeDeclaredMime(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const normalized = value.trim().toLowerCase().split(";")[0]?.trim() ?? "";
  if (normalized === "image/jpg") {
    return "image/jpeg";
  }
  return normalized.length > 0 ? normalized : null;
}

function sanitizeFilename(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const base = value.replace(/\\/g, "/").split("/").pop()?.trim() ?? "";
  if (base.length === 0 || base === "." || base === "..") {
    return null;
  }
  return base.slice(0, 200);
}

/**
 * Validates logo uploads by size, declared MIME, and magic-byte content type.
 * Rejects SVG and other non-allowlisted types.
 */
export function validateCompanyLogoUpload(input: {
  readonly bytes: Uint8Array;
  readonly declaredMimeType?: string | null;
  readonly originalFilename?: string | null;
}): LogoValidationResult {
  const byteSize = input.bytes.byteLength;
  if (byteSize <= 0) {
    return { ok: false, error: "Choose a logo image to upload." };
  }
  if (byteSize > LOGO_MAX_BYTES) {
    return { ok: false, error: "Logo must be 2 MB or smaller." };
  }

  const detected = detectMimeType(input.bytes);
  if (!detected) {
    return { ok: false, error: "Logo must be a PNG, JPEG, or WebP image." };
  }

  const declared = normalizeDeclaredMime(input.declaredMimeType);
  if (declared && declared !== detected) {
    return { ok: false, error: "Logo content does not match the declared file type." };
  }

  if (!(LOGO_ALLOWED_MIME_TYPES as readonly string[]).includes(detected)) {
    return { ok: false, error: "Logo must be a PNG, JPEG, or WebP image." };
  }

  return {
    ok: true,
    mimeType: detected,
    byteSize,
    originalFilename: sanitizeFilename(input.originalFilename),
    bytes: input.bytes,
  };
}
