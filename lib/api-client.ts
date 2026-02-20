import { getCookie, deleteCookie } from "./cookie-utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api";

interface RequestOptions extends RequestInit {
  body?: any;
}

async function fetchWithErrorHandling(
  url: string,
  options: RequestOptions = {},
) {
  const token = getCookie("token");
  const branchId = getCookie("branchId");

  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (branchId) {
    headers.set("X-Branch-Id", branchId);
  }

  const config: RequestInit = {
    ...options,
    headers,
  };

  if (options.body && typeof options.body !== "string") {
    config.body = JSON.stringify(options.body);
  }

  try {
    const response = await fetch(`${API_URL}${url}`, config);

    if (response.status === 401) {
      // Unauthorized - Could handle token refresh here or logout
      console.warn("Unauthorized request, logging out...");
      // For now, let's just clear cookies and redirect if in browser
      if (typeof window !== "undefined") {
        deleteCookie("token");
        deleteCookie("user");
        deleteCookie("branchId");
        window.location.href = "/login";
      }
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message || `Request failed with status ${response.status}`,
      );
    }

    // Check if response is empty
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      return await response.json();
    }

    return null;
  } catch (error) {
    console.error(`API Error (${url}):`, error);
    throw error;
  }
}

export const api = {
  get: (url: string, options?: RequestOptions) =>
    fetchWithErrorHandling(url, { ...options, method: "GET" }),

  post: (url: string, body: any, options?: RequestOptions) =>
    fetchWithErrorHandling(url, { ...options, method: "POST", body }),

  put: (url: string, body: any, options?: RequestOptions) =>
    fetchWithErrorHandling(url, { ...options, method: "PUT", body }),

  delete: (url: string, options?: RequestOptions) =>
    fetchWithErrorHandling(url, { ...options, method: "DELETE" }),
};
