"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { StatusBadge } from "@/components/data/status-badge";
import { FormField } from "@/components/forms/form-section";
import { DetailSection } from "@/components/layout/detail";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import {
  COMPLIANCE_STATUSES,
  type ComplianceReviewSubjectType,
  type ComplianceStatus,
} from "@/domain/compliance/types";
import {
  addComplianceNoteAction,
  updateComplianceStatusAction,
  type ComplianceReviewNoteView,
} from "@/server/compliance/actions";

const STATUS_LABELS: Record<ComplianceStatus, string> = {
  NOT_REVIEWED: "Not reviewed",
  UNDER_REVIEW: "Under review",
  APPROVED: "Approved",
  FLAGGED: "Flagged",
};

type ComplianceReviewPanelProps = {
  readonly subjectType: ComplianceReviewSubjectType;
  readonly subjectId: string;
  readonly companyId: string;
  readonly currentStatus: ComplianceStatus;
  readonly canReview: boolean;
  readonly notes: readonly ComplianceReviewNoteView[];
};

export function ComplianceReviewPanel({
  subjectType,
  subjectId,
  companyId,
  currentStatus,
  canReview,
  notes,
}: ComplianceReviewPanelProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [status, setStatus] = useState<ComplianceStatus>(currentStatus);
  const [notesText, setNotesText] = useState("");
  const [reason, setReason] = useState("");
  const [resolutionNotes, setResolutionNotes] = useState("");

  function resetFields() {
    setNotesText("");
    setReason("");
    setResolutionNotes("");
  }

  function runAction(run: () => Promise<{ ok: boolean; error?: string; message?: string }>) {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await run();
      if (!result.ok) {
        setError(result.error ?? "Request failed.");
        return;
      }
      setSuccess(result.message ?? "Saved.");
      resetFields();
      router.refresh();
    });
  }

  function onUpdateStatus() {
    runAction(() =>
      updateComplianceStatusAction({
        subjectType,
        subjectId,
        companyId,
        status,
        notes: notesText.trim() || null,
        reason: reason.trim() || null,
        resolutionNotes: resolutionNotes.trim() || null,
      }),
    );
  }

  function onAddNote() {
    runAction(() =>
      addComplianceNoteAction({
        subjectType,
        subjectId,
        companyId,
        notes: notesText.trim() || null,
        reason: reason.trim() || null,
        resolutionNotes: resolutionNotes.trim() || null,
      }),
    );
  }

  function onQuickStatus(next: "APPROVED" | "FLAGGED" | "UNDER_REVIEW") {
    setStatus(next);
    runAction(() =>
      updateComplianceStatusAction({
        subjectType,
        subjectId,
        companyId,
        status: next,
        notes: notesText.trim() || null,
        reason: reason.trim() || null,
        resolutionNotes: resolutionNotes.trim() || null,
      }),
    );
  }

  return (
    <div className="grid gap-4">
      <DetailSection
        title="Review actions"
        description="Approve, flag, or set under review. Notes and reason codes are optional on status change; at least one note field is required when adding a note only."
      >
        {!canReview ? (
          <Alert>
            <AlertDescription>
              You do not have permission to change compliance status.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="grid gap-4">
            <div className="flex flex-wrap gap-2">
              <Button type="button" disabled={pending} onClick={() => onQuickStatus("APPROVED")}>
                Approve
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={pending}
                onClick={() => onQuickStatus("FLAGGED")}
              >
                Flag
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => onQuickStatus("UNDER_REVIEW")}
              >
                Mark under review
              </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Status" htmlFor="compliance-status">
                <NativeSelect
                  id="compliance-status"
                  value={status}
                  disabled={pending}
                  onChange={(event) => setStatus(event.target.value as ComplianceStatus)}
                >
                  {COMPLIANCE_STATUSES.map((value) => (
                    <option key={value} value={value}>
                      {STATUS_LABELS[value]}
                    </option>
                  ))}
                </NativeSelect>
              </FormField>
              <FormField
                label="Reason code"
                htmlFor="compliance-reason"
                hint="Short code or category."
              >
                <Input
                  id="compliance-reason"
                  maxLength={200}
                  value={reason}
                  disabled={pending}
                  onChange={(event) => setReason(event.target.value)}
                />
              </FormField>
              <FormField label="Notes" htmlFor="compliance-notes" className="sm:col-span-2">
                <Textarea
                  id="compliance-notes"
                  value={notesText}
                  disabled={pending}
                  maxLength={4000}
                  onChange={(event) => setNotesText(event.target.value)}
                />
              </FormField>
              <FormField
                label="Resolution notes"
                htmlFor="compliance-resolution"
                className="sm:col-span-2"
              >
                <Textarea
                  id="compliance-resolution"
                  value={resolutionNotes}
                  disabled={pending}
                  maxLength={4000}
                  onChange={(event) => setResolutionNotes(event.target.value)}
                />
              </FormField>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={pending || status === currentStatus}
                onClick={onUpdateStatus}
              >
                Update status
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={
                  pending ||
                  (notesText.trim().length === 0 &&
                    reason.trim().length === 0 &&
                    resolutionNotes.trim().length === 0)
                }
                onClick={onAddNote}
              >
                Add note only
              </Button>
            </div>

            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            {success ? (
              <Alert>
                <AlertDescription>{success}</AlertDescription>
              </Alert>
            ) : null}
          </div>
        )}
      </DetailSection>

      <DetailSection
        title="Review history"
        description="Status changes and notes for this record. Audit logs are not editable here."
      >
        {notes.length === 0 ? (
          <p className="text-muted-foreground text-sm">No compliance notes yet.</p>
        ) : (
          <ul className="grid gap-3">
            {notes.map((note) => (
              <li key={note.id} className="border-border rounded-md border p-3 text-sm">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <StatusBadge status={note.status} />
                  {note.reason ? (
                    <span className="text-muted-foreground text-xs">Reason: {note.reason}</span>
                  ) : null}
                </div>
                {note.notes ? <p className="whitespace-pre-wrap">{note.notes}</p> : null}
                {note.resolutionNotes ? (
                  <p className="mt-2 whitespace-pre-wrap">
                    <span className="text-muted-foreground text-xs uppercase">Resolution · </span>
                    {note.resolutionNotes}
                  </p>
                ) : null}
                <p className="text-muted-foreground mt-2 text-xs">
                  {note.createdAt.replace("T", " ").slice(0, 19)} UTC
                  {note.reviewerUserId ? ` · reviewer ${note.reviewerUserId.slice(0, 8)}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </DetailSection>
    </div>
  );
}
