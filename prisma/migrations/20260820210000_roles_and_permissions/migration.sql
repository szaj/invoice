-- TASK-005 application RBAC catalog.
-- Authorization lives in the application database, not Supabase Auth metadata.
-- No companies, customers, invoices, payments, or credential columns.

CREATE TYPE "role_code" AS ENUM ('ADMIN', 'COMPLIANCE', 'STAFF');
CREATE TYPE "role_company_scope" AS ENUM ('ALL', 'ASSIGNED');

CREATE TABLE "roles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" "role_code" NOT NULL,
    "name" TEXT NOT NULL,
    "company_scope" "role_company_scope" NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");

CREATE TABLE "permissions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

CREATE TABLE "role_permissions" (
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

ALTER TABLE "role_permissions"
    ADD CONSTRAINT "role_permissions_role_id_fkey"
    FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "role_permissions"
    ADD CONSTRAINT "role_permissions_permission_id_fkey"
    FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "users" ADD COLUMN "role_id" UUID;

ALTER TABLE "users"
    ADD CONSTRAINT "users_role_id_fkey"
    FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "roles" ("id", "code", "name", "company_scope") VALUES
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'ADMIN', 'Admin', 'ALL'),
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', 'COMPLIANCE', 'Compliance', 'ASSIGNED'),
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', 'STAFF', 'Staff', 'ASSIGNED');

INSERT INTO "permissions" ("id", "code", "name") VALUES
    ('bbbbbbbb-bbbb-4bbb-8bbb-000000000001', 'dashboard.view', 'View dashboard'),
    ('bbbbbbbb-bbbb-4bbb-8bbb-000000000002', 'company.write', 'Create/edit company'),
    ('bbbbbbbb-bbbb-4bbb-8bbb-000000000003', 'gateway.credentials.manage', 'Manage gateway credentials'),
    ('bbbbbbbb-bbbb-4bbb-8bbb-000000000004', 'customer.create', 'Create customer'),
    ('bbbbbbbb-bbbb-4bbb-8bbb-000000000005', 'customer.edit', 'Edit customer'),
    ('bbbbbbbb-bbbb-4bbb-8bbb-000000000006', 'customer.delete', 'Delete customer (soft-delete)'),
    ('bbbbbbbb-bbbb-4bbb-8bbb-000000000007', 'invoice.create', 'Create invoice'),
    ('bbbbbbbb-bbbb-4bbb-8bbb-000000000008', 'invoice.edit_draft', 'Edit draft invoice'),
    ('bbbbbbbb-bbbb-4bbb-8bbb-000000000009', 'invoice.edit_issued', 'Edit issued invoice (controlled)'),
    ('bbbbbbbb-bbbb-4bbb-8bbb-000000000010', 'invoice.cancel', 'Cancel invoice'),
    ('bbbbbbbb-bbbb-4bbb-8bbb-000000000011', 'invoice.delete', 'Hard-delete invoice'),
    ('bbbbbbbb-bbbb-4bbb-8bbb-000000000012', 'payment.manual.record', 'Record manual payment'),
    ('bbbbbbbb-bbbb-4bbb-8bbb-000000000013', 'payment.adjust', 'Modify confirmed payment via adjustment workflow'),
    ('bbbbbbbb-bbbb-4bbb-8bbb-000000000014', 'invoice.view_assigned', 'View all assigned invoices'),
    ('bbbbbbbb-bbbb-4bbb-8bbb-000000000015', 'report.view', 'View reports'),
    ('bbbbbbbb-bbbb-4bbb-8bbb-000000000016', 'report.export', 'Export reports'),
    ('bbbbbbbb-bbbb-4bbb-8bbb-000000000017', 'compliance.review', 'Compliance review'),
    ('bbbbbbbb-bbbb-4bbb-8bbb-000000000018', 'audit.read', 'Read audit logs'),
    ('bbbbbbbb-bbbb-4bbb-8bbb-000000000019', 'user.manage', 'Manage users'),
    ('bbbbbbbb-bbbb-4bbb-8bbb-000000000020', 'currency.manage', 'Manage currencies/rates');

-- Admin: matrix Yes except invoice.delete (no hard delete).
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', "id"
FROM "permissions"
WHERE "code" <> 'invoice.delete';

-- Compliance: matrix Yes / Recommend Yes. No company, gateway, user, currency, or customer delete.
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', "id"
FROM "permissions"
WHERE "code" IN (
    'dashboard.view',
    'customer.create',
    'customer.edit',
    'invoice.create',
    'invoice.edit_draft',
    'invoice.edit_issued',
    'invoice.cancel',
    'payment.manual.record',
    'payment.adjust',
    'invoice.view_assigned',
    'report.view',
    'report.export',
    'compliance.review',
    'audit.read'
);

-- Staff: definite Yes only. Optional policies US-007..US-010 are not granted.
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', "id"
FROM "permissions"
WHERE "code" IN (
    'dashboard.view',
    'customer.create',
    'customer.edit',
    'invoice.create',
    'invoice.edit_draft',
    'report.view'
);
