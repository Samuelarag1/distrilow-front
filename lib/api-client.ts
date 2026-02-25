let authToken: string | null = null;
let activeBranchId: string | null = null;

export function setApiSession(token: string, branchId?: string) {
  authToken = token || null;
  activeBranchId = branchId || null;
}

async function request(url: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);

  headers.set("Content-Type", "application/json");

  if (authToken) {
    headers.set("Authorization", `Bearer ${authToken}`);
  }

  if (activeBranchId) {
    headers.set("X-Branch-Id", activeBranchId);
  }

  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${url}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const error = await res.text();
    console.error("API Error:", error);
    throw new Error(error || "API request failed");
  }

  return res.json();
}

export const apiClientFetch = {
  get: (url: string) => request(url),
  post: (url: string, body: any) =>
    request(url, { method: "POST", body: JSON.stringify(body) }),
  put: (url: string, body: any) =>
    request(url, { method: "PUT", body: JSON.stringify(body) }),
  delete: (url: string) => request(url, { method: "DELETE" }),
};
