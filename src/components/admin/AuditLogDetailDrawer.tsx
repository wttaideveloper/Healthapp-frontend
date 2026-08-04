"use client";

import { Drawer } from "@/components/ui/Drawer";
import { Icon } from "@/components/ui/Icon";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  auditActionIcon,
  auditActionLabel,
  auditActorLabel,
  auditResourceLabel,
  extractAuditChanges,
  formatAuditMetadata,
  isSystemActor,
} from "@/lib/admin/audit";
import { formatDateTime } from "@/lib/format";
import type { AuditLog } from "@/types/admin";

/**
 * Full detail for one audit event.
 *
 * Reuses the shared `Drawer`, which already implements the dialog contract
 * (Escape, focus trap, focus restore, scroll lock), so this file only supplies
 * content. Nothing is derived or inferred here — every value shown is a column on
 * the record, and a missing value renders as "—" rather than being hidden.
 */

type AuditLogDetailDrawerProps = {
  log: AuditLog | null;
  onClose: () => void;
  /** Copies a value; the view supplies the toast. */
  onCopy: (value: string, label: string) => void;
};

function DetailRow({
  label,
  value,
  mono = false,
  copyable,
  onCopy,
}: {
  label: string;
  value: string | null;
  mono?: boolean;
  copyable?: boolean;
  onCopy?: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-2.5">
      <dt className="shrink-0 text-xs text-[color:var(--text-muted)]">{label}</dt>
      <dd className="flex min-w-0 items-center gap-1.5">
        <span
          className={`truncate text-[0.8125rem] ${
            value ? "text-[color:var(--foreground)]" : "text-[color:var(--text-subtle)]"
          } ${mono ? "font-mono text-xs" : ""}`}
          title={value ?? undefined}
        >
          {value || "—"}
        </span>
        {copyable && value ? (
          <button
            type="button"
            onClick={onCopy}
            aria-label={`Copy ${label}`}
            className="ha-btn ha-btn-ghost ha-btn-sm shrink-0 px-1.5"
          >
            <Icon name="copy" size={12} />
          </button>
        ) : null}
      </dd>
    </div>
  );
}

export function AuditLogDetailDrawer({ log, onClose, onCopy }: AuditLogDetailDrawerProps) {
  if (!log) return null;

  const changes = extractAuditChanges(log.metadata);
  const metadataJson = formatAuditMetadata(log.metadata);
  const isFailure = log.result === "failure";

  return (
    <Drawer
      open
      onClose={onClose}
      title={auditActionLabel(log.action)}
      subtitle={formatDateTime(log.createdAt)}
      footer={
        <div className="flex items-center justify-between gap-3">
          <span className="truncate font-mono text-[0.6875rem] text-[color:var(--text-subtle)]">{log.id}</span>
          <button
            type="button"
            onClick={() => onCopy(log.id, "Event ID")}
            className="ha-btn ha-btn-secondary ha-btn-sm shrink-0"
          >
            <Icon name="copy" size={12} />
            Copy event ID
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Headline: what happened and whether it worked. */}
        <div
          className="flex items-start gap-3 rounded-xl border p-3.5"
          style={
            isFailure
              ? { borderColor: "rgba(220,38,38,0.28)", background: "var(--danger-soft)" }
              : { borderColor: "var(--border)", background: "var(--card-2)" }
          }
        >
          <span
            aria-hidden="true"
            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
            style={
              isFailure
                ? { background: "rgba(220,38,38,0.12)", color: "var(--danger)" }
                : { background: "var(--accent-soft)", color: "var(--accent)" }
            }
          >
            <Icon name={auditActionIcon(log.action)} size={16} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[0.8125rem] font-medium text-[color:var(--foreground)]">
              {auditActionLabel(log.action)}
            </p>
            <p className="mt-0.5 font-mono text-[0.6875rem] text-[color:var(--text-subtle)]">{log.action}</p>
          </div>
          <StatusBadge value={log.result} />
        </div>

        <section aria-labelledby="audit-detail-actor">
          <h3 id="audit-detail-actor" className="ha-eyebrow">
            Actor
          </h3>
          <dl className="mt-1 divide-y divide-[color:var(--border)]">
            <DetailRow label="User" value={auditActorLabel(log)} />
            <DetailRow label="Role" value={log.actorRole} />
            <DetailRow
              label="User ID"
              value={log.actorUserId}
              mono
              copyable
              onCopy={() => log.actorUserId && onCopy(log.actorUserId, "Actor user ID")}
            />
          </dl>
          {isSystemActor(log) ? (
            <p className="mt-2 rounded-lg bg-[color:var(--muted)] px-3 py-2 text-xs leading-relaxed text-[color:var(--text-subtle)]">
              No signed-in user performed this action. It was triggered by a provider webhook, so the
              record carries a system actor rather than attributing it to an administrator.
            </p>
          ) : null}
        </section>

        <section aria-labelledby="audit-detail-resource">
          <h3 id="audit-detail-resource" className="ha-eyebrow">
            Resource
          </h3>
          <dl className="mt-1 divide-y divide-[color:var(--border)]">
            <DetailRow label="Resource" value={auditResourceLabel(log)} />
            <DetailRow label="Type" value={log.targetType} />
            <DetailRow
              label="Resource ID"
              value={log.targetId}
              mono
              copyable
              onCopy={() => log.targetId && onCopy(log.targetId, "Resource ID")}
            />
            <DetailRow label="Workspace" value={log.workspaceName} />
            <DetailRow
              label="Workspace ID"
              value={log.workspaceId}
              mono
              copyable
              onCopy={() => log.workspaceId && onCopy(log.workspaceId, "Workspace ID")}
            />
          </dl>
        </section>

        <section aria-labelledby="audit-detail-time">
          <h3 id="audit-detail-time" className="ha-eyebrow">
            Timestamp
          </h3>
          <dl className="mt-1 divide-y divide-[color:var(--border)]">
            <DetailRow label="Local" value={formatDateTime(log.createdAt)} />
            <DetailRow label="UTC (ISO 8601)" value={log.createdAt} mono />
          </dl>
        </section>

        {changes ? (
          <section aria-labelledby="audit-detail-changes">
            <h3 id="audit-detail-changes" className="ha-eyebrow">
              Changed fields
            </h3>
            <div className="mt-2 overflow-hidden rounded-lg border border-[color:var(--border)]">
              <table className="ha-table">
                <caption className="sr-only">Fields changed by this action</caption>
                <thead>
                  <tr>
                    <th scope="col">Field</th>
                    <th scope="col">From</th>
                    <th scope="col">To</th>
                  </tr>
                </thead>
                <tbody>
                  {changes.map((change) => (
                    <tr key={change.field}>
                      <td className="font-medium">{change.field}</td>
                      <td className="text-[color:var(--text-muted)]">{change.from}</td>
                      <td className="font-medium">{change.to}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        <section aria-labelledby="audit-detail-metadata">
          <h3 id="audit-detail-metadata" className="ha-eyebrow">
            Metadata
          </h3>
          {metadataJson ? (
            <pre className="ha-scroll mt-2 max-h-64 overflow-auto rounded-lg border border-[color:var(--border)] bg-[color:var(--card-2)] p-3 font-mono text-[0.6875rem] leading-relaxed text-[color:var(--foreground)]">
              {metadataJson}
            </pre>
          ) : (
            <p className="mt-2 rounded-lg bg-[color:var(--muted)] px-3 py-2 text-xs text-[color:var(--text-subtle)]">
              This action recorded no additional metadata.
            </p>
          )}
        </section>
      </div>
    </Drawer>
  );
}
