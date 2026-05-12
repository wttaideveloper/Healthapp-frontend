import { callApi } from "@/lib/admin/api";
import { EntitlementResponse } from "@/types/admin";

export async function getMyEntitlement(accessToken: string): Promise<EntitlementResponse> {
  return callApi<EntitlementResponse>("entitlements/me", { method: "GET" }, accessToken);
}

export function hasWorkspaceAccess(entitlement: EntitlementResponse | null): boolean {
  return entitlement?.hasAccess === true && entitlement.source === "workspace";
}
