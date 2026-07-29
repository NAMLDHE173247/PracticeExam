export class ApiClientError extends Error {
  constructor(
    public readonly code: string | undefined,
    message: string,
    public readonly details?: unknown,
    public readonly status?: number
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  const text = await response.text();
  let payload: { success?: boolean; data?: T; error?: { code?: string; message?: string; details?: unknown } };
  
  try {
    payload = text ? JSON.parse(text) as typeof payload : {};
  } catch {
    throw new ApiClientError(undefined, `Server returned a non-JSON response (${response.status}).`, undefined, response.status);
  }
  
  if (!response.ok || !payload.success) {
    throw new ApiClientError(
      payload.error?.code,
      payload.error?.message ?? `Request failed (${response.status}).`,
      payload.error?.details,
      response.status
    );
  }
  
  return payload.data as T;
}
