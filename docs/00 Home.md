---
type: home
status: approved
aliases:
  - Home
  - Dashboard
tags:
  - product
---

# Multi-Brand Invoice SaaS

Internal development vault for the multi-brand invoicing and payment-management platform. This note is the control dashboard, not the requirements dump.

## Project Control

- [[01 Master Spec]]
- [[02 Architecture]]
- [[03 Implementation Plan]]
- [[04 Implementation Status]]
- [[05 Architecture Decisions]]
- [[06 Development Log]]

## Product

- [[Product Overview]]
- [[Product Goals]]
- [[Definitions]]
- [[Screen Inventory]]
- [[Out of Scope]]

## Foundation

- [[Roles and Permissions]]
- [[Companies and Brands]]
- [[Currency and Conversion]]
- [[Data Model]]
- [[Business Rules]]

## Core Modules

- [[Customers]]
- [[Invoices]]
- [[PDF and Email]]
- [[Payments]]
- [[Refunds Disputes Chargebacks]]
- [[Compliance]]
- [[Audit Logs]]
- [[Dashboard and Reporting]]
- [[Notifications]]
- [[Settings]]

## Technical

- [[API and Integrations]]
- [[Security]]
- [[Error Handling]]
- [[Testing]]
- [[Deployment]]
- [[Database]]
- [[Engineering Rules]]
- [[UI UX Design System]]
- [[Authentication]]
- [[Authorization]]

## Development Phases

- [[Phase 01 Foundation]]
- [[Phase 02 Financial Foundation]]
- [[Phase 03 Customers]]
- [[Phase 04 Invoicing]]
- [[Phase 05 Payments]]
- [[Phase 06 Payment Adjustments]]
- [[Phase 07 Compliance and Audit]]
- [[Phase 08 Reporting]]
- [[Phase 09 Hardening and Deployment]]

## Visual Map

- [[Architecture]] — canvas map of product, foundation, module, and technical notes

## Current Development

Current Phase: Phase 05 — Payments

Current Task: [[TASK-045 Payment Service]] (NOT STARTED)

Current Status: [[TASK-044 Payment Domain Schema]] is COMPLETE. Next buildable task is [[TASK-045 Payment Service]]. ADR-009 / ADR-010 / ADR-011 remain OPEN.

Next Task: [[TASK-045 Payment Service]]

Do not start TASK-045 until ready.

## Blocked Items

None currently recorded.

## Critical Rules

- Company isolation is enforced server-side. See [[Roles and Permissions]], [[Companies and Brands]], [[Security]].
- Confirmed financial records are immutable. See [[Invoices]], [[Payments]], [[Business Rules]].
- Conversion rates are Admin-defined, versioned, and snapshotted. See [[Currency and Conversion]].
- Merchant fees never change invoice balance, rate, or converted settlement. See [[Payments]].
- Refunds, disputes, and chargebacks create linked adjustments. See [[Refunds Disputes Chargebacks]].

## Source / Reference

Historical source notes (not implementation-control documents):

- [[Original Home]]
- [[multi_brand_invoice_saas_development_spec]]
- [[Unresolved Source Items]]
