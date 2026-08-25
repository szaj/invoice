---
type: workflow
status: approved
tags:
  - task
---

# Vault Completion Workflow

When a numbered TASK becomes **COMPLETE**:

1. Update [[03 Current Implementation Status]] (capability line + ID ranges).
2. Update [[04 Current Plan]] (next task / phase / deferred / blockers).
3. Update [[01 Current Architecture]] / [[02 Current Product Rules]] / ADRs **only if** facts changed.
4. Append a short entry to [[06 Development Log]] (keep it recent-only; optionally mirror detail into [[06 Development Log Archive]]).
5. Move the TASK file:
   - from `docs/Active/Tasks/TASK-XXX ….md`
   - to `docs/Archive/Completed Tasks/TASK-XXX ….md`
6. Preserve filename and task ID. Do not leave completed TASK detail in Active.
7. Do **not** mark DEFERRED tasks COMPLETE. Do not delete history.

Cursor must not inspect `docs/Archive/**` during normal TASK execution.

## Proposed helper script (not created yet)

A small dry-run-first script could:

- Read TASK frontmatter `status`
- Verify destination folders exist
- Move only when `status: complete` and file is under `docs/Active/Tasks/`
- Refuse moves for `deferred` / `not-started` / missing frontmatter
- Print planned moves before applying (`-WhatIf` / `--dry-run`)

Do **not** ship a destructive auto-move script until that validation path is reviewed. Manual move after COMPLETE is acceptable.
