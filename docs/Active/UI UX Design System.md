---
type: technical
status: approved
tags:
  - technical
  - frontend
  - ui
---

# UI / UX Design System

Authoritative frontend presentation standard for the multi-brand invoice SaaS. Product behavior remains in module and foundation notes. Stack choices remain in [[05 Architecture Decisions]].

## Checkpoint

**UI/UX Foundation Refresh — before TASK-042**

Established after [[TASK-041 Email Delivery]] and **before** [[TASK-042 Email Invoice UI]]. This is a presentation/foundation checkpoint, not a numbered product task. It does **not** renumber, replace, or start TASK-042.

- [[TASK-041 Email Delivery]] — COMPLETE
- [[TASK-042 Email Invoice UI]] — COMPLETE (built on this design system)
- [[TASK-043 Invoice Duplicate and Print]] — COMPLETE (Duplicate button + PDF Print/Download reuse shared Button/Card patterns)

## Purpose

Replace scaffold-like screens with a professional, reusable B2B SaaS design system so TASK-042 and all later UI work inherit consistent layout, tokens, tables, forms, status, and detail patterns.

## Stack (accepted — do not replace)

- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn/ui (New York style)
- Lucide icons
- React Hook Form + Zod
- TanStack Table where list density requires it

Do not introduce another UI framework.

## Design direction

Serious multi-brand financial/admin software:

- Clear hierarchy and information density
- Restrained visual language (no decorative gradients, oversized card grids, or page-specific styling)
- Semantic design tokens (background, surface, border, foreground, muted, primary, destructive, success, warning, info)
- Consistent spacing, alignment, and typography
- Responsive shell with desktop sidebar and mobile navigation

Avoid: default shadcn demo aesthetics as the product look, generic admin templates, inconsistent page languages, and UI that reduces density for decoration.

## Application shell

Shared authenticated shell (`AppShell`):

- Desktop sidebar with grouped navigation (Overview, Operations, Organization, Settings)
- Responsive/mobile navigation drawer
- Top bar: company context switcher, account/sign-out
- Active route highlighting
- Permission-gated nav items (visibility only — server auth remains authoritative)

## Page layout

Use shared page primitives:

- `PageFrame` — content width and vertical rhythm
- `PageHeader` — title, description, primary/secondary actions, optional breadcrumbs
- Section spacing via design tokens / shared gaps

Do not invent per-page max-widths or header layouts unless extending the system.

## Shared patterns

| Pattern | Intent |
| --- | --- |
| Cards / panels | Standard, metric, detail/summary, configuration |
| Data tables | Header, search/filters slot, status, row actions, empty/loading, pagination-ready |
| Forms | Grouped sections, labels/help, validation, required markers, action footer, destructive actions separated |
| Status badges | Active, Inactive, Draft, Issued, Overdue, Cancelled, Paid, Partially Paid, Pending, Failed, Successful, and related domain states |
| Feedback | Empty, skeleton/loading, error, confirm / destructive confirm, success/error alerts |
| Detail pages | Identity header → status → metrics → sections/history → actions |

## Implementation map

| Area | Location |
| --- | --- |
| Tokens | `src/app/globals.css` |
| Primitives | `src/components/ui/*` |
| Layout | `src/components/layout/*` |
| Data display | `src/components/data/*` |
| Forms | `src/components/forms/*` |
| Feedback | `src/components/feedback/*` |
| Cursor rule | `.cursor/rules/ui-ux.mdc` |

## Future development rule (TASK-042+)

**All TASK-042 and later frontend implementations must reuse this design system.**

Do not introduce arbitrary page layouts, card styles, form styles, table styles, status colors, spacing systems, typography systems, or navigation patterns unless the design system is intentionally extended with reusable primitives.

The system may evolve as modules need new patterns; extensions must be shared, not one-off page hacks.

## Non-goals (this checkpoint)

Does not change RBAC, tenant isolation, company authorization, financial calculations, invoice lifecycle/numbering, audit behavior, customer scoping, payment architecture, Supabase Auth, or Prisma financial models. Server-side authorization and validation remain authoritative. Presentation only.

## Related

- [[Engineering Rules]]
- [[Screen Inventory]]
- [[02 Architecture]]
- [[04 Implementation Status]]
- [[06 Development Log]]
