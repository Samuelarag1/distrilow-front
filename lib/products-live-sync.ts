export type ProductsSyncPayload = {
  branchId: string | null;
  at: number;
};

const PRODUCTS_SYNC_CHANNEL = "bms-products-sync";
const PRODUCTS_SYNC_EVENT = "bms:products-sync";
const PRODUCTS_SYNC_STORAGE_KEY = "bms:products-sync";

let productsBroadcastChannel: BroadcastChannel | null = null;

function getProductsBroadcastChannel() {
  if (typeof window === "undefined") return null;
  if (typeof BroadcastChannel === "undefined") return null;
  if (!productsBroadcastChannel) {
    productsBroadcastChannel = new BroadcastChannel(PRODUCTS_SYNC_CHANNEL);
  }
  return productsBroadcastChannel;
}

export function emitProductsSync(branchId?: string | null) {
  if (typeof window === "undefined") return;

  const payload: ProductsSyncPayload = {
    branchId: branchId ?? null,
    at: Date.now(),
  };

  window.dispatchEvent(
    new CustomEvent<ProductsSyncPayload>(PRODUCTS_SYNC_EVENT, {
      detail: payload,
    })
  );

  const channel = getProductsBroadcastChannel();
  if (channel) {
    channel.postMessage(payload);
  }

  try {
    window.localStorage.setItem(
      PRODUCTS_SYNC_STORAGE_KEY,
      JSON.stringify(payload)
    );
  } catch {
    // Ignore storage quota/private mode errors.
  }
}

export function subscribeProductsSync(
  listener: (payload: ProductsSyncPayload) => void
) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handleWindowEvent = (event: Event) => {
    const customEvent = event as CustomEvent<ProductsSyncPayload>;
    if (customEvent.detail) {
      listener(customEvent.detail);
    }
  };

  const handleStorageEvent = (event: StorageEvent) => {
    if (event.key !== PRODUCTS_SYNC_STORAGE_KEY || !event.newValue) return;
    try {
      const payload = JSON.parse(event.newValue) as ProductsSyncPayload;
      if (payload && typeof payload === "object") {
        listener(payload);
      }
    } catch {
      // Ignore invalid payloads.
    }
  };

  const channel = getProductsBroadcastChannel();
  const handleChannelMessage = (event: MessageEvent<ProductsSyncPayload>) => {
    if (event.data) {
      listener(event.data);
    }
  };

  window.addEventListener(PRODUCTS_SYNC_EVENT, handleWindowEvent as EventListener);
  window.addEventListener("storage", handleStorageEvent);
  if (channel) {
    channel.addEventListener("message", handleChannelMessage as EventListener);
  }

  return () => {
    window.removeEventListener(
      PRODUCTS_SYNC_EVENT,
      handleWindowEvent as EventListener
    );
    window.removeEventListener("storage", handleStorageEvent);
    if (channel) {
      channel.removeEventListener(
        "message",
        handleChannelMessage as EventListener
      );
    }
  };
}
