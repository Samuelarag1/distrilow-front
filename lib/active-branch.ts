// Single source of truth for the active branch (docs/design/01-login-y-sesion.md
// §12.4). The UI (via useSyncExternalStore), the x-branch-id header and the
// SWR keys all read this one value, so what the screen shows is always what
// gets sent. Nothing else may store the active branch.
//
// Scope: per tab (sessionStorage), so switching in one tab never affects
// another. A new tab starts from the last branch this user opened in the
// browser (localStorage, decision D7). The initial default otherwise comes
// from the server; this module never picks a branch on its own.

type Listener = () => void;

type SessionBranchRef = { id: string };

const TAB_KEY = "distrilow:activeBranchId";
const LAST_USED_KEY_PREFIX = "distrilow:lastBranchId:";

let activeBranchId: string | null = null;
let allowedBranchIds: string[] = [];
let currentUserId: string | null = null;
const listeners = new Set<Listener>();

function readStorage(storage: () => Storage, key: string): string | null {
  try {
    return storage().getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(storage: () => Storage, key: string, value: string | null) {
  try {
    if (value) storage().setItem(key, value);
    else storage().removeItem(key);
  } catch {
    // Storage can be unavailable (SSR, private mode); memory still holds it.
  }
}

const tabStorage = () => window.sessionStorage;
const browserStorage = () => window.localStorage;

function setActive(next: string | null) {
  if (next) {
    writeStorage(tabStorage, TAB_KEY, next);
    if (currentUserId) {
      writeStorage(browserStorage, `${LAST_USED_KEY_PREFIX}${currentUserId}`, next);
    }
  } else {
    writeStorage(tabStorage, TAB_KEY, null);
  }

  if (next === activeBranchId) return;
  activeBranchId = next;
  listeners.forEach((listener) => listener());
}

export function getActiveBranchId(): string | null {
  return activeBranchId;
}

export function subscribeActiveBranch(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Reloads the page whenever this tab moves from one branch to another: an
 * explicit switch, or a token refresh that revoked the current branch and fell
 * back to another one. A full reload is the only way to be sure nothing of the
 * previous branch survives in memory (SWR cache, component state, module
 * variables), whatever each screen does. The new branch is already in this
 * tab's sessionStorage when `reload` runs, so the page comes back in it.
 *
 * Not a switch, so no reload: the first branch of a session (none → A, at
 * login or page load) and losing it (A → none, at logout). There is no data
 * of another branch to discard, and login must not reload (AUT-08).
 */
export function reloadOnBranchSwitch(reload: () => void): () => void {
  let previous = activeBranchId;
  return subscribeActiveBranch(() => {
    const next = activeBranchId;
    const switched = previous !== null && next !== null && previous !== next;
    previous = next;
    if (switched) reload();
  });
}

/**
 * Applies the branches the server says this user may access, keeping the
 * current choice when it is still allowed. Used by login, bootstrap and every
 * token refresh — a refresh therefore never changes the active branch, it can
 * only clear it when access was revoked.
 *
 * Order: this tab's choice → last branch opened in this browser (D7) → the
 * server's default → the only branch, when there is exactly one (nothing to
 * guess). Anything not in `branches` is discarded.
 */
export function reconcileActiveBranch(input: {
  userId?: string | null;
  branches: SessionBranchRef[];
  serverDefaultBranchId?: string | null;
}) {
  if (input.userId !== undefined) currentUserId = input.userId;
  allowedBranchIds = input.branches.map((branch) => branch.id);

  const candidates = [
    activeBranchId,
    readStorage(tabStorage, TAB_KEY),
    currentUserId
      ? readStorage(browserStorage, `${LAST_USED_KEY_PREFIX}${currentUserId}`)
      : null,
    input.serverDefaultBranchId ?? null,
    allowedBranchIds.length === 1 ? allowedBranchIds[0] : null,
  ];

  setActive(candidates.find((id) => id && allowedBranchIds.includes(id)) ?? null);
}

/** Explicit user choice. Throws if the branch is not one the user may access. */
export function selectBranch(branchId: string) {
  if (!allowedBranchIds.includes(branchId)) {
    throw new Error("No tenes acceso a la sucursal seleccionada.");
  }
  setActive(branchId);
}

/** Logout / dead session. Keeps the per-user "last used" so D7 survives a re-login. */
export function clearActiveBranch() {
  allowedBranchIds = [];
  currentUserId = null;
  setActive(null);
}
