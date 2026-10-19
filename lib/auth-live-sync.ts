// Cross-tab session events, same shape as lib/cash-live-sync.ts: BroadcastChannel
// + window CustomEvent + localStorage fallback. Every tab shares one session
// (one httpOnly refresh cookie), so a logout in one tab ends it in all of them
// (docs/design/01-login-y-sesion.md §6.5, scenario E10).
export type AuthSyncPayload = {
  type: "logout";
  at: number;
};

const AUTH_SYNC_CHANNEL = "distrilow-auth-sync";
const AUTH_SYNC_EVENT = "distrilow:auth-sync";
const AUTH_SYNC_STORAGE_KEY = "distrilow:auth-sync";

let authBroadcastChannel: BroadcastChannel | null = null;

function getAuthBroadcastChannel() {
  if (typeof window === "undefined") return null;
  if (typeof BroadcastChannel === "undefined") return null;
  if (!authBroadcastChannel) {
    authBroadcastChannel = new BroadcastChannel(AUTH_SYNC_CHANNEL);
  }
  return authBroadcastChannel;
}

export function emitAuthSync(type: AuthSyncPayload["type"]) {
  if (typeof window === "undefined") return;

  const payload: AuthSyncPayload = { type, at: Date.now() };

  window.dispatchEvent(
    new CustomEvent<AuthSyncPayload>(AUTH_SYNC_EVENT, {
      detail: payload,
    })
  );

  const channel = getAuthBroadcastChannel();
  if (channel) {
    channel.postMessage(payload);
  }

  try {
    window.localStorage.setItem(AUTH_SYNC_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage quota/private mode errors.
  }
}

export function subscribeAuthSync(
  listener: (payload: AuthSyncPayload) => void
) {
  if (typeof window === "undefined") {
    return () => {};
  }

  let lastEventSignature = "";

  const notify = (payload: AuthSyncPayload) => {
    const signature = `${payload.type}:${payload.at}`;
    if (signature === lastEventSignature) return;
    lastEventSignature = signature;
    listener(payload);
  };

  const handleWindowEvent = (event: Event) => {
    const customEvent = event as CustomEvent<AuthSyncPayload>;
    if (customEvent.detail) {
      notify(customEvent.detail);
    }
  };

  const handleStorageEvent = (event: StorageEvent) => {
    if (event.key !== AUTH_SYNC_STORAGE_KEY || !event.newValue) return;
    try {
      const payload = JSON.parse(event.newValue) as AuthSyncPayload;
      if (payload && typeof payload === "object") {
        notify(payload);
      }
    } catch {
      // Ignore invalid payloads.
    }
  };

  const channel = getAuthBroadcastChannel();
  const handleChannelMessage = (event: MessageEvent<AuthSyncPayload>) => {
    if (event.data) {
      notify(event.data);
    }
  };

  window.addEventListener(AUTH_SYNC_EVENT, handleWindowEvent as EventListener);
  window.addEventListener("storage", handleStorageEvent);
  if (channel) {
    channel.addEventListener("message", handleChannelMessage as EventListener);
  }

  return () => {
    window.removeEventListener(
      AUTH_SYNC_EVENT,
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
