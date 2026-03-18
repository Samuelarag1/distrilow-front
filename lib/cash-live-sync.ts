export type CashSyncPayload = {
  branchId: string | null;
  at: number;
};

const CASH_SYNC_CHANNEL = "bms-cash-sync";
const CASH_SYNC_EVENT = "bms:cash-sync";
const CASH_SYNC_STORAGE_KEY = "bms:cash-sync";

let cashBroadcastChannel: BroadcastChannel | null = null;

function getCashBroadcastChannel() {
  if (typeof window === "undefined") return null;
  if (typeof BroadcastChannel === "undefined") return null;
  if (!cashBroadcastChannel) {
    cashBroadcastChannel = new BroadcastChannel(CASH_SYNC_CHANNEL);
  }
  return cashBroadcastChannel;
}

export function emitCashSync(branchId?: string | null) {
  if (typeof window === "undefined") return;

  const payload: CashSyncPayload = {
    branchId: branchId ?? null,
    at: Date.now(),
  };

  window.dispatchEvent(
    new CustomEvent<CashSyncPayload>(CASH_SYNC_EVENT, {
      detail: payload,
    })
  );

  const channel = getCashBroadcastChannel();
  if (channel) {
    channel.postMessage(payload);
  }

  try {
    window.localStorage.setItem(
      CASH_SYNC_STORAGE_KEY,
      JSON.stringify(payload)
    );
  } catch {
    // Ignore storage quota/private mode errors.
  }
}

export function subscribeCashSync(
  listener: (payload: CashSyncPayload) => void
) {
  if (typeof window === "undefined") {
    return () => {};
  }

  let lastEventSignature = "";

  const notify = (payload: CashSyncPayload) => {
    const signature = `${payload.branchId ?? "null"}:${payload.at}`;
    if (signature === lastEventSignature) return;
    lastEventSignature = signature;
    listener(payload);
  };

  const handleWindowEvent = (event: Event) => {
    const customEvent = event as CustomEvent<CashSyncPayload>;
    if (customEvent.detail) {
      notify(customEvent.detail);
    }
  };

  const handleStorageEvent = (event: StorageEvent) => {
    if (event.key !== CASH_SYNC_STORAGE_KEY || !event.newValue) return;
    try {
      const payload = JSON.parse(event.newValue) as CashSyncPayload;
      if (payload && typeof payload === "object") {
        notify(payload);
      }
    } catch {
      // Ignore invalid payloads.
    }
  };

  const channel = getCashBroadcastChannel();
  const handleChannelMessage = (event: MessageEvent<CashSyncPayload>) => {
    if (event.data) {
      notify(event.data);
    }
  };

  window.addEventListener(CASH_SYNC_EVENT, handleWindowEvent as EventListener);
  window.addEventListener("storage", handleStorageEvent);
  if (channel) {
    channel.addEventListener("message", handleChannelMessage as EventListener);
  }

  return () => {
    window.removeEventListener(
      CASH_SYNC_EVENT,
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
