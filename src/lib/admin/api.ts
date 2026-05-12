function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function unwrapPayload<T>(payload: unknown): T {
  if (!isObject(payload)) return payload as T;
  if ("data" in payload) return payload.data as T;
  if ("result" in payload) return payload.result as T;
  return payload as T;
}

function readErrorMessage(payload: unknown): string | null {
  if (!isObject(payload)) return null;

  if (typeof payload.message === "string") return payload.message;

  const errorValue = payload.error;
  if (typeof errorValue === "string") return errorValue;
  if (isObject(errorValue) && typeof errorValue.message === "string") return errorValue.message;

  return null;
}

export async function parseApiResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  let payload: unknown = {};

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { message: text };
    }
  }

  if (!response.ok) {
    throw new Error(readErrorMessage(payload) ?? "Request failed");
  }

  return unwrapPayload<T>(payload);
}

export async function callApi<T>(path: string, init?: RequestInit, bearer?: string): Promise<T> {
  const response = await fetch(`/api/proxy/${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
    },
    cache: "no-store",
  });

  return parseApiResponse<T>(response);
}
