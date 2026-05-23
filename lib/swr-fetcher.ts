// src/lib/swr-fetcher.ts
import { apiClientFetch } from "@/lib/api-client";
import type { Fetcher } from "swr";

export const swrFetcher: Fetcher<any, string> = (url: string) =>
  apiClientFetch.get(url);
