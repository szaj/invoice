export type RoleCredentials = {
  readonly email: string;
  readonly password: string;
};

function resolvePair(
  primaryEmail: string | undefined,
  primaryPassword: string | undefined,
  fallbackEmail: string | undefined,
  fallbackPassword: string | undefined,
): RoleCredentials | null {
  const email = primaryEmail ?? fallbackEmail;
  const password = primaryPassword ?? fallbackPassword;
  if (!email || !password) {
    return null;
  }
  return { email, password };
}

/** Admin credentials — E2E_ADMIN_* or AUTH_TEST_* fallback. */
export function resolveAdminCredentials(): RoleCredentials | null {
  return resolvePair(
    process.env.E2E_ADMIN_EMAIL,
    process.env.E2E_ADMIN_PASSWORD,
    process.env.AUTH_TEST_EMAIL,
    process.env.AUTH_TEST_PASSWORD,
  );
}

/** Staff credentials with at least one company assignment. */
export function resolveStaffCredentials(): RoleCredentials | null {
  return resolvePair(
    process.env.E2E_STAFF_EMAIL,
    process.env.E2E_STAFF_PASSWORD,
    undefined,
    undefined,
  );
}

/** Compliance credentials with assigned companies. */
export function resolveComplianceCredentials(): RoleCredentials | null {
  return resolvePair(
    process.env.E2E_COMPLIANCE_EMAIL,
    process.env.E2E_COMPLIANCE_PASSWORD,
    undefined,
    undefined,
  );
}

export function hasAdminCredentials(): boolean {
  return resolveAdminCredentials() !== null;
}

export function hasStaffCredentials(): boolean {
  return resolveStaffCredentials() !== null;
}

export function hasComplianceCredentials(): boolean {
  return resolveComplianceCredentials() !== null;
}
