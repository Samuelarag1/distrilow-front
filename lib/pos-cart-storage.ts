// The POS keeps an unfinished sale in localStorage, per user and per branch,
// so a reload or a branch switch never loses it (components/modules/pos-module.tsx).
// The branch selector reads it too, to warn before leaving a sale in progress.

export type PersistedPosCart<TItem> = {
  version: 1;
  updatedAt: number;
  userId: string;
  branchId: string;
  cart: TItem[];
  cashPaymentAmount: string;
  transferPaymentAmount: string;
  transferReference: string;
  pendingPaymentReason: string;
  saleNote: string;
};

const POS_CART_STORAGE_PREFIX = "bms:pos-cart:v1";
const POS_CART_TTL_MS = 12 * 60 * 60 * 1000;

export function buildPosCartStorageKey(
  userId: string | null | undefined,
  branchId: string | null | undefined
) {
  if (!userId || !branchId) return null;
  return `${POS_CART_STORAGE_PREFIX}:${userId}:${branchId}`;
}

export function parsePersistedPosCart<TItem>(
  raw: string | null
): PersistedPosCart<TItem> | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<PersistedPosCart<TItem>>;
    if (!parsed || typeof parsed !== "object") return null;
    if (parsed.version !== 1) return null;
    if (typeof parsed.userId !== "string" || !parsed.userId.trim()) return null;
    if (typeof parsed.branchId !== "string" || !parsed.branchId.trim())
      return null;

    const updatedAt = Number(parsed.updatedAt ?? 0);
    if (!Number.isFinite(updatedAt)) return null;
    if (Date.now() - updatedAt > POS_CART_TTL_MS) return null;

    const cart = Array.isArray(parsed.cart) ? (parsed.cart as TItem[]) : [];

    return {
      version: 1,
      updatedAt,
      userId: parsed.userId,
      branchId: parsed.branchId,
      cart,
      cashPaymentAmount:
        typeof parsed.cashPaymentAmount === "string"
          ? parsed.cashPaymentAmount
          : "",
      transferPaymentAmount:
        typeof parsed.transferPaymentAmount === "string"
          ? parsed.transferPaymentAmount
          : "",
      transferReference:
        typeof parsed.transferReference === "string"
          ? parsed.transferReference
          : "",
      pendingPaymentReason:
        typeof parsed.pendingPaymentReason === "string"
          ? parsed.pendingPaymentReason
          : "",
      saleNote: typeof parsed.saleNote === "string" ? parsed.saleNote : "",
    };
  } catch {
    return null;
  }
}

/** Products in this user's unfinished sale in this branch; 0 when there is none. */
export function countPendingPosCartItems(
  userId: string | null | undefined,
  branchId: string | null | undefined
): number {
  const key = buildPosCartStorageKey(userId, branchId);
  if (!key) return 0;

  try {
    return parsePersistedPosCart(window.localStorage.getItem(key))?.cart.length ?? 0;
  } catch {
    return 0;
  }
}
