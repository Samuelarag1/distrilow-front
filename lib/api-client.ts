// let authToken: string | null = null;
// let activeBranchId: string | null = null;

// export function setApiSession(token: string | null, branchId?: string | null) {
//   authToken = token || null;

//   // ✅ si viene undefined o null => limpiamos
//   if (branchId === undefined || branchId === null || branchId === "") {
//     activeBranchId = null;
//   } else {
//     activeBranchId = branchId;
//   }
// }

// async function request(url: string, options: RequestInit = {}) {
//   const headers = new Headers(options.headers);

//   // ✅ solo setealo si realmente estás enviando JSON
//   if (!(options.body instanceof FormData)) {
//     headers.set("Content-Type", "application/json");
//   }

//   if (authToken) {
//     headers.set("Authorization", `Bearer ${authToken}`);
//   }

//   // ✅ onboarding: si no hay branch, no mandamos header
//   if (activeBranchId) {
//     headers.set("X-Branch-Id", activeBranchId);
//   }

//   const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${url}`, {
//     ...options,
//     headers,
//   });

//   if (!res.ok) {
//     const errorText = await res.text().catch(() => "");
//     console.error("API Error:", errorText);
//     throw new Error(errorText || `API request failed (${res.status})`);
//   }

//   // ✅ por si hay 204 No Content
//   const text = await res.text();
//   return text ? JSON.parse(text) : null;
// }

// export const apiClientFetch = {
//   get: (url: string) => request(url),
//   post: (url: string, body: any) =>
//     request(url, { method: "POST", body: JSON.stringify(body) }),
//   put: (url: string, body: any) =>
//     request(url, { method: "PUT", body: JSON.stringify(body) }),
//   patch: (url: string, body: any) =>
//     request(url, { method: "PATCH", body: JSON.stringify(body) }),
//   delete: (url: string) => request(url, { method: "DELETE" }),
// };
// export async function apiGet<T>(url: string): Promise<T> {
//   return apiClientFetch.get(url) as Promise<T>;
// }
let authToken: string | null = null;
let activeBranchId: string | null = null;

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));
  return match ? match.split("=").slice(1).join("=") : null;
}

export function setApiSession(token: string | null, branchId?: string | null) {
  authToken = token || null;

  if (branchId === undefined || branchId === null || branchId === "") {
    activeBranchId = null;
  } else {
    activeBranchId = branchId;
  }
}

async function request(url: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);

  // ✅ solo si hay body JSON
  if (options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  // ✅ FALLBACK: si todavía no se seteó en memoria, lo leo de cookie
  const tokenToUse = authToken ?? getCookie("token");
  const branchToUse =
    activeBranchId ?? getCookie("activeBranchId") ?? getCookie("branchId");

  if (tokenToUse) headers.set("Authorization", `Bearer ${tokenToUse}`);
  if (branchToUse) headers.set("X-Branch-Id", branchToUse);

  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${url}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `API request failed (${res.status})`);
  }

  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

export const apiClientFetch = {
  get: (url: string) => request(url),
  post: (url: string, body: any) =>
    request(url, { method: "POST", body: JSON.stringify(body) }),
  put: (url: string, body: any) =>
    request(url, { method: "PUT", body: JSON.stringify(body) }),
  patch: (url: string, body: any) =>
    request(url, { method: "PATCH", body: JSON.stringify(body) }),
  delete: (url: string) => request(url, { method: "DELETE" }),
};

export async function apiGet<T>(url: string): Promise<T> {
  return apiClientFetch.get(url) as Promise<T>;
}
