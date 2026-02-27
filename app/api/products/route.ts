import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

type ProductLike = {
  id: string;
  stock?: unknown;
  branchId?: string;
  [key: string]: unknown;
};

type PaginatedProducts = {
  items: ProductLike[];
  [key: string]: unknown;
};

type StockRow = {
  productId: string;
  quantity: string | number | null;
};

function toFiniteNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function withStock(
  product: ProductLike,
  stockByProductId: Map<string, number>,
  branchId: string
): ProductLike {
  return {
    ...product,
    branchId: product.branchId ?? branchId,
    stock: stockByProductId.get(product.id) ?? 0,
  };
}

function mergePayloadWithStock(
  payload: unknown,
  stockByProductId: Map<string, number>,
  branchId: string
): unknown {
  if (Array.isArray(payload)) {
    return (payload as ProductLike[]).map((product) =>
      withStock(product, stockByProductId, branchId)
    );
  }

  if (
    payload &&
    typeof payload === "object" &&
    Array.isArray((payload as PaginatedProducts).items)
  ) {
    const page = payload as PaginatedProducts;
    return {
      ...page,
      items: page.items.map((product) =>
        withStock(product, stockByProductId, branchId)
      ),
    };
  }

  return payload;
}

function errorJson(status: number, message: string) {
  return NextResponse.json({ message }, { status });
}

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();

  const tokenFromCookie =
    cookieStore.get("token")?.value ?? cookieStore.get("access_token")?.value;
  const authHeader =
    req.headers.get("authorization") ??
    (tokenFromCookie ? `Bearer ${tokenFromCookie}` : null);

  const branchFromHeader = req.headers.get("x-branch-id")?.trim() || null;
  const branchFromQuery = req.nextUrl.searchParams.get("branchId")?.trim() || null;
  const branchFromCookie =
    cookieStore.get("activeBranchId")?.value ??
    cookieStore.get("branchId")?.value ??
    null;
  const branchId = branchFromQuery ?? branchFromHeader ?? branchFromCookie;

  const base = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL;
  if (!base) {
    return errorJson(500, "API base URL is not configured.");
  }

  const productsUrl = new URL(`${base}/products`);
  req.nextUrl.searchParams.forEach((value, key) => {
    if (key === "branchId") return;
    productsUrl.searchParams.set(key, value);
  });

  const upstreamHeaders = new Headers();
  if (authHeader) upstreamHeaders.set("Authorization", authHeader);
  if (branchId) upstreamHeaders.set("X-Branch-Id", branchId);

  const productsRes = await fetch(productsUrl.toString(), {
    headers: upstreamHeaders,
    cache: "no-store",
  });

  if (!productsRes.ok) {
    const bodyText = await productsRes.text().catch(() => "");
    return errorJson(productsRes.status, bodyText || "Failed to fetch products.");
  }

  const productsPayload = await productsRes.json();

  // If branch is unknown, just proxy products without stock merge.
  if (!branchId) {
    return NextResponse.json(productsPayload);
  }

  const stockRes = await fetch(`${base}/stocks/branch/${branchId}`, {
    headers: upstreamHeaders,
    cache: "no-store",
  });

  if (!stockRes.ok) {
    // Keep products available if stock endpoint fails.
    return NextResponse.json(productsPayload);
  }

  const stockRows = (await stockRes.json()) as StockRow[];
  const stockByProductId = new Map<string, number>();
  stockRows.forEach((row) => {
    if (!row?.productId) return;
    stockByProductId.set(row.productId, toFiniteNumber(row.quantity));
  });

  const payloadWithStock = mergePayloadWithStock(
    productsPayload,
    stockByProductId,
    branchId
  );

  return NextResponse.json(payloadWithStock);
}
