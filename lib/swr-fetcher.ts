// src/lib/swr-fetcher.ts
import { apiClientFetch } from "@/lib/api-client";

export const swrFetcher = (url: string) => apiClientFetch.get(url);
