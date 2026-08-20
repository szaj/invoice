import "server-only";

import { randomUUID } from "node:crypto";

import { logger } from "@/lib/logger";
import { assertPermission, type AuthorizationPrincipal } from "@/domain/authz/authorize";
import { companyIdSchema } from "@/domain/companies/company-schema";
import { companyBrandingWriteSchema } from "@/domain/companies/branding-schema";
import { validateCompanyLogoUpload } from "@/domain/companies/logo-validation";
import {
  COMPANY_BRANDING_INVALID_INPUT,
  COMPANY_BRANDING_UNAVAILABLE,
  type CompanyBrandingRecord,
} from "@/domain/companies/branding-types";
import { COMPANY_NOT_FOUND_MESSAGE } from "@/domain/companies/types";
import { PrismaCompanyBrandingStore } from "@/server/companies/branding-repository";
import { createStorageService } from "@/server/storage/create-storage-service";
import type { StorageService } from "@/server/storage/storage-service";

export type CompanyBrandingResult<T> =
  { ok: true; data: T } | { ok: false; status: 400 | 403 | 404 | 503; error: string };

export interface CompanyBrandingDependencies {
  readonly store: Pick<
    PrismaCompanyBrandingStore,
    "getBrandingByCompanyId" | "updateBranding" | "setLogoMetadata"
  >;
  readonly storage: Pick<StorageService, "putObject" | "deleteObject" | "getObject">;
}

export function createDefaultCompanyBrandingDependencies(): CompanyBrandingDependencies {
  return {
    store: new PrismaCompanyBrandingStore(),
    storage: createStorageService(),
  };
}

function requireCompanyWrite(actor: AuthorizationPrincipal | null) {
  assertPermission(actor, "company.write");
}

function logoExtension(mimeType: string): string {
  switch (mimeType) {
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    default:
      return "bin";
  }
}

export async function getCompanyBranding(
  actor: AuthorizationPrincipal | null,
  companyId: string,
  deps: CompanyBrandingDependencies = createDefaultCompanyBrandingDependencies(),
): Promise<CompanyBrandingResult<CompanyBrandingRecord>> {
  try {
    requireCompanyWrite(actor);
    const parsedId = companyIdSchema.safeParse(companyId);
    if (!parsedId.success) {
      return { ok: false, status: 404, error: COMPANY_NOT_FOUND_MESSAGE };
    }

    const branding = await deps.store.getBrandingByCompanyId(parsedId.data);
    if (!branding) {
      return { ok: false, status: 404, error: COMPANY_NOT_FOUND_MESSAGE };
    }
    return { ok: true, data: branding };
  } catch (error) {
    return toAuthzOrUnavailable(error);
  }
}

export async function updateCompanyBranding(
  actor: AuthorizationPrincipal | null,
  companyId: string,
  input: unknown,
  deps: CompanyBrandingDependencies = createDefaultCompanyBrandingDependencies(),
): Promise<CompanyBrandingResult<CompanyBrandingRecord>> {
  try {
    requireCompanyWrite(actor);
    const parsedId = companyIdSchema.safeParse(companyId);
    if (!parsedId.success) {
      return { ok: false, status: 404, error: COMPANY_NOT_FOUND_MESSAGE };
    }

    const parsed = companyBrandingWriteSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, status: 400, error: COMPANY_BRANDING_INVALID_INPUT };
    }

    const existing = await deps.store.getBrandingByCompanyId(parsedId.data);
    if (!existing) {
      return { ok: false, status: 404, error: COMPANY_NOT_FOUND_MESSAGE };
    }

    const updated = await deps.store.updateBranding(parsedId.data, parsed.data);
    logger.info(
      {
        event: "companies.branding_updated",
        actorUserId: actor?.userId,
        companyId: updated.companyId,
        invoicePrefix: updated.invoicePrefix,
        hasLogo: updated.logo !== null,
      },
      "Company branding updated",
    );
    return { ok: true, data: updated };
  } catch (error) {
    return toAuthzOrUnavailable(error);
  }
}

