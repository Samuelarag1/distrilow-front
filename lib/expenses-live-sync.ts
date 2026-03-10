export type ExpensesSyncPayload = {
  branchId: string | null;
  at: number;
};

const EXPENSES_SYNC_CHANNEL = "bms-expenses-sync";
const EXPENSES_SYNC_EVENT = "bms:expenses-sync";
const EXPENSES_SYNC_STORAGE_KEY = "bms:expenses-sync";

let expensesBroadcastChannel: BroadcastChannel | null = null;

function getExpensesBroadcastChannel() {
  if (typeof window === "undefined") return null;
  if (typeof BroadcastChannel === "undefined") return null;
  if (!expensesBroadcastChannel) {
    expensesBroadcastChannel = new BroadcastChannel(EXPENSES_SYNC_CHANNEL);
  }
  return expensesBroadcastChannel;
}

export function emitExpensesSync(branchId?: string | null) {
  if (typeof window === "undefined") return;

  const payload: ExpensesSyncPayload = {
    branchId: branchId ?? null,
    at: Date.now(),
  };

  window.dispatchEvent(
    new CustomEvent<ExpensesSyncPayload>(EXPENSES_SYNC_EVENT, {
      detail: payload,
    })
  );

  const channel = getExpensesBroadcastChannel();
  if (channel) {
    channel.postMessage(payload);
  }

  try {
    window.localStorage.setItem(
      EXPENSES_SYNC_STORAGE_KEY,
      JSON.stringify(payload)
    );
  } catch {
    // Ignore storage quota/private mode errors.
  }
}

export function subscribeExpensesSync(
  listener: (payload: ExpensesSyncPayload) => void
) {
  if (typeof window === "undefined") {
    return () => {};
  }

  let lastEventSignature = "";

  const notify = (payload: ExpensesSyncPayload) => {
    const signature = `${payload.branchId ?? "null"}:${payload.at}`;
    if (signature === lastEventSignature) return;
    lastEventSignature = signature;
    listener(payload);
  };

  const handleWindowEvent = (event: Event) => {
    const customEvent = event as CustomEvent<ExpensesSyncPayload>;
    if (customEvent.detail) {
      notify(customEvent.detail);
    }
  };

  const handleStorageEvent = (event: StorageEvent) => {
    if (event.key !== EXPENSES_SYNC_STORAGE_KEY || !event.newValue) return;
    try {
      const payload = JSON.parse(event.newValue) as ExpensesSyncPayload;
      if (payload && typeof payload === "object") {
        notify(payload);
      }
    } catch {
      // Ignore invalid payloads.
    }
  };

  const channel = getExpensesBroadcastChannel();
  const handleChannelMessage = (event: MessageEvent<ExpensesSyncPayload>) => {
    if (event.data) {
      notify(event.data);
    }
  };

  window.addEventListener(EXPENSES_SYNC_EVENT, handleWindowEvent as EventListener);
  window.addEventListener("storage", handleStorageEvent);
  if (channel) {
    channel.addEventListener("message", handleChannelMessage as EventListener);
  }

  return () => {
    window.removeEventListener(
      EXPENSES_SYNC_EVENT,
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
