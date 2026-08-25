-- TASK-068: informational adjustment notes on existing payment_adjustments.
ALTER TYPE "payment_adjustment_type" ADD VALUE IF NOT EXISTS 'NOTE';
