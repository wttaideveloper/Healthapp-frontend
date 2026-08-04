import { callApi } from "@/lib/admin/api";
import type { WorkspaceMember } from "@/types/admin";

/**
 * Platform-wide member coverage, built from the endpoints that already exist.
 *
 * BACKEND LIMITATION: the API has no "all members" route. Member-level analytics
 * (pending invitations, role mix, revocations, joins) therefore require reading
 * each workspace's member list individually:
 *
 *   platform admin  -> GET admin/workspaces/:id/members
 *   workspace admin -> GET workspaces/:id/members
 *
 * NO NEW ENDPOINT IS INTRODUCED. This is a bounded fan-out over existing routes,
 * run only when an administrator explicitly asks for it, so the dashboard never
 * silently issues N requests on load. A single `GET admin/members` (or a member
 * summary embedded in `GET admin/workspaces`) would replace this entirely.
 */

export type MemberScanFailure = {
  workspaceId: string;
  workspaceName: string;
  message: string;
};

export type MemberScanResult = {
  members: WorkspaceMember[];
  coveredCount: number;
  requestedCount: number;
  failures: MemberScanFailure[];
  scannedAt: string;
};

export type MemberScanTarget = { id: string; name: string };

/** Kept low so a large tenant list cannot swamp the API or the browser. */
const DEFAULT_CONCURRENCY = 4;

export function memberRouteFor(workspaceId: string, isPlatformAdmin: boolean): string {
  return isPlatformAdmin
    ? `admin/workspaces/${workspaceId}/members`
    : `workspaces/${workspaceId}/members`;
}

export async function scanWorkspaceMembers(input: {
  token: string;
  workspaces: MemberScanTarget[];
  isPlatformAdmin: boolean;
  concurrency?: number;
  signal?: AbortSignal;
  onProgress?: (completed: number, total: number) => void;
}): Promise<MemberScanResult> {
  const { token, workspaces, isPlatformAdmin, signal, onProgress } = input;
  const concurrency = Math.max(1, Math.min(input.concurrency ?? DEFAULT_CONCURRENCY, 8));

  const members: WorkspaceMember[] = [];
  const failures: MemberScanFailure[] = [];
  let cursor = 0;
  let completed = 0;
  let covered = 0;

  async function worker(): Promise<void> {
    while (cursor < workspaces.length) {
      if (signal?.aborted) return;
      const target = workspaces[cursor];
      cursor += 1;

      try {
        const rows = await callApi<WorkspaceMember[]>(
          memberRouteFor(target.id, isPlatformAdmin),
          { method: "GET", signal },
          token,
        );
        // Older seats may predate `workspaceId` being returned; backfill so
        // downstream grouping never loses a row.
        for (const row of rows) {
          members.push(row.workspaceId ? row : { ...row, workspaceId: target.id });
        }
        covered += 1;
      } catch (error) {
        if (signal?.aborted) return;
        failures.push({
          workspaceId: target.id,
          workspaceName: target.name,
          message: error instanceof Error ? error.message : "Member list request failed",
        });
      } finally {
        completed += 1;
        onProgress?.(completed, workspaces.length);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, workspaces.length) }, worker));

  if (signal?.aborted) throw new DOMException("Member scan cancelled", "AbortError");

  return {
    members,
    coveredCount: covered,
    requestedCount: workspaces.length,
    failures,
    scannedAt: new Date().toISOString(),
  };
}
