// Same-origin `/api` proxy (see next.config rewrites) so auth cookies stick on refresh.
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api";

export async function apiFetch<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const reason =
      typeof data.reason === "string"
        ? data.reason.replace(/_/g, " ")
        : null;
    const fallback =
      res.status === 500 && Object.keys(data).length === 0
        ? "API unavailable — is the backend running?"
        : `Request failed (${res.status})`;
    throw new Error(
      typeof data.error === "string"
        ? data.error
        : typeof data.message === "string"
          ? data.message
          : reason
            ? reason.charAt(0).toUpperCase() + reason.slice(1)
            : fallback
    );
  }
  return data as T;
}
