export class BffError extends Error {
  constructor(public status: number, public bodyText: string) {
    super(bodyText || `BFF request failed (${status})`);
  }
}

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split("=").slice(1).join("=")) : null;
}

async function bffRequest<T = any>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers);

  if (options.body && !(options.body instanceof FormData)) {
    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
  }

  const branchId = getCookie("activeBranchId") ?? getCookie("branchId");
  const token = getCookie("token");

  if (branchId && !headers.has("X-Branch-Id")) {
    headers.set("X-Branch-Id", branchId);
  }

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: "include",
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new BffError(res.status, text);
  }

  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

export const bffClient = {
  get: <T = any>(url: string) => bffRequest<T>(url),
  post: <T = any>(url: string, body: any) =>
    bffRequest<T>(url, { method: "POST", body: JSON.stringify(body) }),
  put: <T = any>(url: string, body: any) =>
    bffRequest<T>(url, { method: "PUT", body: JSON.stringify(body) }),
  patch: <T = any>(url: string, body: any) =>
    bffRequest<T>(url, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T = any>(url: string) => bffRequest<T>(url, { method: "DELETE" }),
};

export const bffGet = bffClient.get;
