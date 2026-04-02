export type SalesSyncPayload = {
  branchId: string | null;
  at: number;
};

const SALES_SYNC_CHANNEL = "bms-sales-sync";
const SALES_SYNC_EVENT = "bms:sales-sync";
const SALES_SYNC_STORAGE_KEY = "bms:sales-sync";

let salesBroadcastChannel: BroadcastChannel | null = null;

function getSalesBroadcastChannel() {
  if (typeof window === "undefined") return null;
  if (typeof BroadcastChannel === "undefined") return null;
  if (!salesBroadcastChannel) {
    salesBroadcastChannel = new BroadcastChannel(SALES_SYNC_CHANNEL);
  }
  return salesBroadcastChannel;
}

export function emitSalesSync(branchId?: string | null) {
  if (typeof window === "undefined") return;

  const payload: SalesSyncPayload = {
    branchId: branchId ?? null,
    at: Date.now(),
  };

  window.dispatchEvent(
    new CustomEvent<SalesSyncPayload>(SALES_SYNC_EVENT, {
      detail: payload,
    })
  );

  const channel = getSalesBroadcastChannel();
  if (channel) {
    channel.postMessage(payload);
  }

  try {
    window.localStorage.setItem(SALES_SYNC_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage quota/private mode errors.
  }
}

export function subscribeSalesSync(listener: (payload: SalesSyncPayload) => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  let lastEventSignature = "";

  const notify = (payload: SalesSyncPayload) => {
    const signature = `${payload.branchId ?? "null"}:${payload.at}`;
    if (signature === lastEventSignature) return;
    lastEventSignature = signature;
    listener(payload);
  };

  const handleWindowEvent = (event: Event) => {
    const customEvent = event as CustomEvent<SalesSyncPayload>;
    if (customEvent.detail) {
      notify(customEvent.detail);
    }
  };

  const handleStorageEvent = (event: StorageEvent) => {
    if (event.key !== SALES_SYNC_STORAGE_KEY || !event.newValue) return;
    try {
      const payload = JSON.parse(event.newValue) as SalesSyncPayload;
      if (payload && typeof payload === "object") {
        notify(payload);
      }
    } catch {
      // Ignore invalid payloads.
    }
  };

  const channel = getSalesBroadcastChannel();
  const handleChannelMessage = (event: MessageEvent<SalesSyncPayload>) => {
    if (event.data) {
      notify(event.data);
    }
  };

  window.addEventListener(SALES_SYNC_EVENT, handleWindowEvent as EventListener);
  window.addEventListener("storage", handleStorageEvent);
  if (channel) {
    channel.addEventListener("message", handleChannelMessage as EventListener);
  }

  return () => {
    window.removeEventListener(
      SALES_SYNC_EVENT,
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
