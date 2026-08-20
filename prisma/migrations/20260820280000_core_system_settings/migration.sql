-- TASK-013 core system settings.
-- Persist reporting currency, timezone defaults, and rounding tolerance placeholder.
-- Do not lock ADR-011: USD seed is the Definitions recommendation and remains Admin-configurable.
-- No fixed conversion rates, gateway credentials, or unencrypted secrets.
-- Adds settings.manage (Admin only) for System settings authorization.

INSERT INTO "permissions" ("id", "code", "name") VALUES
    ('bbbbbbbb-bbbb-4bbb-8bbb-000000000021', 'settings.manage', 'Manage system settings');

INSERT INTO "role_permissions" ("role_id", "permission_id")
VALUES (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    'bbbbbbbb-bbbb-4bbb-8bbb-000000000021'
);

CREATE TABLE "system_settings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "reporting_currency_code" TEXT NOT NULL,
    "default_timezone" TEXT NOT NULL,
    "rounding_tolerance" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- Singleton seed row. Currency code is free text until TASK-014 currency master.
INSERT INTO "system_settings" (
    "id",
    "reporting_currency_code",
    "default_timezone",
    "rounding_tolerance"
) VALUES (
    'cccccccc-cccc-4ccc-8ccc-000000000001',
    'USD',
    'UTC',
    0
);
