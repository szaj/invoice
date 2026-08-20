import type { RoleCode } from "@/domain/authz/roles";

export type ManagedUserStatus = "ACTIVE" | "SUSPENDED";

/**
 * Application user record for Admin management.
 * passwordResetRequired is a workflow flag, not a permission.
 * companyIds are application assignments; they do not limit Admin ALL access.
 */
export interface ManagedUser {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly supabaseAuthUserId: string;
  readonly status: ManagedUserStatus;
  readonly roleCode: RoleCode | null;
  readonly roleName: string | null;
  readonly employeeId: string | null;
  readonly mfaEnabled: boolean;
  readonly lastLoginAt: Date | null;
  readonly passwordResetRequired: boolean;
  readonly createdByUserId: string | null;
  readonly companyIds: readonly string[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export const ACCOUNT_SUSPENDED_MESSAGE = "This account is suspended.";
export const USER_NOT_FOUND_MESSAGE = "User not found.";
export const USER_EMAIL_IN_USE_MESSAGE = "A user with this email already exists.";
export const USER_MANAGEMENT_UNAVAILABLE = "User management is temporarily unavailable.";
export const USER_INVALID_INPUT = "Check the user details and try again.";
export const USER_COMPANY_ASSIGNMENT_INVALID = "One or more assigned companies are invalid.";