export async function uploadCompanyLogo(
  actor: AuthorizationPrincipal | null,
  companyId: string,
  upload: {
    readonly bytes: Uint8Array;
    readonly declaredMimeType?: string | null;
    readonly originalFilename?: string | null;
  },
  deps: CompanyBrandingDependencies = createDefaultCompanyBrandingDependencies(),
): Promise<CompanyBrandingResult<CompanyBrandingRecord>> {
  try {
    requireCompanyWrite(actor);
    const parsedId = companyIdSchema.safeParse(companyId);
    if (!parsedId.success) {
      return { ok: false, status: 404, error: COMPANY_NOT_FOUND_MESSAGE };
    }

    const validated = validateCompanyLogoUpload(upload);
    if (!validated.ok) {
      return { ok: false, status: 400, error: validated.error };
    }

    const existing = await deps.store.getBrandingByCompanyId(parsedId.data);
    if (!existing) {
      return { ok: false, status: 404, error: COMPANY_NOT_FOUND_MESSAGE };
    }

    const previousKey = existing.logo?.storageKey ?? null;
    const storageKey = `company-logos/${parsedId.data}/${randomUUID()}.${logoExtension(validated.mimeType)}`;

    await deps.storage.putObject({
      key: storageKey,
      body: validated.bytes,
      contentType: validated.mimeType,
    });

    try {
      const updated = await deps.store.setLogoMetadata(parsedId.data, {
        storageKey,
        mimeType: validated.mimeType,
        byteSize: validated.byteSize,
        originalFilename: validated.originalFilename,
        uploadedAt: new Date(),
      });

      if (previousKey && previousKey !== storageKey) {
        try {
          await deps.storage.deleteObject(previousKey);
        } catch (cleanupError) {
          logger.warn(
            {
              event: "companies.logo_cleanup_failed",
              companyId: parsedId.data,
              storageKey: previousKey,
              err: cleanupError instanceof Error ? cleanupError.message : "unknown",
            },
            "Failed to delete previous company logo object",
          );
        }
      }

      logger.info(
        {
          event: "companies.logo_uploaded",
          actorUserId: actor?.userId,
          companyId: updated.companyId,
          mimeType: validated.mimeType,
          byteSize: validated.byteSize,
        },
        "Company logo uploaded",
      );
      return { ok: true, data: updated };
    } catch (error) {
      try {
        await deps.storage.deleteObject(storageKey);
      } catch {
        // best-effort rollback of orphaned object
      }
      throw error;
    }
  } catch (error) {
    return toAuthzOrUnavailable(error);
  }
}

export async function removeCompanyLogo(
  actor: AuthorizationPrincipal | null,
  companyId: string,
  deps: CompanyBrandingDependencies = createDefaultCompanyBrandingDependencies(),
): Promise<CompanyBrandingResult<CompanyBrandingRecord>> {
  try {
    requireCompanyWrite(actor);
    const parsedId = companyIdSchema.safeParse(companyId);
    if (!parsedId.success) {
      return { ok: false, status: 404, error: COMPANY_NOT_FOUND_MESSAGE };
    }

    const existing = await deps.store.getBrandingByCompanyId(parsedId.data);
    if (!existing) {
      return { ok: false, status: 404, error: COMPANY_NOT_FOUND_MESSAGE };
    }

    const previousKey = existing.logo?.storageKey ?? null;
    const updated = await deps.store.setLogoMetadata(parsedId.data, null);

    if (previousKey) {
      try {
        await deps.storage.deleteObject(previousKey);
      } catch (cleanupError) {
        logger.warn(
          {
            event: "companies.logo_cleanup_failed",
            companyId: parsedId.data,
            storageKey: previousKey,
            err: cleanupError instanceof Error ? cleanupError.message : "unknown",
          },
          "Failed to delete company logo object",
        );
      }
    }

    logger.info(
      {
        event: "companies.logo_removed",
        actorUserId: actor?.userId,
        companyId: updated.companyId,
      },
      "Company logo removed",
    );
    return { ok: true, data: updated };
  } catch (error) {
    return toAuthzOrUnavailable(error);
  }
}

function toAuthzOrUnavailable(
  error: unknown,
  fallbackUnavailable: string = COMPANY_BRANDING_UNAVAILABLE,
): { ok: false; status: 403 | 503; error: string } {
  if (error && typeof error === "object" && "status" in error && "message" in error) {
    const status = error.status;
    if (status === 401 || status === 403) {
      return {
        ok: false,
        status: 403,
        error:
          typeof error.message === "string"
            ? error.message
            : "You do not have permission to perform this action.",
      };
    }
  }

  logger.error(
    {
      event: "companies.branding_unavailable",
      err: error instanceof Error ? error.message : "unknown",
    },
    "Company branding failed",
  );
  return { ok: false, status: 503, error: fallbackUnavailable };
}
