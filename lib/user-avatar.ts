// The avatar is a display preference of this browser, per user: it is not
// part of the session and never reaches the backend.
const STORE_KEY = "user-avatar-by-id";

type AvatarStore = Record<string, string>;

/** Avatars saved in this browser, by user id. Empty when unreadable. */
export function readAvatars(): AvatarStore {
  if (typeof window === "undefined") return {};
  try {
    return parseAvatarStore(window.localStorage.getItem(STORE_KEY));
  } catch {
    return {}; // storage blocked (private mode, policy)
  }
}

/** Saves (or, with null or blank, removes) a user's avatar; returns the new store. */
export function saveAvatar(userId: string, avatar: string | null): AvatarStore {
  const store = readAvatars();
  const value = avatar?.trim();
  if (value) store[userId] = value;
  else delete store[userId];
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {
    // Not persisted, but still shown until the page reloads.
  }
  return store;
}

export function parseAvatarStore(raw: string | null): AvatarStore {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const store: AvatarStore = {};
    for (const [userId, value] of Object.entries(parsed)) {
      if (typeof value === "string" && value.trim()) store[userId] = value.trim();
    }
    return store;
  } catch {
    return {};
  }
}
