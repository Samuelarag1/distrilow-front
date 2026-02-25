import { apiClientFetch } from "@/lib/api-client";

export const swrFetcher = (url: string) => apiClientFetch.get(url);
