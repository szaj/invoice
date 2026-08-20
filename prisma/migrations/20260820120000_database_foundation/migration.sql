-- TASK-002 database foundation.
-- No application domain tables (users, companies, customers, invoices, payments).
-- Enables UUID generation for later application primary keys.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
